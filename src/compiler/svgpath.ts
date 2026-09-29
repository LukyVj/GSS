// Reads the "d" of an SVG path — the same text as <path d="…"> or CSS path("…") —
// and turns it into polylines: curves become short straight segments.
// The shader then only needs the distance to a segment.

export type Point = { x: number; y: number };

// How many segments replace a curve: as few as possible, but the segments never
// stray further than "tolerance" from the true curve (the classic flatness bound:
// error ≤ max|second derivative| / (8 n²)). Sharp curves get more segments.
function stepsFor(secondDerivative: number, tolerance: number): number {
  const steps = Math.ceil(Math.sqrt(secondDerivative / (8 * tolerance)));
  return Math.min(Math.max(steps, 1), 64);
}

const length = (x: number, y: number) => Math.hypot(x, y);

// How many numbers each command takes
const ARGUMENTS: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

// Command letters, and numbers like 12, -1.5, .5, 1e-3 ("1-2" is 1 then -2, ".5.5" is .5 then .5)
const PIECE = /[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function quadratic(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

// An SVG arc gives two points and two radii; drawing needs the center and the angles.
// The conversion of the SVG spec (appendix B.2.4), step by step.
type Arc = { cx: number; cy: number; rx: number; ry: number; cos: number; sin: number; start: number; sweep: number };

function arcCenter(from: Point, end: Point, rx: number, ry: number, rotation: number, largeArc: boolean, sweep: boolean): Arc {
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);

  // 1. The middle of the chord, in the ellipse's own axes
  const dx = (from.x - end.x) / 2;
  const dy = (from.y - end.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;

  // 2. Radii too small to reach the end point grow until they do
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  // 3. The center, on one side of the chord or the other: the two flags choose
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from.x + end.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + end.y) / 2;

  // 4. The start angle, and how far the arc turns (negative: the other way)
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const ux = (x1 - cx1) / rx, uy = (y1 - cy1) / ry;
  const vx = (-x1 - cx1) / rx, vy = (-y1 - cy1) / ry;
  const start = angle(1, 0, ux, uy);
  let turn = angle(ux, uy, vx, vy);
  if (!sweep && turn > 0) turn -= 2 * Math.PI;
  if (sweep && turn < 0) turn += 2 * Math.PI;

  return { cx, cy, rx, ry, cos, sin, start, sweep: turn };
}

// The point of the ellipse at the angle theta: on the ellipse's own axes,
// then turned by its rotation (the inverse of step 1) and moved to its center
function pointOnArc(arc: Arc, theta: number): Point {
  const x = arc.rx * Math.cos(theta);
  const y = arc.ry * Math.sin(theta);
  return {
    x: arc.cx + arc.cos * x - arc.sin * y,
    y: arc.cy + arc.sin * x + arc.cos * y,
  };
}

// The flags of an arc are one character each, and minified SVG glues them:
// "a1 1 0 011 0" means the flags 0 and 1, then 1 0. Cut such pieces apart.
function splitArcFlags(pieces: string[], i: number): void {
  for (const k of [3, 4]) {
    const piece = pieces[i + k];
    if (piece && /^[01]./.test(piece) && !/[a-zA-Z]/.test(piece)) {
      pieces.splice(i + k, 1, piece[0], piece.slice(1));
    }
  }
}

// "M0 0 L10 0" → [[{0,0}, {10,0}]]. One polyline per subpath (each M starts one).
// tolerance: how far (in path units) the segments may stray from the curves.
export function readSvgPath(d: string, tolerance = 0.05): Point[][] {
  // 1. Cut the text into letters and numbers, and refuse anything else
  const pieces = d.match(PIECE) ?? [];
  const leftover = d.replace(PIECE, "").replace(/[\s,]/g, "");
  if (leftover) throw new Error(`Unexpected "${leftover[0]}" in the path`);
  if (!/^[Mm]$/.test(pieces[0] ?? "")) throw new Error('A path starts with "M", like: path("M0 0 L10 0")');

  const lines: Point[][] = [];
  let line: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 }; // where the subpath began, for Z
  let lastControl: Point | null = null; // for S and T, which mirror the previous control point
  let lastCommand = "";

  const add = (point: Point) => {
    line.push(point);
    current = point;
  };

  let i = 0;
  let command = "";
  while (i < pieces.length) {
    // 2. A letter changes the command; otherwise the previous one repeats (after M, it is L)
    if (/[a-zA-Z]/.test(pieces[i])) {
      command = pieces[i++];
      if (!(command.toUpperCase() in ARGUMENTS)) {
        throw new Error(`Unknown path command "${command}"`);
      }
    } else if (command === "M") command = "L";
    else if (command === "m") command = "l";

    const upper = command.toUpperCase();
    const relative = command !== upper;
    const count = ARGUMENTS[upper];
    if (upper === "A") splitArcFlags(pieces, i);
    const numbers = pieces.slice(i, i + count).map(Number);
    if (numbers.length < count || numbers.some(Number.isNaN)) {
      throw new Error(`"${command}" expects ${count} numbers in the path`);
    }
    i += count;

    // A point of the command, made absolute
    const at = (x: number, y: number): Point =>
      relative ? { x: current.x + x, y: current.y + y } : { x, y };

    // 3. Each command adds points to the current polyline
    const from = current;
    let control: Point | null = null;
    switch (upper) {
      case "M":
        if (line.length > 1) lines.push(line);
        line = [];
        add(at(numbers[0], numbers[1]));
        start = current;
        break;
      case "L":
        add(at(numbers[0], numbers[1]));
        break;
      case "H":
        add({ x: relative ? current.x + numbers[0] : numbers[0], y: current.y });
        break;
      case "V":
        add({ x: current.x, y: relative ? current.y + numbers[0] : numbers[0] });
        break;
      case "Z":
        add(start);
        break;
      case "C":
      case "S": {
        // S: the first control point mirrors the last one of the previous C or S
        const mirrored =
          lastControl && /[CS]/i.test(lastCommand)
            ? { x: 2 * from.x - lastControl.x, y: 2 * from.y - lastControl.y }
            : from;
        const c1 = upper === "C" ? at(numbers[0], numbers[1]) : mirrored;
        const rest = upper === "C" ? numbers.slice(2) : numbers;
        const c2 = at(rest[0], rest[1]);
        const end = at(rest[2], rest[3]);
        const bend = 6 * Math.max(
          length(from.x - 2 * c1.x + c2.x, from.y - 2 * c1.y + c2.y),
          length(c1.x - 2 * c2.x + end.x, c1.y - 2 * c2.y + end.y),
        );
        const steps = stepsFor(bend, tolerance);
        for (let step = 1; step <= steps; step++) add(cubic(from, c1, c2, end, step / steps));
        control = c2;
        break;
      }
      case "Q":
      case "T": {
        const c: Point =
          upper === "Q"
            ? at(numbers[0], numbers[1])
            : lastControl && /[QT]/i.test(lastCommand)
              ? { x: 2 * from.x - lastControl.x, y: 2 * from.y - lastControl.y }
              : from;
        const end = upper === "Q" ? at(numbers[2], numbers[3]) : at(numbers[0], numbers[1]);
        const steps = stepsFor(2 * length(from.x - 2 * c.x + end.x, from.y - 2 * c.y + end.y), tolerance);
        for (let step = 1; step <= steps; step++) add(quadratic(from, c, end, step / steps));
        control = c;
        break;
      }
      case "A": {
        const [rx, ry, rotation, largeArc, sweep] = numbers;
        if ((largeArc !== 0 && largeArc !== 1) || (sweep !== 0 && sweep !== 1)) {
          throw new Error('The flags of an arc are 0 or 1, like: A5 5 0 0 1 10 0');
        }
        const end = at(numbers[5], numbers[6]);
        if (end.x === from.x && end.y === from.y) break; // SVG: an arc to itself draws nothing
        if (rx === 0 || ry === 0) {
          add(end); // SVG: a radius of 0 is a straight line
          break;
        }
        const arc = arcCenter(from, end, rx, ry, rotation, largeArc === 1, sweep === 1);
        // the curvature of the ellipse is at most r × turn², like "bend" for the curves
        const steps = stepsFor(Math.max(arc.rx, arc.ry) * arc.sweep ** 2, tolerance);
        for (let step = 1; step <= steps; step++) {
          // the last point is "end" itself, so rounding never leaves a gap
          add(step === steps ? end : pointOnArc(arc, arc.start + (arc.sweep * step) / steps));
        }
        break;
      }
    }
    lastControl = control;
    lastCommand = command;
  }

  if (line.length > 1) lines.push(line);
  if (lines.length === 0) throw new Error("The path draws nothing: add a line or a curve after M");
  return lines;
}
