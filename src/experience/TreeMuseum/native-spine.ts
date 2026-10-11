import type { ThemeId } from './themes';

type Values=Record<string,number>;
type Equation=(values:Values)=>Values;
interface AuthoredPart {baseVals:Values;init_eqs_str?:string;frame_eqs_str?:string;point_eqs_str?:string}
interface AuthoredPreset extends AuthoredPart {pixel_eqs_str?:string;shapes:AuthoredPart[];waves:AuthoredPart[];warp:string;comp:string}
export interface NativeSpineInput {
  samples:Int8Array;envelope:Float32Array;time:number;position:number;worldWidth:number;theme:ThemeId;injecting:boolean;onDeposit:()=>void;
}
const compile=(source=''):Equation=>new Function('a',`${source}; return a;`) as Equation;
export function createNativeSpinePreset(authored:unknown) {
  const preset=structuredClone(authored) as AuthoredPreset;
  const frame=compile(preset.frame_eqs_str);
  return {...preset,
    init_eqs:compile(preset.init_eqs_str),
    frame_eqs:frame,
    pixel_eqs:preset.pixel_eqs_str?compile(preset.pixel_eqs_str):'',
    // Preserve all authored callbacks and slots, including shared-buffer side effects.
    waves:preset.waves.map(wave=>({...wave,init_eqs:compile(wave.init_eqs_str),frame_eqs:compile(wave.frame_eqs_str),point_eqs:wave.point_eqs_str?compile(wave.point_eqs_str):''})),
    shapes:preset.shapes.map(shape=>({...shape,init_eqs:compile(shape.init_eqs_str),frame_eqs:compile(shape.frame_eqs_str)})),
  };
}
interface WaveDrawer {drawCustomWaveform:(...args:unknown[])=>void;generateWaveform:(...args:unknown[])=>boolean}
interface NativeStage {basicWaveform:{drawBasicWaveform:(...args:unknown[])=>void};customWaveforms:WaveDrawer[];texsizeX:number;texsizeY:number}
export function installNativeSpine(gl:WebGL2RenderingContext,renderer:NativeStage,input:NativeSpineInput) {
  const original=renderer.basicWaveform.drawBasicWaveform;
  const originals=renderer.customWaveforms.map(wave=>wave.drawCustomWaveform);
  renderer.customWaveforms.forEach(wave=>{wave.drawCustomWaveform=(...args)=>{const [,left,right,freqL,freqR,globals,equations,part]=args;if(part) wave.generateWaveform(left,right,freqL,freqR,globals,equations,part,0);};});
  const shader=(type:number,source:string)=>{const value=gl.createShader(type)!;gl.shaderSource(value,source);gl.compileShader(value);if(!gl.getShaderParameter(value,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(value)||'Native spine compile failed');return value;};
  const vs=shader(gl.VERTEX_SHADER,`#version 300 es\nin vec2 point;in vec3 tint;out vec3 color;uniform float offset;void main(){gl_Position=vec4(point+vec2(offset,0.),0.,1.);color=tint;}`);
  const fs=shader(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec3 color;out vec4 outputColor;uniform float alpha;uniform float core;void main(){outputColor=vec4(mix(color,vec3(.88,.94,1.),core),alpha);}`);
  const program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.bindAttribLocation(program,0,'point');gl.bindAttribLocation(program,1,'tint');gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Native spine link failed');
  const vao=gl.createVertexArray()!,buffer=gl.createBuffer()!;const points=new Float32Array((input.samples.length+1)*5);
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,points.byteLength,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,20,8);gl.bindVertexArray(null);
  const offset=gl.getUniformLocation(program,'offset'),alpha=gl.getUniformLocation(program,'alpha'),core=gl.getUniformLocation(program,'core');
  renderer.basicWaveform.drawBasicWaveform=()=>{
    if(!input.injecting)return;input.onDeposit();
    const colors:Record<ThemeId,number[]>={prism:[.4,.6,1],garden:[.3,.86,.66],horizon:[.72,.5,1]},color=colors[input.theme];
    for(let i=0;i<=input.samples.length;i++){
      const screenY=i/input.samples.length*6,y=((screenY+input.position)%6+6)%6;
      const sample=y/6*input.samples.length,index=Math.floor(sample)%input.samples.length,next=(index+1)%input.samples.length,fraction=sample-Math.floor(sample);
      const signed=(input.samples[index]*(1-fraction)+input.samples[next]*fraction)/128;
      // Native comp flips framebuffer UV.y; deposit bottom-up so displayed s=0 is the top.
      points[i*5]=2*signed*.65/input.worldWidth;points[i*5+1]=2*screenY/6-1;
      for(let channel=0;channel<3;channel++)points[i*5+2+channel]=color[channel]+input.envelope[Math.floor(y/6*input.envelope.length)%input.envelope.length]*.08;
    }
    const previousVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING),previousProgram=gl.getParameter(gl.CURRENT_PROGRAM),previousBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const blend=gl.isEnabled(gl.BLEND),eqRgb=gl.getParameter(gl.BLEND_EQUATION_RGB),eqAlpha=gl.getParameter(gl.BLEND_EQUATION_ALPHA),srcRgb=gl.getParameter(gl.BLEND_SRC_RGB),dstRgb=gl.getParameter(gl.BLEND_DST_RGB),srcAlpha=gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha=gl.getParameter(gl.BLEND_DST_ALPHA);
    gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,points);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(core,0);gl.uniform1f(alpha,.15);
    for(const dx of [-3,-2,-1,1,2,3]){gl.uniform1f(offset,dx*2/renderer.texsizeX);gl.drawArrays(gl.LINE_STRIP,0,input.samples.length+1);}
    gl.uniform1f(core,1);gl.uniform1f(alpha,.94);gl.uniform1f(offset,0);gl.drawArrays(gl.LINE_STRIP,0,input.samples.length+1);
    gl.bindVertexArray(previousVao);gl.useProgram(previousProgram);gl.bindBuffer(gl.ARRAY_BUFFER,previousBuffer);gl.blendEquationSeparate(eqRgb,eqAlpha);gl.blendFuncSeparate(srcRgb,dstRgb,srcAlpha,dstAlpha);if(!blend)gl.disable(gl.BLEND);
  };
  return ()=>{renderer.basicWaveform.drawBasicWaveform=original;renderer.customWaveforms.forEach((wave,index)=>{wave.drawCustomWaveform=originals[index];});gl.deleteVertexArray(vao);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
}
