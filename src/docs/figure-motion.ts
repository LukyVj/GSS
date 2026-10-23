import type { ShapeDef } from "../compiler/registry/registry";
import { REST, REST_VIEW, shapeDrawing, spinDrawing, viewAt, type Axis, type Frame, type Vec3 } from "./hairline";

// The shapes of the figures turn (decision 181): a shape arrives turning when its page opens,
// then follows the pointer over it, and goes back to rest. The page holds each shape as three
// paths drawn at rest; this script draws the same shape again from another side.

type View = { azimuth: number; elevation: number };

// How far the pointer turns a shape: from one edge of its box to the other
const REACH = { azimuth: 55, elevation: 24 };
// From how far a shape arrives when its page opens
const ARRIVAL = { azimuth: -80, elevation: 14 };

// The view for a pointer at (x, y) in the box of a shape, both from -1 to 1. The eye stays
// above the floor, and never right over the shape.
export function viewUnder(x: number, y: number): View {
  const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
  return {
    azimuth: REST.azimuth + clamp(x, -1, 1) * REACH.azimuth,
    elevation: clamp(REST.elevation - clamp(y, -1, 1) * REACH.elevation, 6, 60),
  };
}

// The frame of a drawing, as the page wrote it on its SVG
function frameOf(svg: SVGSVGElement): Frame {
  const [scale, x, y] = (svg.dataset.frame ?? "").split(" ").map(Number);
  const { width, height } = svg.viewBox.baseVal;
  return { width, height, scale, x, y };
}

// Draws the cube of a rotation again, turned by an angle around its axis
export function spinTo(svg: SVGSVGElement, degrees: number): void {
  // data-from: where the cube stands from its axis, when it does not turn around its center
  const from = (svg.dataset.from ?? "0 0 0").split(" ").map(Number) as Vec3;
  const { cube, axis } = spinDrawing(svg.dataset.spin as Axis, degrees, frameOf(svg), REST_VIEW, from);
  svg.querySelector("path.hidden")?.setAttribute("d", cube.hidden);
  svg.querySelector("path.line")?.setAttribute("d", cube.visible);
  svg.querySelector("path.axis-behind")?.setAttribute("d", axis.hidden);
  svg.querySelector("path.axis-front")?.setAttribute("d", axis.visible);
}

// Draws the shape of an SVG again, seen from another side
export function turnTo(svg: SVGSVGElement, { azimuth, elevation }: View): void {
  const frame = frameOf(svg);
  const measured = svg.dataset.measured === undefined ? false : svg.dataset.measured || true;
  const drawing = shapeDrawing(svg.dataset.turn as ShapeDef["name"], frame, viewAt(azimuth, elevation), measured);
  svg.querySelector("path.hidden")?.setAttribute("d", drawing.hidden + drawing.guideHidden);
  svg.querySelector("path.guide")?.setAttribute("d", drawing.guide);
  svg.querySelector("path.line")?.setAttribute("d", drawing.visible);
  svg.querySelector("path.bound")?.setAttribute("d", drawing.bound);
  const lines = svg.querySelectorAll("path.mark");
  const labels = svg.querySelectorAll("text.mark-label");
  drawing.marks.forEach((mark, i) => {
    lines[i]?.setAttribute("d", mark.d);
    labels[i]?.setAttribute("x", String(mark.x));
    labels[i]?.setAttribute("y", String(mark.y));
  });
}

export function enableFigures(root: HTMLElement): void {
  // Asked for less motion: the shapes stay as the page drew them
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  spin(root);

  type Turning = { svg: SVGSVGElement; now: View; goal: View; held: boolean };
  const turning: Turning[] = [...root.querySelectorAll<SVGSVGElement>("svg[data-turn]")].map((svg) => ({
    svg,
    now: { ...REST },
    goal: { ...REST },
    held: false,
  }));
  if (!turning.length) return;

  let running = false;
  const step = () => {
    running = false;
    for (const shape of turning) {
      const [da, de] = [shape.goal.azimuth - shape.now.azimuth, shape.goal.elevation - shape.now.elevation];
      if (da === 0 && de === 0) continue;
      // Close enough: the shape lands exactly on its goal, and rests
      const near = Math.abs(da) < 0.1 && Math.abs(de) < 0.1;
      shape.now = near ? { ...shape.goal } : { azimuth: shape.now.azimuth + da * 0.12, elevation: shape.now.elevation + de * 0.12 };
      turnTo(shape.svg, shape.now);
      if (!near) wake();
    }
  };
  const wake = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(step);
  };

  for (const shape of turning) {
    // The whole cell of a shape hears the pointer: its link in the list, its stage on its page
    const box = shape.svg.parentElement!;
    box.addEventListener("pointermove", (event) => {
      const rect = box.getBoundingClientRect();
      shape.goal = viewUnder(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
      shape.held = true;
      wake();
    });
    box.addEventListener("pointerleave", () => {
      shape.goal = { ...REST };
      shape.held = false;
      wake();
    });
  }

  // A shape on its own page arrives turning, each time the page opens
  const arrivals = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const shape = turning.find((candidate) => candidate.svg === entry.target);
      if (!shape || !entry.isIntersecting || shape.held) continue;
      shape.now = { azimuth: REST.azimuth + ARRIVAL.azimuth, elevation: REST.elevation + ARRIVAL.elevation };
      shape.goal = { ...REST };
      wake();
    }
  });
  for (const { svg } of turning) if (svg.dataset.measured !== undefined) arrivals.observe(svg);
}

// On the page of a rotation, the cube turns around its axis for as long as it is on screen:
// a turn in 8 seconds, from the angle the page drew it at
const TURN = 8000;
const DRAWN_AT = 24;

function spin(root: HTMLElement): void {
  const seen = new Map<SVGSVGElement, number>(); // each cube, and when it came on screen
  let running = false;
  const step = (now: number) => {
    running = false;
    for (const [svg, since] of seen) {
      if (!since) seen.set(svg, now);
      else spinTo(svg, DRAWN_AT + (((now - since) % TURN) / TURN) * 360);
    }
    wake();
  };
  const wake = () => {
    if (running || !seen.size) return;
    running = true;
    requestAnimationFrame(step);
  };
  const watch = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) seen.set(target as SVGSVGElement, 0);
      else seen.delete(target as SVGSVGElement);
    }
    wake();
  });
  for (const svg of root.querySelectorAll<SVGSVGElement>("svg[data-spin]")) watch.observe(svg);
}
