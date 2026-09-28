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
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0,
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
        throw new Error(
          command.toUpperCase() === "A"
            ? "Arcs (A) are not supported in paths yet: use curves (C, Q)"
            : `Unknown path command "${command}"`,
        );
      }
    } else if (command === "M") command = "L";
    else if (command === "m") command = "l";

    const upper = command.toUpperCase();
    const relative = command !== upper;
    const count = ARGUMENTS[upper];
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
    }
    lastControl = control;
    lastCommand = command;
  }

  if (line.length > 1) lines.push(line);
  if (lines.length === 0) throw new Error("The path draws nothing: add a line or a curve after M");
  return lines;
}
