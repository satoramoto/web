import { junctionTraces } from './junctionTraces';

type RGB = readonly [number, number, number];
export type JunctionRole = 'visionary' | 'accelerator';
type Zone = JunctionRole | 'both' | null;

const vertexSource = `
attribute vec4 vertex, segment;
uniform vec2 viewport;
varying mediump vec2 local;
varying mediump vec4 wire;
void main() {
  vec2 uv=vertex.xy/viewport;
  gl_Position=vec4(2.*uv.x-1.,1.-2.*uv.y,0.,1.);
  local=vertex.zw;
  wire=segment;
}`;

const fragmentSource = `
precision mediump float;
varying vec2 local;
varying vec4 wire;
uniform vec2 power, head;
uniform vec3 blue, gold;
void main() {
  float amber=step(0.,wire.w);
  float energy=mix(power.x,power.y,amber)*abs(wire.w);
  if(energy<.001) discard;
  float along=clamp(local.x,0.,max(wire.x,0.));
  float d=length(vec2(local.x-along,local.y));
  if(wire.x<0.) d=abs(d-3.); // annular via
  float s=wire.y+along*wire.z;
  float behind=mix(head.x,head.y,amber)-mix(1.-s,s,amber);
  float packet=exp2(-abs(behind)*(behind<0.?65.:13.));
  float core=1.-smoothstep(.3,1.3,d);
  float bloom=exp2(-d*d*.085);
  vec3 tint=mix(blue,gold,amber);
  vec3 light=tint*(.44*core+.08*bloom)+packet*(mix(tint,vec3(1.),.68)*core+.48*tint*bloom);
  gl_FragColor=vec4(light*energy,0.);
}`;

// A second draw pass in the wave field's context. No render target, animation
// loop, or full-screen fragment work of its own; only the narrow wires are drawn.
export function mountJunctionCircuit(gl: WebGLRenderingContext, canvas: HTMLCanvasElement, nav: HTMLElement,
  [blue, gold]: readonly [RGB, RGB], invalidateStill: () => void) {
  const program = gl.createProgram();
  if (!program) return;
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type);
    if (!shader) { gl.deleteProgram(program); return; }
    gl.shaderSource(shader, source); gl.compileShader(shader);
    gl.attachShader(program, shader); gl.deleteShader(shader);
  }
  gl.bindAttribLocation(program, 0, 'vertex'); gl.bindAttribLocation(program, 1, 'segment');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return; }
  const buffer = gl.createBuffer();
  if (!buffer) { gl.deleteProgram(program); return; }
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const viewport = uniform('viewport'), power = uniform('power'), head = uniform('head');
  gl.useProgram(program);
  gl.uniform3f(uniform('blue'), blue[0], blue[1], blue[2]);
  gl.uniform3f(uniform('gold'), gold[0], gold[1], gold[2]);

  let count = 0, last = performance.now(), selected: Zone = null, hovered: Zone = null, focused: Zone = null;
  let latched: JunctionRole | null = null;
  const channels = (['visionary', 'accelerator'] as const).map(role => ({ role, level: 0, target: 0, start: last }));
  function measure() {
    const rect = canvas.getBoundingClientRect(), mesh = junctionTraces(nav, rect);
    count = mesh.length / 8;
    gl.useProgram(program); gl.uniform2f(viewport, rect.width, rect.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
  }
  function select(zone: Zone) {
    zone = latched ?? zone;
    if (zone === selected) return;
    selected = zone;
    if (zone) nav.dataset.signal = zone; else delete nav.dataset.signal;
    for (const ch of channels) {
      const target = zone === ch.role ? 1 : zone === 'both' ? .76 : 0;
      if (target && !ch.target) ch.start = performance.now();
      ch.target = target;
    }
    invalidateStill();
  }
  function zoneAt(node: EventTarget | null): Zone {
    if (!(node instanceof Element) || !nav.contains(node)) return null;
    if (node.closest('.junction-die')) return 'both';
    const role = node.closest<HTMLElement>('[data-role]')?.dataset.role;
    return role === 'visionary' || role === 'accelerator' ? role : null;
  }
  const events = new AbortController();
  const options = { signal: events.signal };
  const point = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') { hovered = zoneAt(event.target); select(hovered ?? focused); }
  };
  nav.addEventListener('pointerover', point, options);
  nav.addEventListener('pointermove', point, options);
  nav.addEventListener('pointerout', event => {
    if (event.pointerType !== 'touch') { hovered = zoneAt(event.relatedTarget); select(hovered ?? focused); }
  }, options);
  nav.addEventListener('focusin', event => { focused = zoneAt(event.target); select(focused ?? hovered); }, options);
  nav.addEventListener('focusout', event => { focused = zoneAt(event.relatedTarget); select(focused ?? hovered); }, options);
  nav.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') select(zoneAt(event.target)); }, options);
  const release = (event: PointerEvent) => { if (event.pointerType === 'touch') select(focused ?? hovered); };
  window.addEventListener('pointerup', release, options);
  window.addEventListener('pointercancel', release, options);
  // Controls and hot reload can mount the pass underneath an already-stationary pointer.
  hovered = zoneAt(nav.querySelector('[data-role]:hover, .junction-die:hover'));
  focused = zoneAt(document.activeElement); select(focused ?? hovered);

  function draw(now: number, still: boolean) {
    const dt = Math.min(.15, Math.max(0, now - last) / 1000); last = now;
    for (const ch of channels) {
      ch.level = still ? ch.target : ch.level + (ch.target - ch.level) * (1 - Math.exp(-dt * (ch.target ? 25 : 12)));
      if (ch.level < .002 && !ch.target) ch.level = 0;
    }
    const [input, output] = channels;
    if (!count || !(input.level || output.level) || nav.closest('[inert]')) return;
    const phase = (start: number) => still ? -4 : ((now - start) % 1850) / (latched ? 175 : 1220) - .04;
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.uniform2f(power, input.level, output.level); gl.uniform2f(head, phase(input.start), phase(output.start));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, 0, count);
    gl.disable(gl.BLEND); gl.disableVertexAttribArray(1);
  }
  function latch(role: JunctionRole | null) {
    latched = role;
    select(role ?? hovered ?? focused);
    if (role) {
      const ch = channels.find(ch => ch.role === role)!;
      ch.start = performance.now(); ch.level = ch.target = 1.6;
    }
  }
  return { measure, draw, latch, dispose() {
    events.abort(); delete nav.dataset.signal;
    gl.deleteBuffer(buffer); gl.deleteProgram(program);
  } };
}
