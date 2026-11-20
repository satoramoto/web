import { useEffect, useRef } from 'react';
import { t } from '../../i18n/copy';
import './opal.css';

const fragment = `
precision mediump float;
uniform vec2 size, mouse, origin;
uniform float time, age, mode;
void main(){
  vec2 p=(gl_FragCoord.xy-size*.5)/size.y;
  float r=length(p-origin);
  float pulse=sin(26.*(r-age*.48))*exp(-17.*pow(r-age*.48,2.))*exp(-age*1.7);
  float pointer=exp(-5.*dot(p-mouse,p-mouse));
  float x=p.x;
  float bend=.08*sin(x*5.+time*.45)+.045*sin(x*11.-time*.23)+.065*pulse;
  if(mode<1.5) bend+=.13*pointer*mouse.y;
  vec3 color=vec3(0.);
  for(int i=0;i<18;i++){
    float n=float(i)/17.;
    float y=bend+(.08+n*.17)*sin(4.*x+n*3.-time*.35)+(n-.5)*.23;
    float z=-bend+(.08+n*.17)*sin(4.*x-n*3.+time*.3)+(n-.5)*.23;
    vec3 blue=mix(vec3(.19,.39,1.),vec3(.12,.86,.79),step(.5,mode));
    vec3 red=mix(vec3(1.,.18,.16),vec3(1.,.47,.22),step(.5,mode));
    color+=blue*.12*exp(-abs(p.y-y)*200.)*smoothstep(-.85,.35,x);
    color+=red*.12*exp(-abs(p.y-z)*200.)*(1.-smoothstep(-.35,.85,x));
  }
  gl_FragColor=vec4(color*exp(-1.7*abs(x)),1.);
}`;

function Field({ variant }: { variant: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;
    const program = gl.createProgram()!;
    const shaders = [gl.createShader(gl.VERTEX_SHADER)!, gl.createShader(gl.FRAGMENT_SHADER)!];
    gl.shaderSource(shaders[0], 'attribute vec2 vertex; void main(){gl_Position=vec4(vertex,0.,1.);}');
    gl.shaderSource(shaders[1], fragment);
    for (const shader of shaders) { gl.compileShader(shader); gl.attachShader(program, shader); }
    gl.linkProgram(program);
    const buffer = gl.createBuffer();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, hit = -10000, mx = 0, my = 0, ox = 0, oy = 0;
    const stage = canvas.parentElement!;
    const move = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      mx = (event.clientX - box.left - box.width / 2) / box.height;
      my = (box.top + box.height / 2 - event.clientY) / box.height;
    };
    const tap = (event: PointerEvent) => {
      if ((event.target as Element).closest('a')) return;
      move(event); ox = mx; oy = my; hit = performance.now();
    };
    const start = performance.now();
    const uniforms = Object.fromEntries(['size', 'mouse', 'origin', 'time', 'age', 'mode'].map(key => [key, gl.getUniformLocation(program, key)]));
    const draw = (now: number) => {
      const w = Math.min(1400, Math.round(canvas.clientWidth));
      const h = Math.round(canvas.clientHeight * w / Math.max(1, canvas.clientWidth));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uniforms.size, w, h);
      gl.uniform2f(uniforms.mouse, motion.matches ? 0 : mx, motion.matches ? 0 : my);
      gl.uniform2f(uniforms.origin, ox, oy);
      gl.uniform1f(uniforms.time, motion.matches || variant === 'standing' ? 0 : (now - start) / 1000);
      gl.uniform1f(uniforms.age, motion.matches ? 10 : Math.min(10, (now - hit) / 1000));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => { draw(now); frame = requestAnimationFrame(loop); };
    const update = () => { cancelAnimationFrame(frame); if (motion.matches) draw(performance.now()); else frame = requestAnimationFrame(loop); };
    const resize = new ResizeObserver(() => draw(performance.now()));
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      const vertex = gl.getAttribLocation(program, 'vertex');
      gl.enableVertexAttribArray(vertex);
      gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uniforms.mode, variant === 'interference' ? 0 : variant === 'observatory' ? 1 : 2);
      stage.addEventListener('pointermove', move);
      stage.addEventListener('pointerdown', tap);
      motion.addEventListener('change', update);
      resize.observe(canvas);
      update();
    }
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      motion.removeEventListener('change', update);
      stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerdown', tap);
      gl.deleteProgram(program); gl.deleteBuffer(buffer);
      for (const shader of shaders) gl.deleteShader(shader);
    };
  }, [variant]);
  return <canvas className="opal-field" ref={ref} aria-hidden="true" />;
}

export function Opal({ variant = 'interference' }: { variant?: 'interference' | 'observatory' | 'standing' }) {
  return <main className={`opal opal--${variant}`}>
    <Field variant={variant} />
    <header className="opal-masthead"><span>{t('opal.brand')}</span><span>{t('opal.platform')}</span></header>
    <section className="opal-intro">
      <h1>{t('opal.headline')}</h1>
      <p>{t('opal.description')}</p>
    </section>
    <footer className="opal-paths">
      <a href="mailto:hello@satoramoto.com?subject=I%20need%20compute"><span>{t('opal.visionary')}</span><strong>{t('opal.need')} <i aria-hidden="true">↗</i></strong></a>
      <a href="mailto:hello@satoramoto.com?subject=I%20have%20compute"><span>{t('opal.accelerator')}</span><strong>{t('opal.have')} <i aria-hidden="true">↗</i></strong></a>
    </footer>
  </main>;
}
