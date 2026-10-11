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
uniform float clock;
uniform float position;
uniform float aspect;
const float PI = 3.14159265;
float loopDistance(float a, float b) { return mod(a-b+3.,6.)-3.; }
float trunk(float y) { return .32*sin(y*PI/3.+.4) + .15*sin(y*PI+clock*.07); }
void main() {
  vec2 p = vec2((uv.x-.5)*max(3.9,aspect*3.25), (1.-uv.y)*6.+position);
  float y = mod(p.y,6.);
  float x = p.x;
  float stem = trunk(y);
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
    sampleUV += vec2(.035*sin(y*2.+clock*.08), clock*.005);
    vec3 milk;
    if(j==0) milk=texture(milk0,fract(sampleUV)).rgb;
    else if(j==1) milk=texture(milk1,fract(sampleUV)).rgb;
    else milk=texture(milk2,fract(sampleUV)).rgb;
    float lum = dot(milk,vec3(.3,.5,.2));
    vec3 tint = j==0 ? vec3(.47,.26,1.) : j==1 ? vec3(.08,.4,1.) : vec3(1.,.43,.26);
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
    result += mix(tint*lum,milk*tint,.4)*textureMask*.85;
    result += tint*halo*nodeMask*.024;
    // Small luminous eddies curl around each meeting point.
    float spiralLine = pow(max(0.,sin(angle*5.-radius*22.+clock*.22)),18.);
    result += tint*spiralLine*exp(-radius*3.2)*(.15+lum*.7);
    result += mix(tint,vec3(.8,.88,1.),.65)*exp(-radius*radius*190.)*.58;
  }
  float filaments = pow(max(0.,sin((x-stem)*84.+sin(y*8.+clock*.4)*1.5)),14.);
  result += vec3(.16,.32,.75)*filaments*exp(-stemDist*stemDist*18.)*.12;
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
  const audioLevels = {timeByteArray:new Uint8Array(1024),timeByteArrayL:new Uint8Array(1024),timeByteArrayR:new Uint8Array(1024)};
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
      if (!paused) time += dt;
      current += (target-current)*Math.min(1,dt*9);
      // Keep scrolling numerically bounded only after easing settles; modulo is continuous in the shader.
      if (Math.abs(target-current)<.00001 && Math.abs(target)>600) { current=((current%6)+6)%6; target=current; }
      diagnostics.position=((current%6)+6)%6; diagnostics.paused=paused;
      try {
        if (lastMilk<0 || (!paused && time-lastMilk>1/30)) {
          const elapsed = lastMilk<0 ? 1/30 : Math.min(.1,time-lastMilk);
          for(let i=0;i<1024;i++) {
            const s=i/1024;
            const a=Math.sin(s*Math.PI*32+time*.8)*.24+Math.sin(s*Math.PI*73-time*.6)*.14;
            const b=Math.sin(s*Math.PI*48+time*.5)*.2+Math.sin(s*Math.PI*19+time*.3)*.1;
            const swell=.68+Math.sin(time*.31)*.12;
            audioLevels.timeByteArrayL[i]=128+a*swell*127;
            audioLevels.timeByteArrayR[i]=128+b*swell*127;
            audioLevels.timeByteArray[i]=128+(a+b)*swell*63;
          }
          sources.forEach(({source,visualizer,texture},index)=>{
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
    move(delta: number) { target+=delta; },
    get position() { return diagnostics.position; },
    setPaused(value: boolean) { paused=value; diagnostics.paused=value; },
    reset() { target=0; },
    dispose() {
      disposed=true;cancelAnimationFrame(request);removeEventListener('resize',resize);canvas.removeEventListener('webglcontextlost',lost);
      sources.forEach(({source,texture})=>{gl.deleteTexture(texture); source.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();});
      gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    },
  };
}
