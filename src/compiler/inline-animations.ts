// For the tests: puts the values animate() computes back where map() reads them,
// so a test can check an animated expression where it acts ("q -= mix(…)").
export function inlineAnimations(shader: string): string {
  const values = new Map<string, string>();
  for (const [, name, expr] of shader.matchAll(/^ {2}(anim\d+) = (.*);$/gm)) values.set(name, expr);
  return shader.replace(/\banim\d+\b/g, (name) => values.get(name) ?? name);
}
