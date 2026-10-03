import type { Dpr } from "../compiler/features/dpr";

// The ratio the canvas renders at: the author's dpr, against the screen's
export function pixelRatio(dpr: Dpr, screen: number): number {
  if (dpr === "auto") return Math.min(screen, 2);
  if (dpr === "max") return screen;
  return Math.min(dpr, screen); // a number: never above the screen
}

// The dpr the viewer picks in the docs and the playground (decision 120), over the scene's.
// A number is fixed, never above the screen. "auto" starts at the scene's ratio and follows
// the frame rate, measured over half a second: it drops at once when the frames are slow,
// as much as the frame rate lacks (the pixels cost the square of the ratio), and climbs
// back one step every 2 s. A ratio that was too slow is tried again 8 s later (a hitch
// passes), then twice as late after each try that fails, up to a minute.
export type DensityChoice = "auto" | number;
export type Density = ReturnType<typeof createDensity>;

const WINDOW = 500; // ms of frames per measure
const SETTLE = 500; // ms after a change or a new scene: not measured
const CLIMB = 2000; // ms between a change and the next step up
const GAP = 250; // a frame later than this follows a pause, not a slow frame
const SLOW = 45; // fps: below, drop
const FAST = 57; // fps: from here, climb
const TARGET = 55; // fps a drop aims at
const STEP = 0.25;
const FLOOR = 0.5;
const RETRY = 8000; // ms before a ratio that was too slow is tried again, doubled on each failure
const RETRY_MAX = 64000;

export function createDensity(initial: DensityChoice) {
  let choice = initial;
  let ceiling = 1; // the scene's ratio, as last drawn
  let level: number | null = null; // auto: the ratio drawn now (null: the ceiling)
  let cap = Infinity; // auto: the lowest ratio that was too slow, not tried before `retryAt`
  let retryAt = -Infinity;
  let wait = RETRY;
  let start = 0; // the measure: since when, how many frames
  let frames = 0;
  let last = -Infinity;
  let settled = -Infinity;
  let climb = -Infinity;

  const current = () => Math.min(level ?? ceiling, ceiling);

  // A new scene or a new choice: no ratio is known to be too slow
  function forget() {
    cap = Infinity;
    retryAt = -Infinity;
    wait = RETRY;
  }

  function change(now: number, next: number) {
    level = next;
    settled = now + SETTLE;
    climb = now + CLIMB;
  }

  function decide(now: number, fps: number) {
    const ratio = current();
    if (fps < SLOW) {
      const floor = Math.min(FLOOR, ceiling);
      const next = Math.max(floor, Math.floor((ratio * Math.sqrt(fps / TARGET)) / STEP) * STEP);
      if (next < ratio) {
        const expired = now >= retryAt;
        if (expired && ratio >= cap) wait = Math.min(wait * 2, RETRY_MAX); // a try that failed
        cap = expired ? ratio : Math.min(cap, ratio);
        retryAt = now + wait;
        change(now, next);
      }
    } else if (fps >= FAST && now >= climb) {
      const next = Math.min(ratio + STEP, ceiling);
      if (next > ratio && (next < cap || now >= retryAt)) change(now, next);
    }
  }

  return {
    get choice(): DensityChoice {
      return choice;
    },
    // The viewer's choice: auto starts again from the scene's ratio
    choose(next: DensityChoice): void {
      choice = next;
      level = null;
      forget();
    },
    // The ratio the canvas renders at. scene: the scene's ratio, pixelRatio(dpr, screen)
    ratio(scene: number, screen: number): number {
      ceiling = scene;
      return choice === "auto" ? current() : Math.min(choice, screen);
    },
    // One frame drawn, at `now` (ms)
    frame(now: number): void {
      if (choice !== "auto") return;
      const pause = now - last > GAP;
      last = now;
      if (pause || now < settled) {
        start = now;
        frames = 0;
        return;
      }
      frames++;
      if (now - start < WINDOW) return;
      decide(now, (frames * 1000) / (now - start));
      start = now;
      frames = 0;
    },
    // A new scene: it may cost more or less, and its compile is not a slow frame
    restart(now: number): void {
      forget();
      settled = now + SETTLE;
    },
  };
}
