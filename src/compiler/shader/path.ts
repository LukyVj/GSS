// The GLSL of a "path" object: a round tube that follows an SVG path.
// The curves are already cut into segments (svgpath.ts); the shader measures the
// distance to the nearest segment, and the tube is everything closer than half its width.

import type { Point } from "../values/svgpath";

// Big enough for detailed logos, small enough to keep the shader fast
export const MAX_SEGMENTS = 10_000_000;

export type ViewBox = { x: number; y: number; width: number; height: number };

// GLSL wants "1.0", not "1"; 4 decimals are plenty for a shape
function float(n: number): string {
  const text = String(Math.round(n * 10000) / 10000);
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
}

// A point, written in GLSL
function vec2(p: Point): string {
  return `vec2(${float(p.x)}, ${float(p.y)})`;
}

// ----- Trees of boxes over the segments (or sides) of a shape -----
// A group of 8 segments has a box, as written in the shader (rounded to 4 decimals):
// further from the box than the nearest segment found so far (d, squared), none of its
// segments can be nearer. 8 groups are gathered under a box that holds their boxes, 8 of
// those under a bigger one, and so on: one test skips them all. The value of d stays the
// same, whatever is skipped: a box holds the boxes inside it with a margin wider than the
// rounding of 32-bit floats, so when it is too far, each box inside it is too far as well,
// and the groups keep their order. The same for the heights of the inside test.
const BRANCHES = 8;

const round = (n: number) => Math.round(n * 10000) / 10000;

export type BoxLeaf = { low: Point; high: Point; lines: string[] };
export type RangeLeaf = { low: number; high: number; lines: string[] };

// A group: the box of its points, as the shader will read it
export function boxLeaf(points: Point[], lines: string[]): BoxLeaf {
  const box = boxOf(points);
  const center = { x: round(box.x + box.width / 2), y: round(box.y + box.height / 2) };
  const half = { x: round(box.width / 2), y: round(box.height / 2) };
  return {
    low: { x: center.x - half.x, y: center.y - half.y },
    high: { x: center.x + half.x, y: center.y + half.y },
    lines: [`if (box2(q, ${vec2(center)}, ${vec2(half)}) < d) {`, ...lines.map((l) => `  ${l}`), "}"],
  };
}

const indented = (lines: string[], depth: number) => lines.map((l) => `${"  ".repeat(depth)}${l}`).join("\n");

// The groups, gathered by BRANCHES under bigger boxes until no more than BRANCHES are left
export function boxTree(leaves: BoxLeaf[], branches = BRANCHES): string {
  let level = leaves;
  while (level.length > branches) {
    const next: BoxLeaf[] = [];
    for (let i = 0; i < level.length; i += branches) {
      const children = level.slice(i, i + branches);
      if (children.length === 1) {
        next.push(children[0]);
        continue;
      }
      const low = { x: Math.min(...children.map((c) => c.low.x)), y: Math.min(...children.map((c) => c.low.y)) };
      const high = { x: Math.max(...children.map((c) => c.high.x)), y: Math.max(...children.map((c) => c.high.y)) };
      // The margin: 32-bit floats round about 1e-7 of the size of the coordinates
      const size = Math.max(Math.abs(low.x), Math.abs(low.y), Math.abs(high.x), Math.abs(high.y));
      const margin = 0.0001 + size * 1e-5;
      const center = { x: round((low.x + high.x) / 2), y: round((low.y + high.y) / 2) };
      const up = (n: number) => Math.ceil(n * 10000) / 10000;
      const half = { x: up((high.x - low.x) / 2 + 2 * margin), y: up((high.y - low.y) / 2 + 2 * margin) };
      next.push({
        low: { x: center.x - half.x, y: center.y - half.y },
        high: { x: center.x + half.x, y: center.y + half.y },
        lines: [
          `if (box2(q, ${vec2(center)}, ${vec2(half)}) < d) {`,
          ...children.flatMap((c) => c.lines.map((l) => `  ${l}`)),
          "}",
        ],
      });
    }
    level = next;
  }
  return indented(level.flatMap((c) => c.lines), 1);
}

// The same for the inside test: the heights of the groups, gathered under taller ones
export function rangeTree(leaves: RangeLeaf[], branches = BRANCHES): string {
  const block = (low: number, high: number, inner: string[]) => [
    `if (q.y >= ${float(low)} && q.y <= ${float(high)}) {`,
    ...inner.map((l) => `  ${l}`),
    "}",
  ];
  let level = leaves.map((leaf) => ({ ...leaf, lines: block(leaf.low, leaf.high, leaf.lines) }));
  while (level.length > branches) {
    const next: RangeLeaf[] = [];
    for (let i = 0; i < level.length; i += branches) {
      const children = level.slice(i, i + branches);
      if (children.length === 1) {
        next.push(children[0]);
        continue;
      }
      const low = Math.min(...children.map((c) => c.low));
      const high = Math.max(...children.map((c) => c.high));
      next.push({ low, high, lines: block(low, high, children.flatMap((c) => c.lines)) });
    }
    level = next;
  }
  return indented(level.flatMap((c) => c.lines), 1);
}

function boxOf(points: Point[]): ViewBox {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

// Returns the GLSL function (with its segments) that gives the distance to the tube.
// The origin of the object is the center of the view-box (or of the path itself),
// and y goes up, so a path copied from an SVG looks the same way up.
export function pathFunction(
  name: string,
  lines: Point[][],
  strokeWidth: number | string, // GLSL: a width set from JS (decision 105)
  viewBox: ViewBox | null,
): string {
  const box = viewBox ?? boxOf(lines.flat());
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const toScene = ({ x, y }: Point): Point => ({ x: x - cx, y: cy - y });

  // Pairs of points; a segment of length 0 would divide by zero in the shader
  const segments: [Point, Point][] = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [toScene(line[i - 1]), toScene(line[i])];
      if (a.x !== b.x || a.y !== b.y) segments.push([a, b]);
    }
  }
  if (segments.length > MAX_SEGMENTS) {
    throw new Error(
      `This path is too detailed: ${segments.length} segments, the limit is ${MAX_SEGMENTS}`,
    );
  }

  // Segments are grouped by 8, each group with its box: far from a group's box,
  // its segments cannot be the nearest, and the shader skips them. The groups are
  // themselves gathered by 8 under a bigger box, and so on (boxTree()).
  // The code is written out segment by segment, with no array and no loop:
  // it is longer, but GPUs run it much faster than a loop over a constant array.
  const leaves: BoxLeaf[] = [];
  for (let i = 0; i < segments.length; i += 8) {
    const group = segments.slice(i, i + 8);
    leaves.push(boxLeaf(group.flat(), group.map(([a, b]) => `d = min(d, segment2(q, ${vec2(a)}, ${vec2(b)}));`)));
  }
  const body = boxTree(leaves);

  const boxCode = (points: Point[]) => {
    const box = boxOf(points);
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return {
      center: vec2(center),
      half: vec2({ x: box.width / 2, y: box.height / 2 }),
    };
  };
  const all = boxCode(segments.flat());
  const radius = typeof strokeWidth === "number" ? float(strokeWidth / 2) : `(${strokeWidth} / 2.0)`;

  return `float NAME(vec3 p) {
  // Far from the whole path, the distance to its box is enough
  float far = sqrt(box2(p.xy, ${all.center}, ${all.half}) + p.z * p.z) - ${radius};
  if (far > 0.5) return far;

  vec2 q = p.xy;
  float d = 1e10; // squared distance to the nearest segment
${body}
  return length(vec2(sqrt(d), p.z)) - ${radius};
}`.replace(/NAME/g, name);
}

// The distance to the nearest side (d, squared) and the inside test (s) of filled contours,
// in the GLSL of a prism or a lathe, for the point q
function fillBody(sides: [Point, Point][]): string {
  // Sides are grouped by 8, like the segments of a path. A group is skipped for the
  // distance when its box is further than the nearest side found so far, and for the
  // inside test when the horizontal line through q does not cross its height; the groups
  // are gathered by 8 under a bigger box and a taller height, and so on (boxTree(),
  // rangeTree()). Crossings are counted over every contour: a hole flips the inside back
  // (even-odd rule).
  const boxes: BoxLeaf[] = [];
  const ranges: RangeLeaf[] = [];
  for (let i = 0; i < sides.length; i += 8) {
    const group = sides.slice(i, i + 8);
    const groupBox = boxOf(group.flat());
    boxes.push(boxLeaf(group.flat(), group.map(([a, b]) => `d = min(d, segment2(q, ${vec2(a)}, ${vec2(b)}));`)));
    ranges.push({
      low: round(groupBox.y),
      high: round(groupBox.y + groupBox.height),
      lines: group.map(([a, b]) => `if (crosses(q, ${vec2(a)}, ${vec2(b)})) s = -s;`),
    });
  }
  // Up to BRANCHES groups there is no tree: each group's two tests, one after the other
  if (boxes.length <= BRANCHES)
    return boxes.map((box, i) => `${boxTree([box])}\n${rangeTree([ranges[i]])}`).join("\n");
  return `${boxTree(boxes)}\n${rangeTree(ranges)}`;
}

// Returns the GLSL function of a "prism" object: contours, filled, then given a depth.
// One contour for a polygon(), one per subpath for a path() (the holes of a letter).
// Same coordinates as a path: centered on the view-box (or the contours), y up.
export function polygonFunction(
  name: string,
  contours: Point[][],
  depth: number | string, // GLSL: a depth set from JS (decision 105)
  viewBox: ViewBox | null,
): string {
  const box = viewBox ?? boxOf(contours.flat());
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Each point with the next one; the last one goes back to the first: every contour is closed
  const sides: [Point, Point][] = [];
  for (const contour of contours) {
    const scene = contour.map(({ x, y }) => ({ x: x - cx, y: cy - y }));
    scene.forEach((a, i) => {
      const b = scene[(i + 1) % scene.length];
      if (a.x !== b.x || a.y !== b.y) sides.push([a, b]); // a side of length 0 would divide by zero
    });
  }
  if (sides.length > MAX_SEGMENTS) {
    throw new Error(
      `This shape is too detailed: ${sides.length} sides, the limit is ${MAX_SEGMENTS}`,
    );
  }

  const body = fillBody(sides);

  const all = boxOf(sides.flat());
  const allCenter = vec2({ x: all.x + all.width / 2, y: all.y + all.height / 2 });
  const allHalf = vec2({ x: all.width / 2, y: all.height / 2 });
  const h = typeof depth === "number" ? float(depth / 2) : `(${depth} / 2.0)`;

  return `float NAME(vec3 p) {
  // Far from the whole shape, the distance to its box is enough
  float far = length(vec2(sqrt(box2(p.xy, ${allCenter}, ${allHalf})), max(abs(p.z) - ${h}, 0.0)));
  if (far > 0.5) return far;

  vec2 q = p.xy;
  float d = 1e10; // squared distance to the nearest side
  float s = 1.0; // becomes -1.0 inside the shape
${body}
  return extrude(s * sqrt(d), p.z, ${h});
}`.replace(/NAME/g, name);
}

// The points of a lathe in scene coordinates: x stays as written, since x = 0 is the axis;
// the height is centered on the view-box (or the contours), y up
function latheScene(contours: Point[][], viewBox: ViewBox | null): Point[][] {
  const box = viewBox ?? boxOf(contours.flat());
  const cy = box.y + box.height / 2;
  return contours.map((contour) => contour.map(({ x, y }) => ({ x, y: cy - y })));
}

// Returns the GLSL function of a "lathe" object: contours, filled, then turned around the
// y axis, like a vase on a potter's wheel. The point is brought back into the half plane of
// its contour, (distance to the axis, height), so the 2D distance there is the 3D distance.
export function latheFunction(name: string, contours: Point[][], viewBox: ViewBox | null): string {
  // Each point with the next one, like a prism. A side on the axis is left out: once turned,
  // it is inside the solid, not a surface. A ray toward +x (crosses()) never meets it either.
  const sides: [Point, Point][] = [];
  for (const contour of latheScene(contours, viewBox)) {
    contour.forEach((a, i) => {
      const b = contour[(i + 1) % contour.length];
      if ((a.x !== b.x || a.y !== b.y) && (a.x !== 0 || b.x !== 0)) sides.push([a, b]);
    });
  }
  if (sides.length > MAX_SEGMENTS) {
    throw new Error(
      `This shape is too detailed: ${sides.length} sides, the limit is ${MAX_SEGMENTS}`,
    );
  }

  const body = fillBody(sides);

  const all = boxOf(sides.flat());
  const allCenter = vec2({ x: all.x + all.width / 2, y: all.y + all.height / 2 });
  const allHalf = vec2({ x: all.width / 2, y: all.height / 2 });

  return `float NAME(vec3 p) {
  vec2 q = vec2(length(p.xz), p.y);
  // Far from the whole shape, the distance to its box is enough
  float far = sqrt(box2(q, ${allCenter}, ${allHalf}));
  if (far > 0.5) return far;

  float d = 1e10; // squared distance to the nearest side
  float s = 1.0; // becomes -1.0 inside the shape
${body}
  return s * sqrt(d);
}`.replace(/NAME/g, name);
}

// ----- Bounding spheres (map() skips an object when even its sphere is further than
// the nearest object found so far). Centered on the object's origin, in its own units.

// How far the farthest corner of a box is from the origin: the box fits in that circle
function reach(box: ViewBox): number {
  const x = Math.max(Math.abs(box.x), Math.abs(box.x + box.width));
  const y = Math.max(Math.abs(box.y), Math.abs(box.y + box.height));
  return Math.hypot(x, y);
}

// The points in scene coordinates: centered on the view-box (or on the points), y up
function toSceneBox(points: Point[], viewBox: ViewBox | null): ViewBox {
  const box = viewBox ?? boxOf(points);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return boxOf(points.map(({ x, y }) => ({ x: x - cx, y: cy - y })));
}

// A path: its points, widened by half the stroke. The sphere also holds what the
// shader returns far from the path (the distance to the box of the segments, minus
// half the stroke). null when there is nothing to hold (no point).
export function pathRadius(
  lines: Point[][],
  strokeWidth: number,
  viewBox: ViewBox | null,
): number | null {
  const points = lines.flat();
  if (points.length === 0) return null;
  return reach(toSceneBox(points, viewBox)) + strokeWidth / 2;
}

// A prism: its contours, and half its depth in z
export function polygonRadius(
  contours: Point[][],
  depth: number,
  viewBox: ViewBox | null,
): number | null {
  const points = contours.flat();
  if (points.length === 0) return null;
  return Math.hypot(reach(toSceneBox(points, viewBox)), depth / 2);
}

// A lathe: its widest point from the axis, and its centered height
export function latheRadius(contours: Point[][], viewBox: ViewBox | null): number | null {
  const points = latheScene(contours, viewBox).flat();
  if (points.length === 0) return null;
  const x = Math.max(...points.map((p) => p.x));
  const y = Math.max(...points.map((p) => Math.abs(p.y)));
  return Math.hypot(x, y);
}
