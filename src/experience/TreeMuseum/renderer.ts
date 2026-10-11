import { journeyLength, viewportLength, wrapJourney } from './journey';
import butterchurn from 'butterchurn';
import { createPerformanceMonitor, type MuseumPerformance } from './performance';
import { themes, initialTheme, type ThemeId } from './themes';
import { createQualityController, qualityTiers, type QualityStatus } from './quality';
import { createNativeSpinePreset, installNativeSpine, nativeSpineX, type NativeSpineInput } from './native-spine';

export interface MuseumDiagnostics {
  renderer:string; theme:ThemeId; presets:string[]; quality:QualityStatus; frames:number; milkFrames:number;
  position:number;paused:boolean;gestureCount:number;pulseCount:number;signalEnergy:number;trailFrames:number;
  nativeBands:{bass:number;mid:number;treble:number};nativeFrames:number;nativePosition:number;nativeDeposits:number;nativeWavePoints:number;nativeTargetBound:boolean;nativeSize:number[];injecting:boolean;
  waveformFeed:string;waveformFeedTime:number;performance?:MuseumPerformance;error?:string;
}
declare global {interface Window {__treeMuseum?:MuseumDiagnostics}}
const vertex=`#version 300 es
in vec2 aPosition;out vec2 uv;
void main(){uv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D nativeField;
void main(){
  color=vec4(texture(nativeField,vec2(uv.x,1.-uv.y)).rgb,1.);
}`;

export function createMuseumRenderer(canvas:HTMLCanvasElement,onError:(error:string)=>void,selectedTheme:ThemeId=initialTheme()) {
  let themeIndex=themes.findIndex(theme=>theme.id===selectedTheme);
  const quality=createQualityController();let tier=qualityTiers[quality.status.tier];
  const diagnostics:MuseumDiagnostics={renderer:'Butterchurn2.6.7 / native waveform-stage feedback',theme:selectedTheme,presets:[themes[themeIndex].name],quality:quality.status,
    frames:0,milkFrames:0,position:0,paused:false,gestureCount:0,pulseCount:0,signalEnergy:0,trailFrames:0,
    nativeBands:{bass:0,mid:0,treble:0},nativeFrames:0,nativePosition:0,nativeDeposits:0,nativeWavePoints:513,nativeTargetBound:false,nativeSize:[tier.source,tier.source],injecting:true,
    waveformFeed:'One mono input; native FFT bands and native512 timeArrayL waveform deposited into targetTexture',waveformFeedTime:0};
  window.__treeMuseum=diagnostics;
  const context=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});
  if(!context) throw new Error('WebGL2 is unavailable');const gl=context;
  function shader(type:number,source:string) {
    const value=gl.createShader(type)!;gl.shaderSource(value,source);gl.compileShader(value);
    if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value)||'Shader compile failed');return value;
  }
  const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram()!;
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.bindAttribLocation(program,0,'aPosition');gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Shader link failed');
  gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'nativeField'),0);
  const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const source=document.createElement('canvas');source.width=source.height=tier.source;
  const nativeGl=source.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'high-performance'})!;
  const visualizer=butterchurn.createVisualizer(null,source,{width:tier.source,height:tier.source,pixelRatio:1,textureRatio:1,meshWidth:24,meshHeight:18});
  const texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tier.source,tier.source,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  const perf=new URLSearchParams(location.search).get('perf')==='1'?createPerformanceMonitor(gl,value=>{diagnostics.performance=value;}):null;
  const sampleCount = 1024;
  const audioLevels = {timeByteArray:new Uint8Array(sampleCount),timeByteArrayL:new Uint8Array(sampleCount),timeByteArrayR:new Uint8Array(sampleCount)};
  interface SignalFrame { time: number; left: Float32Array; right: Float32Array; envelope: Float32Array }
  interface Pulse { born: number; origin: number; amplitude: number; speed: number; width: number; phase: number; harmonic: number }
  const pulses: Pulse[] = [];
  const history: SignalFrame[] = [];
  const smoothLeft=new Float32Array(sampleCount), smoothRight=new Float32Array(sampleCount), smoothEnvelope=new Float32Array(sampleCount);
  let lastSynthesis=-1;
  let gestureEnergy = 0, lastPulse = -1, randomState = 0x62f37a;
  const random = () => {
    randomState ^= randomState<<13;randomState ^= randomState>>>17;randomState ^= randomState<<5;
    return (randomState>>>0)/4294967296;
  };
  const wrap = (value: number) => ((value%6)+6)%6;
  const byte = (value: number) => Math.max(0,Math.min(255,Math.round(128+value*127)));
  function synthesize(now: number): SignalFrame {
    // Reuse a snapshot only after it leaves the immutable retained history.
    const recycled=history.length>=128?history.shift():undefined;
    const left=recycled?.left||new Float32Array(sampleCount), right=recycled?.right||new Float32Array(sampleCount), envelopes=recycled?.envelope||new Float32Array(sampleCount);
    let energy = 0;
    const initial=lastSynthesis<0, signalDelta=initial?0:Math.max(0,now-lastSynthesis);
    lastSynthesis=now;
    const signalAttack=1-Math.exp(-signalDelta/.10), signalRelease=1-Math.exp(-signalDelta/.26);
    const envelopeAttack=1-Math.exp(-signalDelta/.18), envelopeRelease=1-Math.exp(-signalDelta/.50);
    const ease=(previous:number,target:number,attack:number,release:number)=>initial?target:previous+(target-previous)*(Math.abs(target)>Math.abs(previous)?attack:release);
    for(let i=0;i<sampleCount;i++) {
      const y = i/sampleCount*6;
      const phase = y*Math.PI/3;
      let a = Math.sin(phase*2-now*.45)*.10 + Math.sin(phase*9-now*.7)*.13 + Math.sin(phase*23+now*.41)*.055 + Math.sin(phase*83-now*.55)*.025;
      let b = Math.sin(phase*2-now*.45+.1)*.095 + Math.sin(phase*9-now*.7+.18)*.12 + Math.sin(phase*17-now*.37)*.045 + Math.sin(phase*79-now*.55)*.025;
      let envelope = 0;
      for(const pulse of pulses) {
        const age = now-pulse.born;
        if(age<0) continue;
        const distance = wrap(y-pulse.origin-pulse.speed*age+3)-3;
        const strength = Math.exp(-distance*distance/(pulse.width*pulse.width))*Math.exp(-age*.5)*(1-Math.exp(-age/.22))*pulse.amplitude;
        envelope += strength;
        const carrier = phase*pulse.harmonic - now*(1.3+pulse.speed*.5)+pulse.phase;
        a += strength*(Math.sin(phase*2-now*.6)*.13+Math.sin(carrier)*.58+Math.sin(carrier*2-pulse.phase)*.21+Math.sin(phase*(80+pulse.harmonic)+pulse.phase-now*.7)*.08);
        b += strength*(Math.sin(phase*3-now*.6)*.12+Math.sin(carrier+.26)*.54+Math.sin(phase*(pulse.harmonic+3)+now*.8)*.18+Math.sin(phase*(76+pulse.harmonic)+pulse.phase-now*.7)*.07);
      }
      // Soft limiting and explicit byte saturation avoid Uint8Array's modulo overflow.
      left[i]=smoothLeft[i]=ease(smoothLeft[i],Math.tanh(a*(1+gestureEnergy*.28)),signalAttack,signalRelease);
      right[i]=smoothRight[i]=ease(smoothRight[i],Math.tanh(b*(1+gestureEnergy*.28)),signalAttack,signalRelease);
      energy += left[i]*left[i]+right[i]*right[i];
      envelopes[i]=smoothEnvelope[i]=ease(smoothEnvelope[i],Math.min(1,envelope),envelopeAttack,envelopeRelease);
    }
    diagnostics.signalEnergy = Math.sqrt(energy/(sampleCount*2));
    diagnostics.pulseCount = pulses.length;
    return {time:now,left,right,envelope:envelopes};
  }
  function uploadSignal() {
    const latest=history[history.length-1];
    if(!latest) {audioLevels.timeByteArray.fill(128);audioLevels.timeByteArrayL.fill(128);audioLevels.timeByteArrayR.fill(128);spine.envelope.fill(0);return;}
    let energy=0;
    for(let i=0;i<sampleCount;i++) {
      const value=byte(latest.left[i]*.8+latest.right[i]*.2);
      audioLevels.timeByteArray[i]=audioLevels.timeByteArrayL[i]=audioLevels.timeByteArrayR[i]=value;
      spine.envelope[i]=latest.envelope[i];energy+=Math.pow((value-128)/127,2);
    }
    spine.time=latest.time;diagnostics.signalEnergy=Math.sqrt(energy/sampleCount);diagnostics.trailFrames=history.length;
  }
  function clearExcitation() {
    pulses.length=0;history.length=0;gestureEnergy=0;lastPulse=-1;lastSynthesis=-1;
    smoothLeft.fill(0);smoothRight.fill(0);smoothEnvelope.fill(0);
    diagnostics.pulseCount=0;uploadSignal();
  }
  const spine:NativeSpineInput={samples:visualizer.renderer.audio.timeArrayL,envelope:new Float32Array(sampleCount),time:0,position:0,worldWidth:Math.max(3.9,innerWidth/innerHeight*3.25),theme:selectedTheme,injecting:true,
    onDeposit:()=>{
      diagnostics.nativeTargetBound=nativeGl.getParameter(nativeGl.DRAW_FRAMEBUFFER_BINDING)===visualizer.renderer.targetFrameBuffer;
      if(!diagnostics.nativeTargetBound) throw new Error('Native waveform stage is not bound to target feedback');
      diagnostics.nativeDeposits++;
    }};
  function clearNativeFeedback() {
    const renderer=visualizer.renderer;
    const previous=nativeGl.getParameter(nativeGl.FRAMEBUFFER_BINDING);
    const targets=[renderer.targetFrameBuffer,renderer.prevFrameBuffer,renderer.compFrameBuffer,
      ...[renderer.blurShader1,renderer.blurShader2,renderer.blurShader3].flatMap(blur=>[blur.blurHorizontalFrameBuffer,blur.blurVerticalFrameBuffer])];
    nativeGl.clearColor(0,0,0,1);for(const target of targets){nativeGl.bindFramebuffer(nativeGl.FRAMEBUFFER,target);nativeGl.clear(nativeGl.COLOR_BUFFER_BIT);}
    nativeGl.bindFramebuffer(nativeGl.FRAMEBUFFER,previous);
  }
  const depositedSamples=new Int8Array(spine.samples.length);let depositedPosition=0,depositedWidth=spine.worldWidth;
  const disposeSpine=installNativeSpine(nativeGl,visualizer.renderer,spine);
  let goodPreset:unknown=themes[themeIndex].preset;
  let renderFailed=false,goodName=themes[themeIndex].name as string;
  let pendingPreset:{preset:unknown;name:string;resolve:()=>void;reject:(error:unknown)=>void}|null=null;
  function loadPreset(preset:unknown) {
    const native=visualizer.renderer,stale=[native.prevWarpShader.shaderProgram,native.prevCompShader.shaderProgram];
    try{visualizer.loadPreset(createNativeSpinePreset(preset),0);}
    finally{
      const retained=[native.warpShader.shaderProgram,native.compShader.shaderProgram,native.prevWarpShader.shaderProgram,native.prevCompShader.shaderProgram];
      for(const program of stale)if(!retained.includes(program)){for(const shader of nativeGl.getAttachedShaders(program)||[])nativeGl.deleteShader(shader);nativeGl.deleteProgram(program);}
    }
    for(const stage of [visualizer.renderer.warpShader,visualizer.renderer.compShader]){
      if(!nativeGl.getProgramParameter(stage.shaderProgram,nativeGl.LINK_STATUS))throw new Error(nativeGl.getProgramInfoLog(stage.shaderProgram)||'Preset shader link failed');
    }
    clearNativeFeedback();
  }
  function loadTheme() {pendingPreset?.reject(new Error('Preset selection superseded'));pendingPreset=null;spine.theme=themes[themeIndex].id;loadPreset(themes[themeIndex].preset);goodPreset=themes[themeIndex].preset;goodName=themes[themeIndex].name;renderFailed=false;delete diagnostics.error;}
  loadTheme();
  let previous=performance.now(),time=0,lastSignal=-1,lastRender=-1,request=0,disposed=false,target=0,current=0;
  let paused=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const resize=()=>{
    const scale=Math.min(devicePixelRatio,tier.scale,tier.display/innerWidth);canvas.width=Math.round(innerWidth*scale);canvas.height=Math.round(innerHeight*scale);
    spine.worldWidth=Math.max(3.9,innerWidth/innerHeight*3.25);clearNativeFeedback();lastRender=-1;quality.suspend();
  };
  function applyQuality() {
    tier=qualityTiers[quality.status.tier];const oldTarget=visualizer.renderer.targetTexture;
    source.width=source.height=tier.source;visualizer.setRendererSize(tier.source,tier.source);
    if(oldTarget!==visualizer.renderer.targetTexture&&oldTarget!==visualizer.renderer.prevTexture) nativeGl.deleteTexture(oldTarget);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tier.source,tier.source,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    diagnostics.nativeSize=[tier.source,tier.source];resize();
  }
  resize();addEventListener('resize',resize);
  const fail=(error:unknown)=>{diagnostics.error=error instanceof Error?error.message:String(error);onError(diagnostics.error);};
  function frame(now:number) {
    if(disposed) return;const dt=Math.min((now-previous)/1000,.05);previous=now;
    const qualityChanged=quality.record(now,!paused&&!document.hidden&&document.hasFocus());
    if(!document.hidden) {
      const submittedAt=performance.now();perf?.startFrame(now,paused);
      if(!paused){time+=dt;gestureEnergy*=Math.exp(-dt*2.4);for(let i=pulses.length-1;i>=0;i--)if(time-pulses[i].born>7)pulses.splice(i,1);}
      current+=(target-current)*Math.min(1,dt*9);
      if(Math.abs(target-current)<.00001&&Math.abs(target)>600){current=wrapJourney(current);target=current;}
      diagnostics.position=wrapJourney(current);diagnostics.paused=paused;
      try {
        if(qualityChanged) applyQuality();
        if(lastSignal<0||(!paused&&time-lastSignal>=1/60-.0004)){history.push(synthesize(time));uploadSignal();lastSignal=time;}
        if(!renderFailed&&(lastRender<0||Math.abs(current-spine.position)>.0001||(!paused&&time-lastRender>=1/tier.cadence-.0007))) {
          const elapsed=lastRender<0?1/tier.cadence:Math.min(.1,time-lastRender);
          spine.position=current;visualizer.render({audioLevels,elapsedTime:elapsed});lastRender=time;
          if(pendingPreset){goodPreset=pendingPreset.preset;goodName=pendingPreset.name;pendingPreset.resolve();pendingPreset=null;}
          diagnostics.nativeBands={bass:visualizer.renderer.audioLevels.bass,mid:visualizer.renderer.audioLevels.mid,treble:visualizer.renderer.audioLevels.treb};
          diagnostics.nativeFrames=visualizer.renderer.frameNum;depositedSamples.set(spine.samples);depositedPosition=wrapJourney(spine.position);depositedWidth=spine.worldWidth;
          diagnostics.nativePosition=depositedPosition;diagnostics.milkFrames++;diagnostics.waveformFeedTime=spine.time;
          gl.bindTexture(gl.TEXTURE_2D,texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
        }
        perf?.beginGpu();gl.useProgram(program);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.drawArrays(gl.TRIANGLES,0,6);diagnostics.frames++;
        perf?.endGpu();perf?.endFrame(performance.now()-submittedAt,[canvas.width,canvas.height],diagnostics.nativeSize);
      } catch(error){perf?.endGpu();renderFailed=true;fail(error);
        if(pendingPreset){pendingPreset.reject(error);pendingPreset=null;try{loadPreset(goodPreset);diagnostics.presets=[goodName];lastRender=-1;renderFailed=false;}catch{/* Picker can still load a new candidate. */}}
      }
    } else perf?.idle();request=requestAnimationFrame(frame);
  }
  request=requestAnimationFrame(frame);
  const lost=(event:Event)=>{event.preventDefault();fail('Graphics context interrupted. Reload to resume.');};canvas.addEventListener('webglcontextlost',lost);source.addEventListener('webglcontextlost',lost);
  return {
    move(delta:number){const bounded=Math.max(-2,Math.min(2,Number.isFinite(delta)?delta:0));target+=bounded;
      if(paused||document.hidden||Math.abs(bounded)<.0001)return;diagnostics.gestureCount++;gestureEnergy=Math.min(1,gestureEnergy+Math.abs(bounded)*.85);
      if(lastPulse<0||time-lastPulse>.14){pulses.push({born:time,origin:wrap(current+2.1),amplitude:.35+Math.min(.45,Math.abs(bounded)*.8)+random()*.12,
        speed:1.2+random()*.65,width:.18+random()*.16,phase:random()*Math.PI*2,harmonic:10+Math.floor(random()*12)});if(pulses.length>10)pulses.shift();lastPulse=time;}
    },
    get position(){return depositedPosition;},
    get journeyLength(){return journeyLength;},
    getSpinePoint(worldY:number){return {x:nativeSpineX(depositedSamples,worldY,depositedWidth),y:wrapJourney(worldY-depositedPosition)/viewportLength};},
    jump(worldY:number){target=wrapJourney(worldY);lastRender=-1;},
    setPaused(value:boolean){paused=value;diagnostics.paused=value;},
    setInjecting(value:boolean){spine.injecting=value;diagnostics.injecting=value;},
    setTheme(value:ThemeId){if(diagnostics.theme===value&&diagnostics.presets[0]===themes.find(theme=>theme.id===value)?.name)return;themeIndex=themes.findIndex(theme=>theme.id===value);diagnostics.theme=value;diagnostics.presets=[themes[themeIndex].name];loadTheme();lastRender=-1;quality.suspend();},
    setPreset(preset:unknown,name:string):Promise<void>{
      pendingPreset?.reject(new Error('Preset selection superseded'));pendingPreset=null;
      try{loadPreset(preset);renderFailed=false;delete diagnostics.error;diagnostics.presets=[name];lastRender=-1;quality.suspend();}
      catch(error){try{loadPreset(goodPreset);diagnostics.presets=[goodName];renderFailed=false;lastRender=-1;}catch{renderFailed=true;}return Promise.reject(error);}
      return new Promise((resolve,reject)=>{pendingPreset={preset,name,resolve,reject};});
    },
    reset(){target=0;clearExcitation();clearNativeFeedback();lastSignal=-1;lastRender=-1;},
    dispose(){pendingPreset?.reject(new Error('Renderer disposed'));pendingPreset=null;disposed=true;cancelAnimationFrame(request);removeEventListener('resize',resize);canvas.removeEventListener('webglcontextlost',lost);source.removeEventListener('webglcontextlost',lost);
      disposeSpine();perf?.dispose();gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);nativeGl.getExtension('WEBGL_lose_context')?.loseContext();},
  };
}
