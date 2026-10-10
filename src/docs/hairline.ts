// A small line renderer for the figures of the docs (decision 180): a shape drawn as thin
// lines, seen from above its right side, the lines hidden behind it dashed. Each shape gives
// the lines to draw (its edges, its outline) and a mesh, only used to know which part of a
// line is hidden.
import type { ShapeDef } from "../compiler/registry/registry";

export type Vec3 = [number, number, number];
type Triangle = [Vec3, Vec3, Vec3];
// A guide is drawn fainter: an equator, not an edge. A line of the ground is not drawn at
// all where something hides it.
type Line = { points: Vec3[]; kind?: "guide" | "ground" };
export type Solid = { lines: Line[]; mesh: Triangle[] };

// The view: turned around the vertical axis, then tilted down. No perspective, like a plan.
export type View = {
  right: Vec3; // the right of the screen
  toward: Vec3; // horizontal, toward the eye
  up: Vec3; // the top of the screen
  eye: Vec3; // from the scene to the eye
  slope: number; // how much the eye looks down
};
export function viewAt(azimuth: number, elevation: number): View {
  const a = (azimuth * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  return {
    right: [Math.cos(a), 0, -Math.sin(a)],
    toward: [Math.sin(a), 0, Math.cos(a)],
    up: [-Math.sin(a) * Math.sin(e), Math.cos(e), -Math.cos(a) * Math.sin(e)],
    eye: [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)],
    slope: Math.tan(e),
  };
}
// Where every figure rests: from above the right side
export const REST = { azimuth: -32, elevation: 28 };
export const REST_VIEW = viewAt(REST.azimuth, REST.elevation);

// Where a drawing sits in its SVG: its box, the size of one unit of the scene, and where
// the origin of the scene goes
export type Frame = { width: number; height: number; scale: number; x: number; y: number };

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// On the screen: x to the right, y down, and how near the eye the point is
export const place = (p: Vec3, frame: Frame, view: View): Vec3 => [
  frame.x + dot(p, view.right) * frame.scale,
  frame.y - dot(p, view.up) * frame.scale,
  dot(p, view.eye),
];

// --- shapes with flat faces: their edges are their lines

function polyhedron(vertices: Vec3[], faces: number[][]): Solid {
  const edges = new Map<string, Line>();
  const mesh: Triangle[] = [];
  for (const face of faces) {
    face.forEach((a, i) => {
      const b = face[(i + 1) % face.length];
      edges.set(a < b ? `${a} ${b}` : `${b} ${a}`, { points: [vertices[a], vertices[b]] });
    });
    for (let i = 1; i + 1 < face.length; i++) mesh.push([vertices[face[0]], vertices[face[i]], vertices[face[i + 1]]]);
  }
  return { lines: [...edges.values()], mesh };
}

// A flat contour pushed back: the prism. The contour is star-shaped around its center.
function extrusion(contour: [number, number][], depth: number): Solid {
  const n = contour.length;
  const front = contour.map(([x, y]): Vec3 => [x, y, depth / 2]);
  const back = contour.map(([x, y]): Vec3 => [x, y, -depth / 2]);
  const lines: Line[] = [];
  const mesh: Triangle[] = [];
  const center = (z: number): Vec3 => [0, 0, z];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    lines.push({ points: [front[i], front[j]] }, { points: [back[i], back[j]] }, { points: [front[i], back[i]] });
    mesh.push([front[i], front[j], back[j]], [front[i], back[j], back[i]], [center(depth / 2), front[i], front[j]], [center(-depth / 2), back[i], back[j]]);
  }
  return { lines, mesh };
}

// --- shapes turned around the vertical axis: a profile, as distances from the axis and heights

type ProfilePoint = { r: number; y: number; nr: number; ny: number }; // with the normal of the profile
type Profile = ProfilePoint[][]; // pieces: smooth inside, a sharp corner between two of them

const straight = (r0: number, y0: number, r1: number, y1: number): ProfilePoint[] => {
  const length = Math.hypot(r1 - r0, y1 - y0);
  const nr = (y0 - y1) / length; // turned a quarter: outward when the profile goes down on the right
  const ny = (r1 - r0) / length;
  return Array.from({ length: 13 }, (_, i) => ({ r: r0 + ((r1 - r0) * i) / 12, y: y0 + ((y1 - y0) * i) / 12, nr, ny }));
};

// An arc of circle around (cr, cy), from an angle to another, counted from the top, clockwise
const arc = (cr: number, cy: number, radius: number, from: number, to: number): ProfilePoint[] =>
  Array.from({ length: 49 }, (_, i) => {
    const angle = ((from + ((to - from) * i) / 48) * Math.PI) / 180;
    return { r: cr + radius * Math.sin(angle), y: cy + radius * Math.cos(angle), nr: Math.sin(angle), ny: Math.cos(angle) };
  });

const AROUND = 72;
// A point of the turned shape; the angle is counted from the right of the screen, toward the eye
const turned = (view: View, r: number, y: number, angle: number): Vec3 => {
  const c = Math.cos(angle) * r;
  const s = Math.sin(angle) * r;
  return [view.right[0] * c + view.toward[0] * s, y, view.right[2] * c + view.toward[2] * s];
};
const ring = (view: View, r: number, y: number): Vec3[] =>
  Array.from({ length: AROUND + 1 }, (_, i) => turned(view, r, y, (i / AROUND) * 2 * Math.PI));

function revolution(view: View, profile: Profile, guides: [number, number][] = []): Solid {
  const lines: Line[] = [];
  const mesh: Triangle[] = [];
  const tan = view.slope;

  for (const piece of profile) {
    // The outline: where the surface turns away from the eye, on the right and on the left.
    // It ends where the surface faces the eye all around: there, both sides meet.
    const right: Vec3[] = [];
    const left: Vec3[] = [];
    const flush = () => {
      if (right.length > 1) lines.push({ points: [...right] }, { points: [...left] });
      right.length = left.length = 0;
    };
    // A flat cap faces up or down everywhere: it has no outline
    const sineOf = ({ nr, ny }: ProfilePoint) => (Math.abs(nr) < 1e-9 ? Infinity : (-ny / nr) * tan);
    const between = (a: ProfilePoint, b: ProfilePoint, t: number): ProfilePoint => ({
      r: a.r + (b.r - a.r) * t,
      y: a.y + (b.y - a.y) * t,
      nr: a.nr + (b.nr - a.nr) * t,
      ny: a.ny + (b.ny - a.ny) * t,
    });
    const add = (p: ProfilePoint, sine: number) => {
      const angle = Math.asin(Math.max(-1, Math.min(1, sine)));
      right.push(turned(view, p.r, p.y, angle));
      left.push(turned(view, p.r, p.y, Math.PI - angle));
    };
    // The point between an outlined point and one that is not, where the outline ends
    const end = (inside: ProfilePoint, outside: ProfilePoint) => {
      let [lo, hi] = [0, 1];
      for (let i = 0; i < 24; i++) {
        const t = (lo + hi) / 2;
        if (Math.abs(sineOf(between(inside, outside, t))) <= 1) lo = t;
        else hi = t;
      }
      const p = between(inside, outside, lo);
      add(p, Math.sign(sineOf(p)));
    };
    const STEPS = 24;
    let previous: ProfilePoint | null = null;
    for (let i = 0; i + 1 < piece.length; i++) {
      for (let k = i === 0 ? 0 : 1; k <= STEPS; k++) {
        const p = between(piece[i], piece[i + 1], k / STEPS);
        const sine = sineOf(p);
        const outlined = Math.abs(sine) <= 1;
        const was = previous !== null && Math.abs(sineOf(previous)) <= 1;
        if (previous && outlined && !was) end(p, previous);
        if (outlined) add(p, sine);
        if (previous && !outlined && was) {
          end(previous, p);
          flush();
        }
        previous = p;
      }
    }
    flush();

    for (let i = 0; i + 1 < piece.length; i++) {
      const a = ring(view, piece[i].r, piece[i].y);
      const b = ring(view, piece[i + 1].r, piece[i + 1].y);
      for (let k = 0; k < AROUND; k++) mesh.push([a[k], a[k + 1], b[k + 1]], [a[k], b[k + 1], b[k]]);
    }
  }

  // A circle where a piece of the profile ends, unless the next one goes on without a turn,
  // like the arcs of a capsule
  const ends = profile.flatMap((piece) => [piece[0], piece[piece.length - 1]]).filter((p) => p.r > 1e-6);
  const seen = new Set<string>();
  for (const end of ends) {
    const key = `${end.r.toFixed(4)} ${end.y.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const here = ends.filter((p) => Math.abs(p.r - end.r) < 1e-6 && Math.abs(p.y - end.y) < 1e-6);
    const smooth = here.length === 2 && here[0].nr * here[1].nr + here[0].ny * here[1].ny > 0.999;
    if (!smooth) lines.push({ points: ring(view, end.r, end.y) });
  }
  for (const [r, y] of guides) lines.push({ points: ring(view, r, y), kind: "guide" });
  return { lines, mesh };
}

// A tube along a line: the path. Its outline is the line, moved by the radius on each side.
function sweep(view: View, center: Vec3[], radius: number): Solid {
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a: Vec3): Vec3 => {
    const length = Math.hypot(...a) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
  };
  const add = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const tangent = (i: number) => unit(add(center[Math.min(center.length - 1, i + 1)], center[Math.max(0, i - 1)], -1));
  const SIDES = 20;
  const rings = center.map((c, i) => {
    const t = tangent(i);
    const side = unit(cross(t, view.eye));
    const other = cross(t, side);
    return Array.from({ length: SIDES + 1 }, (_, k) => {
      const angle = (k / SIDES) * 2 * Math.PI;
      return add(add(c, side, Math.cos(angle) * radius), other, Math.sin(angle) * radius);
    });
  });
  const mesh: Triangle[] = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let k = 0; k < SIDES; k++) mesh.push([rings[i][k], rings[i][k + 1], rings[i + 1][k + 1]], [rings[i][k], rings[i + 1][k + 1], rings[i + 1][k]]);
  }
  const edge = (k: number): Line => ({ points: center.map((c, i) => add(c, unit(cross(tangent(i), view.eye)), k * radius)) });
  return { lines: [edge(1), edge(-1), { points: rings[0] }, { points: rings[rings.length - 1] }], mesh };
}

// Fewer points for the same line: a point is kept when the line would move without it
function simplify(points: Vec3[], tolerance = 0.12): Vec3[] {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let far = 0;
  let index = 0;
  for (let i = 1; i + 1 < points.length; i++) {
    const p = points[i];
    // from the line through both ends; from the end itself when the line closes on itself
    const away =
      length < 1e-6
        ? Math.hypot(p[0] - a[0], p[1] - a[1])
        : Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / length;
    if (away > far) [far, index] = [away, i];
  }
  if (far <= tolerance) return [a, b];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

// --- from a solid to SVG paths

export type Drawing = { visible: string; hidden: string; guide: string; guideHidden: string; ground: string };

const GRID = 3; // depth samples per unit of the drawing: fine enough for a line of 1px

export function draw(solid: Solid, frame: Frame, view: View = REST_VIEW): Drawing {
  const screen = (p: Vec3) => place(p, frame, view);

  // How near the eye the solid is, at each point of the drawing
  const columns = Math.ceil(frame.width * GRID);
  const rows = Math.ceil(frame.height * GRID);
  const nearest = new Float32Array(columns * rows).fill(-Infinity);
  for (const triangle of solid.mesh) {
    const [a, b, c] = triangle.map(screen).map(([x, y, depth]): Vec3 => [x * GRID, y * GRID, depth]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(columns - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(rows - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const wa = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area;
        const wb = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area;
        const wc = 1 - wa - wb;
        if (wa < -0.01 || wb < -0.01 || wc < -0.01) continue;
        const depth = wa * a[2] + wb * b[2] + wc * c[2];
        if (depth > nearest[y * columns + x]) nearest[y * columns + x] = depth;
      }
    }
  }
  // Hidden: something stands clearly nearer the eye, at this point and around it
  const SLACK = 0.06;
  const isHidden = ([x, y, depth]: Vec3) => {
    const cx = Math.round(x * GRID);
    const cy = Math.round(y * GRID);
    let least = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        least = Math.min(least, px < 0 || py < 0 || px >= columns || py >= rows ? -Infinity : nearest[py * columns + px]);
      }
    }
    return least > depth + SLACK;
  };

  const paths: Drawing & { buried: string } = { visible: "", hidden: "", guide: "", guideHidden: "", ground: "", buried: "" };
  const point = (p: Vec3) => `${+p[0].toFixed(1)} ${+p[1].toFixed(1)}`;
  for (const { points, kind } of solid.lines) {
    // Steps of about 1.5 units of the drawing along the line
    const samples: Vec3[] = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const a = screen(points[i]);
      const b = screen(points[i + 1]);
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
      for (let k = 0; k < steps; k++) samples.push(mix(a, b, k / steps));
      if (i + 2 === points.length) samples.push(b);
    }
    const flags = samples.map(isHidden);
    // A run shorter than a dash is not a line: the end of a hidden edge that reaches the
    // outline, a speck. It joins the run before it, or the one after.
    for (let from = 0; from < flags.length; ) {
      let to = from;
      while (to < flags.length && flags[to] === flags[from]) to++;
      if (to - from < 4 && to - from < flags.length) flags.fill(from > 0 ? flags[from - 1] : !flags[from], from, to);
      from = to;
    }
    for (let from = 0; from + 1 < samples.length; ) {
      let to = from + 1;
      while (to + 1 < samples.length && flags[to] === flags[from]) to++;
      // a run ends on the first point of the next one: the two lines touch
      const key =
        kind === "ground" ? (flags[from] ? "buried" : "ground") : kind === "guide" ? (flags[from] ? "guideHidden" : "guide") : flags[from] ? "hidden" : "visible";
      paths[key] += `M${simplify(samples.slice(from, to + 1)).map(point).join("L")}`;
      from = to;
    }
  }
  const { buried: _, ...drawing } = paths;
  return drawing;
}

// --- several solids in one drawing: each hides the lines of the others behind it

export const moved = (solid: Solid, by: Vec3): Solid => {
  const move = (p: Vec3): Vec3 => [p[0] + by[0], p[1] + by[1], p[2] + by[2]];
  return {
    lines: solid.lines.map((line) => ({ ...line, points: line.points.map(move) })),
    mesh: solid.mesh.map((triangle) => triangle.map(move) as Triangle),
  };
};
export const together = (...solids: Solid[]): Solid => ({ lines: solids.flatMap((solid) => solid.lines), mesh: solids.flatMap((solid) => solid.mesh) });

// Rays around a point, flat on the screen: a light
const rays = (view: View, count: number, from: number, to: number): Line[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI;
    const at = (radius: number): Vec3 => [
      (view.right[0] * Math.cos(angle) + view.up[0] * Math.sin(angle)) * radius,
      (view.right[1] * Math.cos(angle) + view.up[1] * Math.sin(angle)) * radius,
      (view.right[2] * Math.cos(angle) + view.up[2] * Math.sin(angle)) * radius,
    ];
    return { points: [at(from), at(to)] };
  });

// --- the shapes of GSS

const corner = (x: number, y: number, z: number): Vec3 => [x, y, z];
const BOX_FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
export const box = (w: number, h: number, d: number) =>
  polyhedron(
    [corner(-w, -h, -d), corner(w, -h, -d), corner(w, h, -d), corner(-w, h, -d), corner(-w, -h, d), corner(w, -h, d), corner(w, h, d), corner(-w, h, d)],
    BOX_FACES,
  );

const star: [number, number][] = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 ? 0.26 : 0.62;
  const angle = (i / 10) * 2 * Math.PI;
  return [Math.sin(angle) * radius, Math.cos(angle) * radius];
});

// A vase: its outer wall from the lip down to the foot, then closed along the axis
const vase = (): Profile => {
  const wall: ProfilePoint[] = [];
  const points: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const y = 0.62 - t * 1.24;
    // a narrow neck, a round belly, a foot
    const r = 0.2 + 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.6 + 0.06 * (1 - t) ** 6;
    points.push([r, y]);
  }
  points.forEach(([r, y], i) => {
    const [r0, y0] = points[Math.max(0, i - 1)];
    const [r1, y1] = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(r1 - r0, y1 - y0);
    wall.push({ r, y, nr: (y0 - y1) / length, ny: (r1 - r0) / length });
  });
  const [lip, foot] = [points[0], points[points.length - 1]];
  return [straight(0, lip[1], lip[0], lip[1]), wall, straight(foot[0], foot[1], 0, foot[1])];
};

// Everything a scene can declare, in the order of the registry. A new shape must be drawn:
// the type refuses a missing one.
export const SHAPES: Record<ShapeDef["name"], (view: View) => Solid> = {
  cube: () => box(0.5, 0.5, 0.5),
  sphere: (view) => revolution(view, [arc(0, 0, 0.6, 0, 180)], [[0.6, 0]]),
  torus: (view) => revolution(view, [arc(0.47, 0, 0.17, 0, 360)]),
  cylinder: (view) => revolution(view, [straight(0, 0.6, 0.42, 0.6), straight(0.42, 0.6, 0.42, -0.6), straight(0.42, -0.6, 0, -0.6)]),
  cone: (view) => revolution(view, [straight(0, 0.62, 0.48, -0.55), straight(0.48, -0.55, 0, -0.55)]),
  capsule: (view) => revolution(view, [arc(0, 0.32, 0.34, 0, 90), straight(0.34, 0.32, 0.34, -0.32), arc(0, -0.32, 0.34, 90, 180)], [[0.34, 0.32], [0.34, -0.32]]),
  pyramid: () =>
    polyhedron(
      [corner(-0.5, -0.45, -0.5), corner(0.5, -0.45, -0.5), corner(0.5, -0.45, 0.5), corner(-0.5, -0.45, 0.5), corner(0, 0.6, 0)],
      [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
    ),
  octahedron: () =>
    polyhedron(
      [corner(0.62, 0, 0), corner(-0.62, 0, 0), corner(0, 0.62, 0), corner(0, -0.62, 0), corner(0, 0, 0.62), corner(0, 0, -0.62)],
      [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]],
    ),
  tube: (view) => revolution(view, [straight(0.3, 0.55, 0.46, 0.55), straight(0.46, 0.55, 0.46, -0.55), straight(0.46, -0.55, 0.3, -0.55), straight(0.3, -0.55, 0.3, 0.55)]),
  path: (view) => sweep(view, Array.from({ length: 41 }, (_, i): Vec3 => [-0.62 + (i / 40) * 1.24, 0.3 * Math.sin((i / 40) * 2 * Math.PI), 0]), 0.1),
  plane: () => polyhedron([corner(-0.62, 0, -0.62), corner(0.62, 0, -0.62), corner(0.62, 0, 0.62), corner(-0.62, 0, 0.62)], [[0, 1, 2, 3]]),
  prism: () => extrusion(star, 0.28),
  lathe: (view) => revolution(view, vase()),
  group: (view) => together(moved(box(0.3, 0.3, 0.3), [-0.24, -0.14, 0.12]), moved(revolution(view, [arc(0, 0, 0.36, 0, 180)], [[0.36, 0]]), [0.22, 0.1, -0.1])),
  light: (view) => {
    const bulb = revolution(view, [arc(0, 0, 0.17, 0, 180)]);
    return { lines: [...bulb.lines, ...rays(view, 8, 0.32, 0.56)], mesh: bulb.mesh };
  },
};

// --- a solid turned in the scene, the way the rotations of GSS turn an object

export type Axis = "x" | "y" | "z";

// By an angle in degrees, like rotate-x, rotate-y and rotate-z: a positive angle turns the top
// away from the viewer, the right side away from the viewer, or the object clockwise
export function spun(solid: Solid, axis: Axis, degrees: number): Solid {
  const [c, s] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
  const turn = ([x, y, z]: Vec3): Vec3 =>
    axis === "x" ? [x, y * c + z * s, -y * s + z * c] : axis === "y" ? [x * c + z * s, y, -x * s + z * c] : [x * c + y * s, -x * s + y * c, z];
  return {
    lines: solid.lines.map((line) => ({ ...line, points: line.points.map(turn) })),
    mesh: solid.mesh.map((triangle) => triangle.map(turn) as Triangle),
  };
}

const AXES: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
// How far an axis is drawn on each side of the origin, for a cube turning around it
export const AXIS_REACH = 1.15;

// A cube turned around an axis, and the axis: dashed where it goes through the cube
export function spinDrawing(axis: Axis, degrees: number, frame: Frame, view: View = REST_VIEW): { cube: Drawing; axis: Drawing } {
  const cube = spun(box(0.42, 0.42, 0.42), axis, degrees);
  const [x, y, z] = AXES[axis].map((n) => n * AXIS_REACH);
  const line: Line = { points: [[-x, -y, -z], [x, y, z]] };
  return { cube: draw(cube, frame, view), axis: draw({ lines: [line], mesh: cube.mesh }, frame, view) };
}

// --- what a scene is made of, for the figures that show one

// A sphere of any radius, with its equator
export const ball = (view: View, radius: number): Solid => revolution(view, [arc(0, 0, radius, 0, 180)], [[radius, 0]]);

// The floor: a few lines each way, and a sheet that hides what is under it
export function floor(half: number, step: number): Solid {
  const lines: Line[] = [];
  for (let at = -half; at <= half + 1e-9; at += step) {
    lines.push({ points: [[at, 0, -half], [at, 0, half]], kind: "ground" }, { points: [[-half, 0, at], [half, 0, at]], kind: "ground" });
  }
  const [a, b, c, d]: Vec3[] = [[-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half]];
  return { lines, mesh: [[a, b, c], [a, c, d]] };
}

// --- a shape with its measures, for its page and for the script that turns it

// A measure: a line between two points of the shape, named by the property that sets it
export type Mark = { from: Vec3; to: Vec3; label: string };
const MARKS: Partial<Record<ShapeDef["name"], Mark[]>> = {
  cube: [{ from: [-0.5, -0.5, 0.5], to: [0.5, -0.5, 0.5], label: "size" }],
  sphere: [{ from: [0, 0, 0], to: [0.6, 0, 0], label: "radius" }],
  torus: [
    { from: [0, 0, 0], to: [0.47, 0, 0], label: "radius" },
    { from: [-0.64, 0, 0], to: [-0.47, 0, 0], label: "thickness" },
  ],
  cylinder: [
    { from: [0, 0.6, 0], to: [0.42, 0.6, 0], label: "radius" },
    { from: [0.62, -0.6, 0], to: [0.62, 0.6, 0], label: "height" },
  ],
  cone: [
    { from: [0, -0.55, 0], to: [0.48, -0.55, 0], label: "radius" },
    { from: [0.66, -0.55, 0], to: [0.66, 0.62, 0], label: "height" },
  ],
  capsule: [
    { from: [0, 0.32, 0], to: [0.34, 0.32, 0], label: "radius" },
    { from: [0.54, -0.66, 0], to: [0.54, 0.66, 0], label: "height" },
  ],
  pyramid: [{ from: [-0.5, -0.45, 0.5], to: [0.5, -0.45, 0.5], label: "size" }],
  octahedron: [{ from: [0, 0, 0], to: [0.62, 0, 0], label: "radius" }],
  tube: [
    { from: [0, 0.55, 0], to: [0.46, 0.55, 0], label: "radius" },
    { from: [-0.46, 0.55, 0], to: [-0.3, 0.55, 0], label: "thickness" },
    { from: [0.66, -0.55, 0], to: [0.66, 0.55, 0], label: "height" },
  ],
  plane: [{ from: [-0.62, 0, 0.62], to: [0.62, 0, 0.62], label: "size" }],
  prism: [{ from: [0, 0.62, 0.14], to: [0, 0.62, -0.14], label: "depth" }],
  // across the tube, where the line starts
  path: [{ from: [-0.536, -0.055, 0], to: [-0.704, 0.055, 0], label: "stroke-width" }],
};

export type Measure = { label: string; d: string; x: number; y: number };

// A measure on the screen: its line, a tick at each end, and where its name goes
export function measure({ from, to, label }: Mark, frame: Frame, view: View = REST_VIEW): Measure {
  const round = (n: number) => +n.toFixed(1);
  const [a, b] = [place(from, frame, view), place(to, frame, view)];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  // Across the line: toward the outside of the drawing, up when the line goes through its middle
  let across = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const outward = across[0] * (middle[0] - frame.x) + across[1] * (middle[1] - frame.y);
  if (outward < -0.5 || (Math.abs(outward) <= 0.5 && across[1] > 0)) across = [-across[0], -across[1]];
  const tick = (p: Vec3) => `M${round(p[0] - across[0] * 3)} ${round(p[1] - across[1] * 3)}L${round(p[0] + across[0] * 3)} ${round(p[1] + across[1] * 3)}`;
  return {
    label,
    d: `M${round(a[0])} ${round(a[1])}L${round(b[0])} ${round(b[1])}${tick(a)}${tick(b)}`,
    x: round(middle[0] + across[0] * 11),
    y: round(middle[1] + across[1] * 11),
  };
}

export type ShapeDrawing = Drawing & { marks: Measure[] };

// With every measure of the shape, or only the one of a property
export function shapeDrawing(name: ShapeDef["name"], frame: Frame, view: View = REST_VIEW, measured: boolean | string = false): ShapeDrawing {
  const marks = (measured ? (MARKS[name] ?? []) : [])
    .filter((mark) => measured === true || mark.label === measured)
    .map((mark) => measure(mark, frame, view));
  return { ...draw(SHAPES[name](view), frame, view), marks };
}
