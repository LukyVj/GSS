import type { Dpr } from "../compiler/features/dpr";

// The ratio the canvas renders at: the author's dpr, against the screen's
export function pixelRatio(dpr: Dpr, screen: number): number {
  if (dpr === "auto") return Math.min(screen, 2);
  if (dpr === "max") return screen;
  return Math.min(dpr, screen); // a number: never above the screen
}

// How dense the canvas draws, and when a scene is too heavy to draw (decisions 120 and 142).
// Every view has one. "auto" starts light, at 0.5, and climbs by 0.5 while the frames keep
// up, so the first frames of a heavy scene never cost its full ratio on a weak GPU; it then
// follows the frame rate, measured over half a second: it drops at once when the frames are
// slow, as much as the frame rate lacks (the pixels cost the square of the ratio), and climbs
// back one step every 2 s. A ratio that was too slow is tried again 8 s later (a hitch
// passes), then twice as late after each try that fails, up to a minute. A number (the dpr
// picker of the docs and the playground) is fixed, never above the screen. Whatever the
// choice, more than 1.5 s of frames under 5 fps at the lowest ratio (or one frame of 3 s) makes
// the scene too heavy: frame() says so, and the view stops, until the reader asks to draw
// anyway (insist()). The first frame after a new scene is not measured: it may wait for the
// compile of its shader, which is not the GPU drawing.
// @gpu (slow) (decision 211): a scene with a lighter version asks for a floor of 1, so auto
// never draws it under 1; more than a second of slow frames at the lowest ratio (with a ratio
// chosen in the menu, frames that would need one under 1) makes the GPU slow, for good: the
// view then shows the lighter version.
export type DensityChoice = "auto" | number;
export type Density = ReturnType<typeof createDensity>;

const WINDOW = 500; // ms of frames per measure
const SETTLE = 500; // ms after a change or a new scene: not measured
const CLIMB = 2000; // ms between a change and the next step up
const SLOW = 45; // fps: below, drop
const FAST = 57; // fps: from here, climb
const TARGET = 55; // fps a drop aims at
const STEP = 0.25;
export const FLOOR = 0.5; // auto starts there, and never goes below (unless a floor of 1 is asked)
const RETRY = 8000; // ms before a ratio that was too slow is tried again, doubled on each failure
const RETRY_MAX = 64000;
// The start, until the first slow measure or the scene's ratio: shorter measures, bigger steps
const WARM_WINDOW = 200;
const WARM_SETTLE = 100;
const WARM_STEP = 0.5;
// Too heavy: frames this slow, over this long and this many measures, at the lowest ratio;
// or a single measure this long (one frame of seconds: a freeze)
const STOP = 5; // fps
const HEAVY_MS = 1500;
const HEAVY_MEASURES = 2;
const FROZEN_MS = 3000;
// Slow, for @gpu (slow): frames under SLOW fps at the lowest ratio, over this long and this
// many measures
const SLOW_MS = 1000;
const SLOW_MEASURES = 2;

export function createDensity(initial: DensityChoice) {
  let choice = initial;
  let ceiling = 1; // the scene's ratio, as last drawn
  let level: number | null = FLOOR; // auto: the ratio drawn now (null: the ceiling)
  let warming = initial === "auto"; // auto, at the start: climbs fast
  let cap = Infinity; // auto: the lowest ratio that was too slow, not tried before `retryAt`
  let retryAt = -Infinity;
  let wait = RETRY;
  let start = 0; // the measure: since when, how many frames
  let frames = 0;
  let measuring = false; // false: the next frame starts a measure
  let settled = -Infinity;
  let climb = -Infinity;
  let slowMs = 0; // too heavy: how long, over how many measures
  let slowMeasures = 0;
  let insisted = false; // the reader asked to draw anyway
  let lowest = FLOOR; // the floor of auto: 1 for a scene with a lighter version
  let drawn = 1; // the ratio last returned
  let slowFor = 0; // slow, for @gpu (slow): how long, over how many measures
  let slowCount = 0;
  let slow = false;

  const floor = () => Math.min(lowest, ceiling);
  const current = () => Math.min(Math.max(level ?? ceiling, floor()), ceiling);

  // A new scene or a new choice: no ratio is known to be too slow
  function forget() {
    cap = Infinity;
    retryAt = -Infinity;
    wait = RETRY;
    slowMs = 0;
    slowMeasures = 0;
  }

  function change(now: number, next: number) {
    level = next;
    settled = now + (warming ? WARM_SETTLE : SETTLE);
    climb = now + CLIMB;
  }

  // Frames this slow at the lowest ratio, for long enough: the scene is too heavy
  function heavy(fps: number, ms: number): boolean {
    const lowest = choice !== "auto" || current() <= floor();
    if (insisted || fps >= STOP || !lowest) {
      slowMs = 0;
      slowMeasures = 0;
      return false;
    }
    slowMs += ms;
    slowMeasures++;
    if (ms < FROZEN_MS && (slowMs < HEAVY_MS || slowMeasures < HEAVY_MEASURES)) return false;
    slowMs = 0;
    slowMeasures = 0;
    return true;
  }

  // Frames slow at the lowest ratio, for long enough: the GPU is slow, and stays so
  function measureSlow(fps: number, ms: number): void {
    if (slow) return;
    const lowestNow =
      choice === "auto" ? current() <= floor() : drawn * Math.sqrt(fps / TARGET) < Math.min(1, ceiling);
    if (fps >= SLOW || !lowestNow) {
      slowFor = 0;
      slowCount = 0;
      return;
    }
    slowFor += ms;
    slowCount++;
    slow = slowFor >= SLOW_MS && slowCount >= SLOW_MEASURES;
  }

  function decide(now: number, fps: number) {
    const ratio = current();
    if (fps < SLOW) {
      warming = false;
      const next = Math.max(floor(), Math.floor((ratio * Math.sqrt(fps / TARGET)) / STEP) * STEP);
      if (next < ratio) {
        const expired = now >= retryAt;
        if (expired && ratio >= cap) wait = Math.min(wait * 2, RETRY_MAX); // a try that failed
        cap = expired ? ratio : Math.min(cap, ratio);
        retryAt = now + wait;
        change(now, next);
      }
    } else if (fps >= FAST && (warming || now >= climb)) {
      const next = Math.min(ratio + (warming ? WARM_STEP : STEP), ceiling);
      if (next >= ceiling) warming = false;
      if (next > ratio && (next < cap || now >= retryAt)) change(now, next);
    }
  }

  return {
    get choice(): DensityChoice {
      return choice;
    },
    // The viewer's choice: auto starts again, light
    choose(next: DensityChoice): void {
      choice = next;
      level = FLOOR;
      warming = next === "auto";
      forget();
    },
    // The ratio the canvas renders at. scene: the scene's ratio, pixelRatio(dpr, screen)
    ratio(scene: number, screen: number): number {
      ceiling = scene;
      drawn = choice === "auto" ? current() : Math.min(choice, screen);
      return drawn;
    },
    // One frame drawn, at `now` (ms). true: the scene is too heavy, the view stops
    frame(now: number): boolean {
      // Settling: no measure yet. The first frame after it starts one.
      if (!measuring || now < settled) {
        measuring = now >= settled;
        start = now;
        frames = 0;
        return false;
      }
      frames++;
      const ms = now - start;
      if (ms < (warming ? WARM_WINDOW : WINDOW)) return false;
      const fps = (frames * 1000) / ms;
      start = now;
      frames = 0;
      const tooHeavy = heavy(fps, ms);
      measureSlow(fps, ms);
      if (choice === "auto") decide(now, fps);
      return tooHeavy;
    },
    // The frames stopped (a pause, a hidden page): the next one starts a new measure
    resume(now: number): void {
      measuring = false;
      settled = Math.max(settled, now);
    },
    // A new scene: it may cost more or less, and its compile is not a slow frame
    restart(now: number): void {
      forget();
      measuring = false;
      settled = now + SETTLE;
    },
    // The reader asked to draw anyway: never too heavy again
    insist(): void {
      insisted = true;
    },
    // The lowest ratio auto draws at: 1 for a scene with a lighter version (@gpu), 0.5 otherwise
    floor(ratio: number): void {
      lowest = ratio;
    },
    // The GPU could not keep up at the lowest ratio, for more than a second: true for good
    get slow(): boolean {
      return slow;
    },
  };
}
