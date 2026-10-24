// What the attributes of <gss-scene> mean (decision 63), without the DOM.

// controls: on by default, like the playground (drag turns, the wheel zooms).
// "none", "false" or "off": only :hover, the page scrolls over the scene.
export function readControls(value: string | null): boolean {
  if (value === null) return true;
  return !["none", "false", "off"].includes(value.trim().toLowerCase());
}

// src is read against the page; the result is also the base of the scene's images
export function sourceUrl(src: string, page: string): string {
  return new URL(src, page).href;
}

// gpu (decision 211): "auto" by default, the frames say when the GPU is slow; "slow" shows
// the version of the scene for a slow GPU, @gpu (slow), from the start
export function readGpu(value: string | null): "auto" | "slow" {
  const choice = (value ?? "auto").trim().toLowerCase();
  if (choice !== "auto" && choice !== "slow") throw new Error('gpu must be "auto" or "slow"');
  return choice;
}
