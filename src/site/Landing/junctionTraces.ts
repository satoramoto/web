type Point = [number, number];
const corners = [[0, -1], [1, -1], [0, 1], [0, 1], [1, -1], [1, 1]] as const;

// Each wire is a strip wide enough for its luminous core and its soft shoulder.
// The last four floats describe the segment and its place along the whole wire.
function wire(mesh: number[], points: Point[], strength: number, via = true) {
  const lengths = points.slice(1).map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
  const total = lengths.reduce((sum, n) => sum + n, 0);
  if (!total) return;
  let start = 0;
  for (const [i, length] of lengths.entries()) {
    if (length < .01) continue;
    const [x, y] = points[i];
    const dx = (points[i + 1][0] - x) / length, dy = (points[i + 1][1] - y) / length;
    for (const [end, side] of corners) {
      const u = end ? length + 10 : -10, v = side * 10;
      mesh.push(x + dx * u - dy * v, y + dy * u + dx * v, u, v, length, start / total, 1 / total, strength);
    }
    start += length;
  }
  if (via) {
    const [x, y] = points[points.length - 1];
    for (const [end, side] of corners) {
      const u = end ? 10 : -10, v = side * 10;
      mesh.push(x + u, y + v, u, v, -1, 1, 0, strength);
    }
  }
}

export function junctionTraces(nav: HTMLElement, field: DOMRect): Float32Array {
  const mesh: number[] = [];
  const die = nav.querySelector<SVGSVGElement>('.junction-die')!;
  const dieMatrix = die.getScreenCTM();
  if (!dieMatrix || !field.width || !field.height) return new Float32Array();
  const pixel = (m: DOMMatrix, x: number, y: number): Point =>
    [m.a * x + m.c * y + m.e - field.left, m.b * x + m.d * y + m.f - field.top];
  const vertices = (line: SVGPolylineElement) => {
    const m = line.getScreenCTM()!;
    return Array.from({ length: line.points.numberOfItems }, (_, i) => {
      const p = line.points.getItem(i);
      return pixel(m, p.x, p.y);
    });
  };

  for (const upper of [true, false]) {
    const role = upper ? 'visionary' : 'accelerator';
    const sign = upper ? -1 : 1; // Blue flows towards the die; amber flows away.
    const route = nav.querySelector<SVGSVGElement>(`[data-role="${role}"] .junction-route`)!;
    const socket = route.querySelector('circle')!;
    const pin = die.querySelector<SVGPolylineElement>(upper ? '.die-pin--upper' : '.die-pin--lower')!;
    // Use the actual SVG vertices, including the lower branch's reflection and
    // the narrower mobile route. The pulse meets the printed terminal exactly.
    wire(mesh, [
      ...vertices(pin), ...vertices(route.querySelector('polyline')!),
      pixel(socket.getScreenCTM()!, socket.cx.baseVal.value, socket.cy.baseVal.value),
    ], sign);

    // Three copper runs emerge from each side of the stack. On a phone the
    // board turns down into the open space below the contacts instead of clipping.
    for (const [lane, reach] of [226, 168, 116].entries()) {
      const [x, y] = pixel(dieMatrix, 4 + lane * 4, (upper ? 18 : 25) + lane * 2);
      const folded = x < 170 && field.height - y > x;
      const scale = Math.min(1, Math.max(0, (folded ? field.height - y - 22 : x - 14) / 226));
      const elbow = x - 12 - lane * 2;
      const rise = 29 - lane * 4, turn = 28 - lane * 4, knee = reach * .54, lead = 12 + lane * 4;
      const stations: Point[] = [[0, 0], [lead, 0], [lead + rise, rise], [knee, rise], [knee + turn, rise + turn], [reach, rise + turn]];
      let runs = stations.map(([u, v]): Point => [x - u * scale, y + sign * v * scale]);
      if (folded) {
        const left = Math.max(4, elbow + (upper ? 0 : 8)), down = y + (upper ? 89 : 65) * scale + lane * 5;
        const tip = left + reach * .72;
        runs = [[x, y], [left + 4, y], [left, y + 4], [left, down - 18], [left + 18, down], [tip - 12, down], [tip, down + 12]];
      }
      wire(mesh, runs, sign * [1, .65, .45][lane]);
    }
  }
  return new Float32Array(mesh);
}
