// The time of a scene (iTime): it only moves while the scene is drawn, so a scene
// that sleeps off screen resumes its animation where it was (decision 63).
export type Clock = {
  // Seconds since the previous tick (0 when frozen), added to `seconds`
  tick(now: number): number;
  // After a pause: the time in between does not count
  resume(now: number): void;
  // prefers-reduced-motion: the time stands still, the scene is still drawn
  freeze(frozen: boolean): void;
  readonly seconds: number;
};

export function createClock(start: number): Clock {
  let last = start;
  let seconds = 0;
  let frozen = false;
  return {
    tick(now) {
      const dt = frozen ? 0 : Math.max(0, (now - last) / 1000);
      last = now;
      seconds += dt;
      return dt;
    },
    resume(now) {
      last = now;
    },
    freeze(next) {
      frozen = next;
    },
    get seconds() {
      return seconds;
    },
  };
}
