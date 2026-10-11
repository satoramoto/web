import butterchurn from 'butterchurn';
import astral from './presets/astral.json';
import spiral from './presets/spiral.json';
import cascade from './presets/cascade.json';

export interface MuseumDiagnostics {
  renderer: string;
  presets: string[];
  frames: number;
  milkFrames: number;
  position: number;
  paused: boolean;
  gestureCount: number;
  pulseCount: number;
  signalEnergy: number;
  layerRms: number[];
  error?: string;
}
declare global { interface Window { __treeMuseum?: MuseumDiagnostics } }

const vertex = `#version 300 es
in vec2 aPosition;
out vec2 uv;
void main() { uv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }`;
const fragment = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D milk0;
uniform sampler2D milk1;
uniform sampler2D milk2;
uniform sampler2D signalField;
uniform float clock;
uniform float position;
uniform float aspect;
const float PI = 3.14159265;
float loopDistance(float a, float b) { return mod(a-b+3.,6.)-3.; }
float trunk(float y) { return .32*sin(y*PI/3.+.4) + .15*sin(y*PI+clock*.07); }
vec3 sampleLayer(int layer, vec2 coord) {
  // Mirror the sampling domain to soften texture edges under mutual displacement.
  vec2 reflected = 1.-abs(mod(coord,2.)-1.);
  if(layer==0) return texture(milk0,reflected).rgb;
  if(layer==1) return texture(milk1,reflected).rgb;
  return texture(milk2,reflected).rgb;
}
vec3 layerTint(int layer) {
  return layer==0 ? vec3(.47,.26,1.) : layer==1 ? vec3(.08,.4,1.) : vec3(1.,.43,.26);
}
void main() {
  vec2 p = vec2((uv.x-.5)*max(3.9,aspect*3.25), (1.-uv.y)*6.+position);
  float y = mod(p.y,6.);
  float x = p.x;
  float stem = trunk(y);
  vec4 signal = texture(signalField,vec2(y/6.,.5));
  float waveform = (signal.r*2.-1.)*.24 + (signal.g*2.-1.)*.06;
  float pulse = signal.b;
  float stemDist = abs(x-stem);
  float mainGlow = exp(-stemDist*stemDist*110.);
  float halo = exp(-stemDist*stemDist*5.);
  vec3 result = vec3(.001,.002,.006);
  for(int j=0;j<3;j++) {
    float node = 1.+float(j)*2.;
    float dy = loopDistance(y,node);
    float origin = trunk(node);
    float dx = x-origin;
    float radius = length(vec2(dx,dy*.85));
    float angle = atan(dy,dx);
    vec2 sampleUV = vec2(.5) + vec2(cos(angle+radius*.9+clock*.035),sin(angle+radius*.9+clock*.035))*radius*.19;
    sampleUV += vec2(.035*sin(y*(2.*PI/3.)+clock*.08), clock*.005);
    int previousLayer = (j+2)%3;
    int nextLayer = (j+1)%3;
    vec3 previousMilk = sampleLayer(previousLayer,sampleUV*.93+vec2(.025,.018));
    vec3 nextMilk = sampleLayer(nextLayer,sampleUV*.93-vec2(.025,.018));
    float previousLight = dot(previousMilk,vec3(.3,.5,.2));
    float nextLight = dot(nextMilk,vec3(.3,.5,.2));
    float overlap = exp(-dy*dy*.3);
    // Each live neighbor displaces this layer, rather than only adding an independent glow.
    sampleUV += vec2(previousLight-nextLight,previousLight+nextLight-.5)*(.026+.02*pulse)*overlap;
    vec3 milk = sampleLayer(j,sampleUV);
    float lum = dot(milk,vec3(.3,.5,.2));
    vec3 tint = layerTint(j);
    float branch = 0.;
    float fine = 0.;
    for(int b=0;b<18;b++) {
      float side = mod(float(b),2.)*2.-1.;
      float n = floor(float(b)*.5)/8.;
      float reach = max(0.,dx*side);
      float growth = pow(reach,.68);
      float direction = j==2 ? 1. : -1.;
      float curve = direction*growth*(.45+n*1.12);
      curve += .065*sin(reach*5.+n*9.+clock*.15)*reach;
      float d = abs(dy-curve);
      float domain = smoothstep(0.,.12,reach)*exp(-reach*.43)*(1.-smoothstep(2.2,2.85,abs(dy)));
      branch += exp(-d*d*1000.)*domain;
      fine += exp(-d*d*32.)*domain;
    }
    // The real preset texture fills the branches; stable filaments provide spatial continuity.
    float nodeMask = exp(-dy*dy*.58);
    float textureMask = min(1.,fine*.28 + halo*.7)*nodeMask;
    result += tint*(branch*.44*(.6+lum*1.6)+mainGlow*.36*nodeMask);
    vec3 ownLight = mix(tint*lum,milk*tint,.4);
    vec3 neighboringLight = previousMilk*layerTint(previousLayer)+nextMilk*layerTint(nextLayer);
    result += mix(ownLight,neighboringLight*.5,.17*overlap)*textureMask*.92;
    result += tint*halo*nodeMask*.024;
    // Small luminous eddies curl around each meeting point.
    float spiralLine = pow(max(0.,sin(angle*5.-radius*22.+clock*.22)),18.);
    result += tint*spiralLine*exp(-radius*3.2)*(.15+lum*.7);
    result += mix(tint,vec3(.8,.88,1.),.65)*exp(-radius*radius*190.)*.58;
  }
  float filaments = pow(max(0.,sin((x-stem)*84.+sin(y*(8.*PI/3.)+clock*.4)*1.5)),14.);
  result += vec3(.16,.32,.75)*filaments*exp(-stemDist*stemDist*18.)*.12;
  // A visible virtual waveform: the shared signed stereo synthesis also feeds MilkDrop.
  float waveDistance = abs(x-stem-waveform);
  vec3 spineColor = mix(vec3(.27,.5,1.),vec3(.95,.83,1.),.45+pulse*.4);
  result += spineColor*exp(-waveDistance*waveDistance*6500.)*(.34+pulse*2.2);
  result += vec3(.2,.38,.9)*exp(-waveDistance*waveDistance*210.)*(.055+pulse*.48);
  float vignette = (1.-smoothstep(.24,.78,abs(uv.x-.5)));
  result *= vignette;
  result = 1.-exp(-result*1.3);
  color = vec4(result,1.);
}`;

export function createMuseumRenderer(canvas: HTMLCanvasElement, onError: (error: string) => void) {
  const diagnostics: MuseumDiagnostics = {
    renderer: 'Butterchurn 2.6.7 / WebGL2 tree compositor',
    presets: ['Flexi + Martin - astral projection', 'Geiss - Spiral Artifact', 'Flexi + Martin - cascading decay swing'],
    frames: 0, milkFrames: 0, position: 0, paused: false,
    gestureCount: 0, pulseCount: 0, signalEnergy: 0, layerRms: [0,0,0],
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
  const program = gl.createProgram()!;
  const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
  gl.useProgram(program);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const attrib = gl.getAttribLocation(program,'aPosition');
  gl.enableVertexAttribArray(attrib); gl.vertexAttribPointer(attrib,2,gl.FLOAT,false,0,0);
  const sources = [astral,spiral,cascade].map((preset, index) => {
    const source = document.createElement('canvas');
    const size = matchMedia('(max-width: 700px)').matches ? 256 : 384;
    source.width = source.height = size;
    const visualizer = butterchurn.createVisualizer(null,source,{width:size,height:size,pixelRatio:1,textureRatio:1});
    visualizer.loadPreset(structuredClone(preset),0);
    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0+index); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program,`milk${index}`),index);
    return {source,visualizer,texture};
  });
  const sampleCount = 1024;
  const audioLevels = {timeByteArray:new Uint8Array(sampleCount),timeByteArrayL:new Uint8Array(sampleCount),timeByteArrayR:new Uint8Array(sampleCount)};
  const signalTexture = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,signalTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,'signalField'),3);
  const signalPixels = new Uint8Array(sampleCount*4);
  interface SignalFrame { time: number; left: Float32Array; right: Float32Array }
  interface Pulse { born: number; origin: number; amplitude: number; speed: number; width: number; phase: number; harmonic: number }
  const pulses: Pulse[] = [];
  const history: SignalFrame[] = [];
  const filters = sources.map(()=>({left:new Float32Array(sampleCount),right:new Float32Array(sampleCount)}));
  let gestureEnergy = 0, lastPulse = -1, randomState = 0x62f37a;
  const random = () => {
    randomState ^= randomState<<13;randomState ^= randomState>>>17;randomState ^= randomState<<5;
    return (randomState>>>0)/4294967296;
  };
  const wrap = (value: number) => ((value%6)+6)%6;
  const byte = (value: number) => Math.max(0,Math.min(255,Math.round(128+value*127)));
  function synthesize(now: number): SignalFrame {
    const left = new Float32Array(sampleCount), right = new Float32Array(sampleCount);
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
      signalPixels[i*4] = byte(left[i]);signalPixels[i*4+1] = byte(right[i]);
      signalPixels[i*4+2] = Math.round(Math.min(1,envelope)*255);signalPixels[i*4+3] = 255;
    }
    diagnostics.signalEnergy = Math.sqrt(energy/(sampleCount*2));
    diagnostics.pulseCount = pulses.length;
    return {time:now,left,right};
  }
  function driveLayer(index: number, now: number) {
    // Delays read an immutable shared snapshot; filters belong to each destination only.
    let snapshot = history[0];
    for(let h=history.length-1;h>=0;h--) if(history[h].time<=now-index*.16) {snapshot=history[h];break;}
    const filter = filters[index], smoothing = [.68,.43,.28][index];
    let energy = 0;
    for(let i=0;i<sampleCount;i++) {
      filter.left[i] += (snapshot.left[i]-filter.left[i])*smoothing;
      filter.right[i] += (snapshot.right[i]-filter.right[i])*smoothing;
      audioLevels.timeByteArrayL[i]=byte(filter.left[i]);audioLevels.timeByteArrayR[i]=byte(filter.right[i]);
      audioLevels.timeByteArray[i]=byte((filter.left[i]+filter.right[i])*.5);
      energy += filter.left[i]*filter.left[i]+filter.right[i]*filter.right[i];
    }
    diagnostics.layerRms[index] = Math.sqrt(energy/(sampleCount*2));
  }
  function clearExcitation() {
    pulses.length=0;history.length=0;gestureEnergy=0;lastPulse=-1;
    filters.forEach(filter=>{filter.left.fill(0);filter.right.fill(0);});
    diagnostics.pulseCount=0;
  }
  const timeUniform = gl.getUniformLocation(program,'clock');
  const positionUniform = gl.getUniformLocation(program,'position');
  const aspectUniform = gl.getUniformLocation(program,'aspect');
  let previous = performance.now(), time = 0, lastMilk = -1, request = 0, disposed = false;
  let target = 0, current = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio,1.5);
    const maxWidth = 1920;
    const scale = Math.min(dpr,maxWidth/innerWidth);
    canvas.width = Math.round(innerWidth*scale); canvas.height = Math.round(innerHeight*scale);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform1f(aspectUniform,innerWidth/innerHeight);
  };
  resize(); addEventListener('resize',resize);
  const fail = (error: unknown) => {
    diagnostics.error = error instanceof Error ? error.message : String(error);
    onError(diagnostics.error);
  };
  function frame(now: number) {
    if(disposed) return;
    const dt = Math.min((now-previous)/1000,.05); previous=now;
    if (!document.hidden) {
      if (!paused) {
        time += dt;gestureEnergy *= Math.exp(-dt*2.4);
        for(let i=pulses.length-1;i>=0;i--) if(time-pulses[i].born>7) pulses.splice(i,1);
      }
      current += (target-current)*Math.min(1,dt*9);
      // Keep scrolling numerically bounded only after easing settles; modulo is continuous in the shader.
      if (Math.abs(target-current)<.00001 && Math.abs(target)>600) { current=((current%6)+6)%6; target=current; }
      diagnostics.position=((current%6)+6)%6; diagnostics.paused=paused;
      try {
        const signal = synthesize(time);
        gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,signalTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,sampleCount,1,0,gl.RGBA,gl.UNSIGNED_BYTE,signalPixels);
        if (lastMilk<0 || (!paused && time-lastMilk>1/30)) {
          const elapsed = lastMilk<0 ? 1/30 : Math.min(.1,time-lastMilk);
          history.push(signal);
          while(history.length>32) history.shift();
          sources.forEach(({source,visualizer,texture},index)=>{
            driveLayer(index,time);
            visualizer.render({audioLevels,elapsedTime:elapsed*.55});
            gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
          });
          diagnostics.milkFrames++; lastMilk=time;
        }
        gl.useProgram(program);gl.uniform1f(timeUniform,time);gl.uniform1f(positionUniform,current);
        gl.drawArrays(gl.TRIANGLES,0,6);diagnostics.frames++;
      } catch(error) { fail(error); return; }
    }
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
    get position() { return diagnostics.position; },
    setPaused(value: boolean) { if(value && !paused) clearExcitation(); paused=value; diagnostics.paused=value; },
    reset() { target=0; clearExcitation(); },
    dispose() {
      disposed=true;cancelAnimationFrame(request);removeEventListener('resize',resize);canvas.removeEventListener('webglcontextlost',lost);
      sources.forEach(({source,texture})=>{gl.deleteTexture(texture); source.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();});
      gl.deleteTexture(signalTexture);
      gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    },
  };
}
