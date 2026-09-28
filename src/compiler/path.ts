// The GLSL of a "path" object: a round tube that follows an SVG path.
// The curves are already cut into segments (svgpath.ts); the shader measures the
// distance to the nearest segment, and the tube is everything closer than half its width.

import type { Point } from "./svgpath";

// Big enough for detailed logos, small enough to keep the shader fast
export const MAX_SEGMENTS = 512;

export type ViewBox = { x: number; y: number; width: number; height: number };

// GLSL wants "1.0", not "1"; 4 decimals are plenty for a shape
function float(n: number): string {
  const text = String(Math.round(n * 10000) / 10000);
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
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
  strokeWidth: number,
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
    throw new Error(`This path is too detailed: ${segments.length} segments, the limit is ${MAX_SEGMENTS}`);
  }

  // Segments are grouped by 8, each group with its box: far from a group's box,
  // its segments cannot be the nearest, and the shader skips them.
  const groups: [Point, Point][][] = [];
  for (let i = 0; i < segments.length; i += 8) groups.push(segments.slice(i, i + 8));

  const vec2 = (p: Point) => `vec2(${float(p.x)}, ${float(p.y)})`;
  const boxCode = (points: Point[]) => {
    const box = boxOf(points);
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return { center: vec2(center), half: vec2({ x: box.width / 2, y: box.height / 2 }) };
  };

  // The code is written out segment by segment, with no array and no loop:
  // it is longer, but GPUs run it much faster than a loop over a constant array.
  const body = groups
    .map((group) => {
      const box = boxCode(group.flat());
      const lines = group.map(([a, b]) => `    d = min(d, segment2(q, ${vec2(a)}, ${vec2(b)}));`);
      return `  if (box2(q, ${box.center}, ${box.half}) < d) {\n${lines.join("\n")}\n  }`;
    })
    .join("\n");

  const all = boxCode(segments.flat());
  const radius = float(strokeWidth / 2);

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
