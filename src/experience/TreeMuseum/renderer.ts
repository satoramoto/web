import butterchurn from 'butterchurn';
import { createPerformanceMonitor, type MuseumPerformance } from './performance';
import { themes, initialTheme, type ThemeId } from './themes';
import { createQualityController, qualityTiers, type QualityStatus } from './quality';

export interface MuseumDiagnostics {
  renderer: string;
  theme: ThemeId;
  quality: QualityStatus;
  presets: string[];
  frames: number;
  milkFrames: number;
  position: number;
  paused: boolean;
  gestureCount: number;
  pulseCount: number;
  signalEnergy: number;
  layerRms: number[];
  waveformFeed: string;
  waveformFeedTime: number[];
  trailFrames: number;
  feedbackFrames: number;
  feedbackSize: number[];
  performance?: MuseumPerformance;
  error?: string;
}
declare global { interface Window { __treeMuseum?: MuseumDiagnostics } }

const vertex = `#version 300 es
in vec2 aPosition;
out vec2 uv;
void main() { uv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }`;
const shaderCommon = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D milk0;
uniform sampler2D milk1;
uniform sampler2D milk2;
uniform sampler2D signalField;
uniform sampler2D sharedField;
uniform sampler2D branchMask;
uniform float clock;
uniform float position;
uniform float aspect;
uniform int theme;
const float PI = 3.14159265;
float loopDistance(float a,float b) { return mod(a-b+3.,6.)-3.; }
float trunk(float y) { return .32*sin(y*PI/3.+.4)+.15*sin(y*PI+clock*.07); }
vec4 signalAt(float y,float row) { return texture(signalField,vec2(y/6.+.5/1024.,(row+.5)/16.)); }
float signedSample(vec4 signal) { return (signal.r*255.-128.)/127.; }
float spineAt(float y,vec4 signal) { return trunk(y)+signedSample(signal)*.3; }
vec3 sampleLayer(int layer,vec2 coord) {
  vec2 reflected=1.-abs(mod(coord,2.)-1.);
  if(layer==0) return texture(milk0,reflected).rgb;
  if(layer==1) return texture(milk1,reflected).rgb;
  return texture(milk2,reflected).rgb;
}
vec3 tint(int layer) { return layer==0?vec3(.48,.3,1.):layer==1?vec3(.09,.46,1.):vec3(.94,.48,.37); }
float worldWidth() { return max(3.9,aspect*3.25); }
vec2 branching(vec2 p) {
  float broad=0., crisp=0.;
  for(int nodeIndex=0;nodeIndex<3;nodeIndex++) {
    float node=1.+float(nodeIndex)*2.;
    float dy=loopDistance(p.y,node);
    float dx=p.x-trunk(node);
    float direction=nodeIndex==2?1.:-1.;
    for(int branchIndex=0;branchIndex<4;branchIndex++) {
      float side=mod(float(branchIndex),2.)*2.-1.;
      float reach=max(0.,dx*side);
      float slope=.64+floor(float(branchIndex)/2.)*.61;
      float curve=direction*pow(reach,.68)*slope+.042*sin(reach*5.+float(nodeIndex)*2.+clock*.09)*reach;
      float distance=abs(dy-curve);
      float domain=smoothstep(0.,.1,reach)*exp(-reach*.4)*(1.-smoothstep(2.25,2.8,abs(dy)));
      broad+=exp(-distance*distance*10.)*domain;
      crisp+=exp(-distance*distance*1600.)*domain;
    }
  }
  return vec2(min(1.,broad*.48),min(1.,crisp));
}
vec3 paletteAt(float y) {
  vec3 w=vec3(exp(-pow(loopDistance(y,1.),2.)*.65),exp(-pow(loopDistance(y,3.),2.)*.65),exp(-pow(loopDistance(y,5.),2.)*.65))+.04;
  w/=dot(w,vec3(1.));
  return tint(0)*w.x+tint(1)*w.y+tint(2)*w.z;
}
`;
const maskFragment = shaderCommon + `
void main() {
  vec2 limbs=branching(vec2((uv.x-.5)*worldWidth(),uv.y*6.));
  color=vec4(limbs,0.,1.);
}
`;
const feedbackFragment = shaderCommon + `
uniform float feedbackDelta;
uniform float freshField;
void main() {
  float y=uv.y*6.;
  float x=(uv.x-.5)*worldWidth();
  vec4 signal=signalAt(y,0.);
  float stem=spineAt(y,signal), signedWave=signedSample(signal);
  float dx=x-stem;
  // Every y has its own emitter on the exact visible waveform; there is no fixed radial world center.
  vec2 p=vec2(dx*6./(worldWidth()*aspect),signedWave*.9+.12*sin(y*PI));
  float radius=length(p), angle=atan(p.y,p.x);
  vec2 coordinate;
  if(theme==0) {
    // Fold polar space into twelve moving mirror sectors: bright source geometry stays intact.
    float folded=abs(mod(angle+clock*.11,PI/3.)-PI/6.);
    coordinate=.5+vec2(cos(folded*6.),sin(folded*6.))*radius*.32;
    coordinate+=vec2(.08*sin(clock*.17),y/3.+signedWave*.32);
  } else if(theme==1) {
    coordinate=vec2(.5+dx*.31+signedWave*.2,.5+.43*sin(y*PI/3.)+signedWave*.36);
    coordinate+=vec2(sin(y*PI+clock*.23),cos(x*2.3-clock*.19))*.14;
  } else {
    // A logarithmic tunnel, with the vanishing points repeating in the six-unit world.
    coordinate=vec2(angle/PI*2.+clock*.16,-log(abs(dx)+.10)*.65-clock*.23+signedWave*.36);
    coordinate+=vec2(.06*sin(y*PI),.08*cos(y*2.*PI/3.));
  }
  vec3 probe0=sampleLayer(0,coordinate);
  vec3 probe1=sampleLayer(1,coordinate+vec2(.13,.17));
  vec3 probe2=sampleLayer(2,coordinate-vec2(.11,.19));
  // One common displacement field, derived from every live preset, steers all of them.
  vec2 flow=(vec2(probe0.r-probe1.b,probe1.g-probe2.r)+vec2(probe2.b-probe0.g,probe0.b-probe2.g))*.052;
  flow+=vec2(sin(y*PI/3.+clock*.06),cos(y*2.*PI/3.-clock*.04))*.018;
  vec2 displaced=coordinate+flow;
  vec3 weights=vec3(exp(-pow(loopDistance(y,1.),2.)*.23),exp(-pow(loopDistance(y,3.),2.)*.23),exp(-pow(loopDistance(y,5.),2.)*.23))+.18;
  weights/=dot(weights,vec3(1.));
  vec3 a=sampleLayer(0,displaced);
  vec3 b=sampleLayer(1,displaced+vec2(.13,.17));
  vec3 c=sampleLayer(2,displaced-vec2(.11,.19));
  // Contrast each real source before mixing: averaging gray backgrounds first erases neon topology.
  a=pow(clamp((a-.16)/.84,0.,1.),vec3(1.8));
  b=pow(clamp((b-.16)/.84,0.,1.),vec3(1.8));
  c=pow(clamp((c-.16)/.84,0.,1.),vec3(1.8));
  float sa=max(max(a.r,a.g),a.b)-min(min(a.r,a.g),a.b)+dot(a,vec3(.15));
  float sb=max(max(b.r,b.g),b.b)-min(min(b.r,b.g),b.b)+dot(b,vec3(.15));
  float sc=max(max(c.r,c.g),c.b)-min(min(c.r,c.g),c.b)+dot(c,vec3(.15));
  vec3 hero=theme==0?a:sa>sb&&sa>sc?a:sb>sc?b:c;
  vec3 mixed=hero*.78+(a*weights.x+b*weights.y+c*weights.z)*.22;
  float gray=dot(mixed,vec3(.2126,.7152,.0722));
  vec3 detail=clamp((mixed-vec3(gray))*1.35+gray,0.,1.)*1.4;
  float amplitude=abs(signedWave);
  float width=.09+signal.b*.48+amplitude*.12;
  float emission=exp(-dx*dx/(width*width))*(.065+signal.b*1.8+amplitude*.25)*signal.a;
  vec3 injected=clamp(detail*min(1.6,emission),0.,1.);
  // Backtrace away from the same signed sample position. Old emission travels out into quiet space.
  float side=dx/sqrt(dx*dx+.003);
  float outward=theme==2?2.2:theme==0?1.65:1.1;
  float envelopeSlope=(signalAt(y+.035,0.).b-signalAt(y-.035,0.).b)/.07;
  vec2 velocity=vec2(side*outward/worldWidth(),.035-clamp(envelopeSlope,-3.,3.)*.12+signedWave*(theme==1?.16:.09));
  velocity+=flow*(theme==1?.45:.18);
  if(theme==0) velocity.y+=side*.09*sin(y*PI);
  vec2 advected=vec2(clamp(uv.x-velocity.x*feedbackDelta,0.,1.),fract(uv.y-velocity.y*feedbackDelta));
  vec3 previous=texture(sharedField,advected).rgb;
  float retention=exp(-feedbackDelta*(theme==1?.85:1.15));
  vec3 retained=freshField>0.5?vec3(0.):previous*retention;
  float exposure=freshField>0.5?1.:1.-exp(-feedbackDelta*18.);
  // Bounded screen injection exposes local preset detail quickly; decay independently controls its wake.
  color=vec4(retained+injected*exposure*(1.-retained),1.);
}
`;
const fragment = shaderCommon + `
void main() {
  float y=mod((1.-uv.y)*6.+position,6.);
  float x=(uv.x-.5)*worldWidth();
  float stem=trunk(y);
  vec3 result=texture(sharedField,vec2(uv.x,y/6.)).rgb+vec3(.001,.002,.006);
  // A sparse contour gives the tree structure without the old repeated fan of eighteen rails per layer.
  vec2 limbs=texture(branchMask,vec2(uv.x,y/6.)).rg;
  result+=paletteAt(y)*limbs.y*.035;
  result+=paletteAt(y)*exp(-pow(x-stem,2.)*100.)*.025;
  // The bounded signal cannot reach this pixel outside the narrow spine band.
  if(abs(x-stem)<.58) {
  // Historical rows are actual immutable audio-source windows, not re-evaluated oscillators.
  for(int row=11;row>=1;row--) {
    float age=float(row)*.06;
    float trailingY=mod(y-age*.45+6.,6.);
    vec4 past=signalAt(trailingY,float(row));
    float waveform=signedSample(past)*.3;
    float ghostDistance=abs(x-stem-waveform-age*.028);
    float fade=exp(-age*2.5)*past.a;
    vec3 ghostColor=mix(vec3(.19,.33,.82),vec3(.64,.42,1.),age/.66);
    result+=ghostColor*exp(-ghostDistance*ghostDistance*6500.)*(.028+past.b*.72)*fade;
    result+=ghostColor*exp(-ghostDistance*ghostDistance*210.)*past.b*.045*fade;
  }
  vec4 signal=signalAt(y,0.);
  float waveDistance=abs(x-spineAt(y,signal));
  vec3 spineColor=mix(vec3(.27,.5,1.),vec3(.95,.83,1.),.45+signal.b*.4);
  result+=spineColor*exp(-waveDistance*waveDistance*6500.)*(.18+signal.b*1.65)*signal.a;
  result+=vec3(.2,.38,.9)*exp(-waveDistance*waveDistance*210.)*(.055+signal.b*.48)*signal.a;
  }
  result*=1.-smoothstep(.24,.78,abs(uv.x-.5));
  color=vec4(1.-exp(-result*1.3),1.);
}
`;

export function createMuseumRenderer(canvas: HTMLCanvasElement, onError: (error: string) => void, selectedTheme: ThemeId = initialTheme()) {
  let themeIndex=themes.findIndex(theme=>theme.id===selectedTheme);
  const quality=createQualityController();
  let tier=qualityTiers[quality.status.tier];
  const diagnostics: MuseumDiagnostics = {
    renderer: 'Butterchurn 2.6.7 / WebGL2 tree compositor',
    theme:selectedTheme, quality:quality.status,
    presets: [...themes[themeIndex].names],
    frames: 0, milkFrames: 0, position: 0, paused: false,
    gestureCount: 0, pulseCount: 0, signalEnergy: 0, layerRms: [0,0,0],
    waveformFeed: 'Exact quantized mono spine samples; all preset channels identical',waveformFeedTime:[0,0,0],
    trailFrames: 0, feedbackFrames: 0, feedbackSize: [],
  };
  window.__treeMuseum = diagnostics;
  const context = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL2 is unavailable');
  const gl: WebGL2RenderingContext = context;
  function shader(type: number, source: string) {
    const value = gl!.createShader(type)!;
    gl!.shaderSource(value, source); gl!.compileShader(value);
    if (!gl!.getShaderParameter(value, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(value) || 'Shader compile failed');
    return value;
  }
  const vs=shader(gl.VERTEX_SHADER,vertex);
  const shaders: WebGLShader[]=[vs];
  function makeProgram(source: string) {
    const program=gl.createProgram()!, fs=shader(gl.FRAGMENT_SHADER,source);shaders.push(fs);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.bindAttribLocation(program,0,'aPosition');gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Shader link failed');
    gl.useProgram(program);
    for(let i=0;i<3;i++) gl.uniform1i(gl.getUniformLocation(program,`milk${i}`),i);
    gl.uniform1i(gl.getUniformLocation(program,'signalField'),3);
    gl.uniform1i(gl.getUniformLocation(program,'sharedField'),4);
    gl.uniform1i(gl.getUniformLocation(program,'branchMask'),5);
    return program;
  }
  const program=makeProgram(fragment), feedbackProgram=makeProgram(feedbackFragment), maskProgram=makeProgram(maskFragment);
  const uniforms=new Map([program,feedbackProgram,maskProgram].map(pass=>[pass,{
    theme:gl.getUniformLocation(pass,'theme'),clock:gl.getUniformLocation(pass,'clock'), aspect:gl.getUniformLocation(pass,'aspect'),position:gl.getUniformLocation(pass,'position'),
    feedbackDelta:gl.getUniformLocation(pass,'feedbackDelta'),freshField:gl.getUniformLocation(pass,'freshField'),
  }]));
  const perf=new URLSearchParams(location.search).get('perf')==='1'?createPerformanceMonitor(gl,value=>{diagnostics.performance=value;}):null;
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const attrib = 0;
  gl.enableVertexAttribArray(attrib); gl.vertexAttribPointer(attrib,2,gl.FLOAT,false,0,0);
  const sources = themes[themeIndex].presets.map((preset, index) => {
    const source = document.createElement('canvas');
    const size = tier.source;
    source.width = source.height = size;
    source.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'high-performance'});
    const visualizer = butterchurn.createVisualizer(null,source,{width:size,height:size,pixelRatio:1,textureRatio:1,meshWidth:24,meshHeight:18});
    visualizer.loadPreset(structuredClone(preset),0);
    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0+index); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    return {source,visualizer,texture,lastRender:-1};
  });
  const sampleCount = 1024;
  const audioLevels = {timeByteArray:new Uint8Array(sampleCount),timeByteArrayL:new Uint8Array(sampleCount),timeByteArrayR:new Uint8Array(sampleCount)};
  const signalTexture = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,signalTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const traceRows=16;
  const signalPixels=new Uint8Array(sampleCount*traceRows*4);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,sampleCount,traceRows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  interface SignalFrame { time: number; left: Float32Array; right: Float32Array; envelope: Float32Array }
  interface Pulse { born: number; origin: number; amplitude: number; speed: number; width: number; phase: number; harmonic: number }
  const pulses: Pulse[] = [];
  const history: SignalFrame[] = [];
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
    for(let i=0;i<sampleCount;i++) {
      const y = i/sampleCount*6;
      const phase = y*Math.PI/3;
      let a = Math.sin(phase*9-now*.7)*.13 + Math.sin(phase*23+now*.41)*.055;
      let b = Math.sin(phase*9-now*.7+.18)*.12 + Math.sin(phase*17-now*.37)*.045;
      let envelope = 0;
      for(const pulse of pulses) {
        const age = now-pulse.born;
        if(age<0) continue;
        const distance = wrap(y-pulse.origin-pulse.speed*age+3)-3;
        const strength = Math.exp(-distance*distance/(pulse.width*pulse.width))*Math.exp(-age*.5)*pulse.amplitude;
        envelope += strength;
        const carrier = phase*pulse.harmonic - now*(1.3+pulse.speed*.5)+pulse.phase;
        a += strength*(Math.sin(carrier)*.58+Math.sin(carrier*2-pulse.phase)*.21);
        b += strength*(Math.sin(carrier+.26)*.54+Math.sin(phase*(pulse.harmonic+3)+now*.8)*.18);
      }
      // Soft limiting and explicit byte saturation avoid Uint8Array's modulo overflow.
      left[i] = Math.tanh(a*(1+gestureEnergy*.28));
      right[i] = Math.tanh(b*(1+gestureEnergy*.28));
      energy += left[i]*left[i]+right[i]*right[i];
      envelopes[i]=Math.min(1,envelope);
    }
    diagnostics.signalEnergy = Math.sqrt(energy/(sampleCount*2));
    diagnostics.pulseCount = pulses.length;
    return {time:now,left,right,envelope:envelopes};
  }
  function uploadTraces() {
    signalPixels.fill(0);
    const latest=history[history.length-1];
    if(latest) for(let row=0;row<traceRows;row++) {
      const at=latest.time-row*.06;
      if(at<history[0].time) continue;
      let older=history[0], newer=latest;
      for(let h=history.length-1;h>=0;h--) if(history[h].time<=at) {
        older=history[h];newer=history[Math.min(h+1,history.length-1)];break;
      }
      const amount=newer.time===older.time?0:(at-older.time)/(newer.time-older.time);
      for(let i=0;i<sampleCount;i++) {
        const offset=(row*sampleCount+i)*4;
        const left=older.left[i]+(newer.left[i]-older.left[i])*amount;
        const right=older.right[i]+(newer.right[i]-older.right[i])*amount;
        // One canonical mono waveform: the uploaded bytes are also the actual Butterchurn input.
        signalPixels[offset]=signalPixels[offset+1]=byte(left*.8+right*.2);
        signalPixels[offset+2]=Math.round((older.envelope[i]+(newer.envelope[i]-older.envelope[i])*amount)*255);
        signalPixels[offset+3]=255;
      }
    }
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,signalTexture);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,sampleCount,traceRows,gl.RGBA,gl.UNSIGNED_BYTE,signalPixels);
    diagnostics.trailFrames=history.length;
  }
  function driveLayer(index: number) {
    let energy=0;
    for(let i=0;i<sampleCount;i++) {
      const value=signalPixels[i*4];
      audioLevels.timeByteArray[i]=audioLevels.timeByteArrayL[i]=audioLevels.timeByteArrayR[i]=value;
      energy+=Math.pow((value-128)/127,2);
    }
    diagnostics.layerRms[index]=Math.sqrt(energy/sampleCount);
    diagnostics.waveformFeedTime[index]=history[history.length-1].time;
  }
  function clearExcitation() {
    pulses.length=0;history.length=0;gestureEnergy=0;lastPulse=-1;
    diagnostics.pulseCount=0;uploadTraces();
  }
  let fieldWidth=tier.field[0], fieldHeight=tier.field[1];
  diagnostics.feedbackSize=[fieldWidth,fieldHeight];
  const fields=[0,1].map(()=>{
    const texture=gl.createTexture()!, framebuffer=gl.createFramebuffer()!;
    gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fieldWidth,fieldHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('Shared flow framebuffer unavailable');
    return {texture,framebuffer};
  });
  const maskTexture=gl.createTexture()!, maskFramebuffer=gl.createFramebuffer()!;
  let maskWidth=tier.mask[0], maskHeight=tier.mask[1];
  gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,maskTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,maskWidth,maskHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,maskFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,maskTexture,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('Branch mask framebuffer unavailable');
  let readField=0, fieldReady=false, lastMask=-1;
  let previous = performance.now(), time = 0, lastSignal = -1, request = 0, disposed = false;
  let target = 0, current = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clearFields() {
    gl.clearColor(0,0,0,1);
    for(const field of fields) {gl.bindFramebuffer(gl.FRAMEBUFFER,field.framebuffer);gl.clear(gl.COLOR_BUFFER_BIT);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);fieldReady=false;readField=0;lastMask=-1;
  }
  function bindPass(pass: WebGLProgram) {
    gl.useProgram(pass);
    sources.forEach(({texture},index)=>{gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);});
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,signalTexture);
    gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,fields[readField].texture);
    gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,pass===maskProgram?null:maskTexture);
    const cached=uniforms.get(pass)!;
    gl.uniform1i(cached.theme,themeIndex);gl.uniform1f(cached.clock,time);gl.uniform1f(cached.aspect,innerWidth/innerHeight);gl.uniform1f(cached.position,current);
  }
  const resize = () => {
    const scale=Math.min(devicePixelRatio,tier.scale,tier.display/innerWidth);
    canvas.width=Math.round(innerWidth*scale);canvas.height=Math.round(innerHeight*scale);
    // Aspect changes alter world x extent, so old accumulation is deliberately cleared.
    clearFields();quality.suspend();
  };
  function applyQuality() {
    tier=qualityTiers[quality.status.tier];
    sources.forEach(({source,visualizer,texture},index)=>{
      source.width=source.height=tier.source;visualizer.setRendererSize(tier.source,tier.source);
      gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tier.source,tier.source,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    });
    fieldWidth=tier.field[0];fieldHeight=tier.field[1];maskWidth=tier.mask[0];maskHeight=tier.mask[1];
    for(const field of [...fields,{texture:maskTexture,framebuffer:maskFramebuffer}]) {
      const isMask=field.texture===maskTexture;
      gl.bindTexture(gl.TEXTURE_2D,field.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,isMask?maskWidth:fieldWidth,isMask?maskHeight:fieldHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,field.framebuffer);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('Quality framebuffer unavailable');
    }
    diagnostics.feedbackSize=[fieldWidth,fieldHeight];sources.forEach(source=>{source.lastRender=-1;});resize();
  }
  resize(); addEventListener('resize',resize);
  const fail = (error: unknown) => {
    diagnostics.error = error instanceof Error ? error.message : String(error);
    onError(diagnostics.error);
  };
  function frame(now: number) {
    if(disposed) return;
    const dt = Math.min((now-previous)/1000,.05); previous=now;
    const qualityChanged=quality.record(now,!paused&&!document.hidden&&document.hasFocus());
    if (!document.hidden) {
      const submittedAt=performance.now();perf?.startFrame(now,paused);
      if (!paused) {
        time += dt;gestureEnergy *= Math.exp(-dt*2.4);
        for(let i=pulses.length-1;i>=0;i--) if(time-pulses[i].born>7) pulses.splice(i,1);
      }
      current += (target-current)*Math.min(1,dt*9);
      // Keep scrolling numerically bounded only after easing settles; modulo is continuous in the shader.
      if (Math.abs(target-current)<.00001 && Math.abs(target)>600) { current=((current%6)+6)%6; target=current; }
      diagnostics.position=((current%6)+6)%6; diagnostics.paused=paused;
      try {
        if(qualityChanged) applyQuality();
        if(lastSignal<0 || (!paused && time-lastSignal>=1/60-.0004)) {
          history.push(synthesize(time));uploadTraces();lastSignal=time;
        }
        let destinationsChanged=false;
        // At most two due destinations per display frame; stagger their 30 Hz work instead of three-source bursts.
        for(let slot=0;slot<2;slot++) {
          let index=-1;
          for(let candidate=0;candidate<sources.length;candidate++) {
            const source=sources[candidate];
            if(source.lastRender>=0 && (paused || time-source.lastRender<1/tier.cadence-.0007)) continue;
            if(index<0 || source.lastRender<sources[index].lastRender) index=candidate;
          }
          if(index<0) break;
          const destination=sources[index], elapsed=destination.lastRender<0?1/tier.cadence:Math.min(.1,time-destination.lastRender);
          driveLayer(index);destination.visualizer.render({audioLevels,elapsedTime:elapsed});
          gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,destination.texture);
          gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,destination.source);
          destination.lastRender=time;diagnostics.milkFrames++;destinationsChanged=true;
        }
        perf?.beginGpu();
        if(lastMask<0 || (!paused && time-lastMask>=1/15)) {
          gl.bindFramebuffer(gl.FRAMEBUFFER,maskFramebuffer);gl.viewport(0,0,maskWidth,maskHeight);bindPass(maskProgram);
          gl.drawArrays(gl.TRIANGLES,0,6);lastMask=time;
        }
        if(!fieldReady || !paused || destinationsChanged) {
          const writeField=1-readField;
          gl.bindFramebuffer(gl.FRAMEBUFFER,fields[writeField].framebuffer);
          gl.viewport(0,0,fieldWidth,fieldHeight);bindPass(feedbackProgram);
          gl.uniform1f(uniforms.get(feedbackProgram)!.feedbackDelta,paused?0:dt);
          gl.uniform1f(uniforms.get(feedbackProgram)!.freshField,(!fieldReady || (paused && destinationsChanged))?1:0);
          gl.drawArrays(gl.TRIANGLES,0,6);readField=writeField;fieldReady=true;diagnostics.feedbackFrames++;
        }
        // Camera motion is applied only here; feedback and trace history remain in world coordinates.
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);bindPass(program);
        gl.drawArrays(gl.TRIANGLES,0,6);diagnostics.frames++;
        perf?.endGpu();perf?.endFrame(performance.now()-submittedAt,[canvas.width,canvas.height],[fieldWidth,fieldHeight]);
      } catch(error) { perf?.endGpu();fail(error); return; }
    } else perf?.idle();
    request=requestAnimationFrame(frame);
  }
  request=requestAnimationFrame(frame);
  const lost = (event: Event) => { event.preventDefault(); fail('Graphics context interrupted. Reload to resume.'); };
  canvas.addEventListener('webglcontextlost',lost);
  return {
    move(delta: number) {
      const bounded = Math.max(-2,Math.min(2,Number.isFinite(delta)?delta:0));
      target+=bounded;
      if(paused || document.hidden || Math.abs(bounded)<.0001) return;
      diagnostics.gestureCount++;
      gestureEnergy = Math.min(1,gestureEnergy+Math.abs(bounded)*.85);
      if(lastPulse<0 || time-lastPulse>.14) {
        pulses.push({born:time,origin:wrap(current+2.1),amplitude:.55+Math.min(.7,Math.abs(bounded)*1.2)+random()*.2,
          speed:1.2+random()*.65,width:.18+random()*.16,phase:random()*Math.PI*2,harmonic:10+Math.floor(random()*12)});
        if(pulses.length>10) pulses.shift();lastPulse=time;
      }
    },
    setTheme(value: ThemeId) {
      if(diagnostics.theme===value) return;
      themeIndex=themes.findIndex(theme=>theme.id===value);diagnostics.theme=value;diagnostics.presets=[...themes[themeIndex].names];
      sources.forEach((source,index)=>{source.visualizer.loadPreset(structuredClone(themes[themeIndex].presets[index]),0);source.lastRender=-1;});
      clearFields();quality.suspend();
    },
    get position() { return diagnostics.position; },
    setPaused(value: boolean) { paused=value; diagnostics.paused=value; },
    reset() { target=0; clearExcitation(); clearFields(); lastSignal=-1;sources.forEach(source=>{source.lastRender=-1;}); },
    dispose() {
      disposed=true;cancelAnimationFrame(request);removeEventListener('resize',resize);canvas.removeEventListener('webglcontextlost',lost);
      sources.forEach(({source,texture})=>{gl.deleteTexture(texture); source.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();});
      perf?.dispose();gl.deleteTexture(signalTexture);gl.deleteTexture(maskTexture);gl.deleteFramebuffer(maskFramebuffer);
      fields.forEach(({texture,framebuffer})=>{gl.deleteTexture(texture);gl.deleteFramebuffer(framebuffer);});
      gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteProgram(feedbackProgram);gl.deleteProgram(maskProgram);shaders.forEach(value=>gl.deleteShader(value));
    },
  };
}
