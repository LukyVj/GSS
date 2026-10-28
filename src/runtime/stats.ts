// scene.stats() (decision 229): how fast the scene draws, for a page that adapts to it. The
// frames of the last whole second, and the ratio of the last frame (the dpr the canvas draws
// at, after adaptDpr). 0 frames per second until a second has gone by.
export type Stats = { fps: number; ratio: number };

export function createStats() {
  let start: number | null = null;
  let frames = 0;
  let fps = 0;
  let ratio = 1;
  return {
    // One frame drawn at `now` (ms), at this ratio
    frame(now: number, drawn: number): void {
      ratio = drawn;
      if (start === null) {
        start = now;
        frames = 0;
        return;
      }
      frames++;
      if (now - start >= 1000) {
        fps = (frames * 1000) / (now - start);
        start = now;
        frames = 0;
      }
    },
    // The frames stopped: the next one starts a measure
    resume(): void {
      start = null;
    },
    read(): Stats {
      return { fps, ratio };
    },
  };
}
