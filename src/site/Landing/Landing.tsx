import { useEffect, useRef, type RefObject } from 'react';
import { t } from '../../i18n/copy';
import { ContactPaths, type ContactTreatment } from './ContactPaths';
import { JunctionContact } from './JunctionContact';
import { mountJunctionCircuit, type JunctionRole } from './junctionCircuit';
import './landing.css';

const fragment = `
precision mediump float;
uniform vec2 size, mouse, origin;
uniform vec3 cool, warm;
uniform float time, age, mode, routed;
uniform vec4 ignition; // chip origin in field coordinates, age (negative at rest), polarity
void main(){
  vec2 p=(gl_FragCoord.xy-size*.5)/size.y;
  float surge=0., crest=0.;
  if(ignition.z>=0. && ignition.z<1.6){
    vec2 ray=p-ignition.xy;
    float radius=length(ray), elapsed=ignition.z;
    float front=radius-elapsed*(.82+.25*elapsed);
    float decay=1.-smoothstep(.38,1.6,elapsed);
    surge=exp(-58.*front*front)*decay;
    float edge=front/.034;
    crest=exp(-edge*edge)*decay;
    // Displace the strands themselves: a single compression front travels out from the die.
    p-=ray/max(radius,.035)*surge*(.15+.045*cos(20.*front));
  }
  float r=length(p-origin);
  float ring=r-age*.48;
  float pulse=sin(26.*ring)*exp(-17.*ring*ring)*exp(-age*1.7);
  float pointer=exp(-5.*dot(p-mouse,p-mouse));
  float x=p.x;
  float bend=.08*sin(x*5.+time*.45)+.045*sin(x*11.-time*.23)+.065*pulse;
  if(mode<1.5) bend+=.13*pointer*mouse.y;
  vec3 color=vec3(0.);
  float coverage=0.;
  for(int i=0;i<18;i++){
    float n=float(i)/17.;
    float y=bend+(.08+n*.17)*sin(4.*x+n*3.-time*.35)+(n-.5)*.23;
    float z=-bend+(.08+n*.17)*sin(4.*x-n*3.+time*.3)+(n-.5)*.23;
    float frontCool=exp(-abs(p.y-y)*200.)*smoothstep(-.85,.35,x);
    float frontWarm=exp(-abs(p.y-z)*200.)*(1.-smoothstep(-.35,.85,x));
    color+=.12*(cool*frontCool+warm*frontWarm);
    coverage=max(coverage,max(frontCool,frontWarm));
  }
  color*=exp(-1.7*abs(x));
  if(mode>.5 && mode<1.5){
    // Keep the center calm for the wordmark and contact links.
    float outsideCopy=smoothstep(.22,.62,abs(x));
    color*=mix(1.08,1.55,outsideCopy);
    // Defocused echoes share the wave displacement, but lag and respond less.
    float lag=.045*sin(x*5.+time*.45-.8)+.024*sin(x*11.-time*.23+.6);
    lag+=.019*pulse+.028*pointer*mouse.y;
    float a=p.y-.28-lag-.08*sin(3.*x-time*.16);
    float b=p.y+.27+lag+.07*sin(3.5*x+time*.14);
    float echoA=exp(-125.*a*a)*exp(-2.5*(x-.36)*(x-.36));
    float echoB=exp(-100.*b*b)*exp(-2.5*(x+.36)*(x+.36));
    vec3 rear=.14*(cool*echoA+warm*echoB);
    color+=rear*(1.-smoothstep(.02,.5,coverage));
  }
  color=color*(1.+3.8*surge)+mix(cool,warm,ignition.w)*(crest*(.22+.85*coverage)+.35*surge*coverage);
  if(routed>.5){
    // Apply Observatory's CSS vignette to the waves only. The circuit printed
    // in the next pass should stay readable all the way out to the edge.
    float u=gl_FragCoord.x/size.x;
    color=clamp(color,0.,1.)*.48*clamp(min(u/.4,(1.-u)/.15),0.,1.);
  }
  gl_FragColor=vec4(color,1.);
}`;

const palettes = {
  'teal-copper': [[.12,.86,.79], [1,.47,.22]],
  'blue-red': [[.19,.39,1], [1,.18,.16]],
  'ice-violet': [[.32,.78,1], [.68,.32,1]],
  'silver-gold': [[.17,.43,1], [1,.62,.12]],
} as const;

type RouteSignal = (role: JunctionRole | null) => boolean;
type FieldProps = {
  variant: string; palette: keyof typeof palettes;
  junction?: RefObject<HTMLDivElement | null>; signal: RefObject<RouteSignal | null>;
};

function Field({ variant, palette, junction, signal }: FieldProps) {
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
    gl.bindAttribLocation(program, 0, 'vertex');
    gl.linkProgram(program);
    const buffer = gl.createBuffer();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, hit = -10000, mx = 0, my = 0, ox = 0, oy = 0;
    const stage = canvas.parentElement!;
    const nav = junction?.current;
    let circuit: ReturnType<typeof mountJunctionCircuit>;
    let ignitionTime = -Infinity, ix = 0, iy = 0, polarity = 0;
    const move = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      mx = (event.clientX - box.left - box.width / 2) / box.height;
      my = (box.top + box.height / 2 - event.clientY) / box.height;
    };
    const tap = (event: PointerEvent) => {
      if ((event.target as Element).closest('a, button, form')) return;
      move(event); ox = mx; oy = my; hit = performance.now();
    };
    const start = performance.now();
    const uniforms = Object.fromEntries(['size', 'mouse', 'origin', 'time', 'age', 'mode', 'ignition', 'routed'].map(key => [key, gl.getUniformLocation(program, key)]));
    const draw = (now: number) => {
      const w = Math.min(1400, Math.round(canvas.clientWidth));
      const h = Math.round(canvas.clientHeight * w / Math.max(1, canvas.clientWidth));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.viewport(0, 0, w, h);
      const elapsed = (now - ignitionTime) / 1000 - .11;
      gl.uniform4f(uniforms.ignition, ix, iy, !motion.matches && elapsed < 1.6 ? elapsed : -1, polarity);
      gl.uniform2f(uniforms.size, w, h);
      gl.uniform2f(uniforms.mouse, motion.matches ? 0 : mx, motion.matches ? 0 : my);
      gl.uniform2f(uniforms.origin, ox, oy);
      gl.uniform1f(uniforms.time, motion.matches || variant === 'standing' ? 0 : (now - start) / 1000);
      gl.uniform1f(uniforms.age, motion.matches ? 10 : Math.min(10, (now - hit) / 1000));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      circuit?.draw(now, motion.matches);
    };
    const loop = (now: number) => { draw(now); frame = requestAnimationFrame(loop); };
    const update = () => { cancelAnimationFrame(frame); if (motion.matches) draw(performance.now()); else frame = requestAnimationFrame(loop); };
    const resize = new ResizeObserver(() => { circuit?.measure(); draw(performance.now()); });
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      const vertex = gl.getAttribLocation(program, 'vertex');
      gl.enableVertexAttribArray(vertex);
      gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uniforms.mode, variant === 'interference' ? 0 : variant === 'observatory' ? 1 : 2);
      const [cool, warm] = palettes[palette];
      gl.uniform3f(gl.getUniformLocation(program, 'cool'), cool[0], cool[1], cool[2]);
      gl.uniform3f(gl.getUniformLocation(program, 'warm'), warm[0], warm[1], warm[2]);
      if (nav) {
        circuit = mountJunctionCircuit(gl, canvas, nav, palettes[palette], () => { if (motion.matches) draw(performance.now()); });
        circuit?.measure();
        if (circuit && variant === 'observatory') {
          canvas.classList.add('opal-field--routed'); gl.useProgram(program); gl.uniform1f(uniforms.routed, 1);
        }
        signal.current = role => {
          circuit?.latch(role);
          const core = nav.querySelector('.die-core')?.getBoundingClientRect(), box = canvas.getBoundingClientRect();
          if (role && core && box.height) {
            ix = (core.left + core.width / 2 - box.left - box.width / 2) / box.height;
            iy = (box.top + box.height / 2 - core.top - core.height / 2) / box.height;
            ignitionTime = performance.now(); polarity = role === 'accelerator' ? 1 : 0;
          } else ignitionTime = -Infinity;
          if (motion.matches) draw(performance.now());
          return !motion.matches && Number.isFinite(ignitionTime) && !gl.isContextLost();
        };
        // Font swaps, form expansion, browser zoom and viewport rotation can all move the die.
        resize.observe(nav); resize.observe(nav.closest('.opal-intro')!);
      }
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
      signal.current = null; circuit?.dispose(); canvas.classList.remove('opal-field--routed');
      gl.deleteProgram(program); gl.deleteBuffer(buffer);
      for (const shader of shaders) gl.deleteShader(shader);
    };
  }, [variant, palette, junction, signal]);
  return <canvas className="opal-field" ref={ref} aria-hidden="true" />;
}

type LandingProps = {
  variant?: 'interference' | 'observatory' | 'standing';
  palette?: keyof typeof palettes;
  labels?: ContactTreatment;
};

export function Landing({ variant = 'interference', palette = variant === 'interference' ? 'blue-red' : 'teal-copper', labels = 'original' }: LandingProps) {
  const junction = useRef<HTMLDivElement>(null), signal = useRef<RouteSignal | null>(null);
  return <main className={`opal opal--${variant} opal-palette--${palette}`}>
    <Field variant={variant} palette={palette} junction={labels === 'junction' ? junction : undefined} signal={signal} />
    <section className="opal-intro">
      <h1>{t('landing.brand')}</h1>
      <p className="opal-tagline">{t('landing.description')}</p>
      {labels === 'junction'
        ? <JunctionContact junctionRef={junction} onRoute={role => signal.current?.(role) ?? false} />
        : <ContactPaths treatment={labels} />}
    </section>
  </main>;
}
