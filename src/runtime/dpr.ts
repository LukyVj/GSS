import type { Dpr } from "../compiler/dpr";

// The ratio the canvas renders at: the author's dpr, against the screen's
export function pixelRatio(dpr: Dpr, screen: number): number {
  if (dpr === "auto") return Math.min(screen, 2);
  if (dpr === "max") return screen;
  return Math.min(dpr, screen); // a number: never above the screen
}
