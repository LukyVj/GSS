// The texts of the status bar (DESIGN.md § 6): real numbers only.

export type Stats = {
  errors: number; // compile errors, 0 when the scene compiled
  objects: number; // instances in the scene
  glslLines: number; // lines of the generated shader
  compileMs: number; // duration of the last compile, in milliseconds
};

// 1 → "1 object", anything else → "n objects"
export function plural(count: number, word: string): string {
  return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

// The pieces of the status bar, left to right
export function statusParts(stats: Stats): string[] {
  if (stats.errors > 0) return [plural(stats.errors, "error")];
  const ms = stats.compileMs < 1 ? "<1" : Math.round(stats.compileMs);
  return ["ok", plural(stats.objects, "object"), `glsl ${plural(stats.glslLines, "line")}`, `compiled in ${ms} ms`];
}

// Frames drawn over a duration → "60 fps"
export function fpsText(frames: number, ms: number): string {
  return `${Math.round((frames * 1000) / ms)} fps`;
}
