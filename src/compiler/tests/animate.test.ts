import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";
import { toShadertoy } from "../shader/shadertoy";

// An animated value depends on the time, not on the point: animate() computes it
// once per pixel, and map() (about 150 calls per pixel) reads it from a global.
const between = (shader: string, from: string, to: string) =>
  shader.slice(shader.indexOf(from), shader.indexOf(to, shader.indexOf(from)));
const mapOf = (shader: string) => between(shader, "vec2 map(vec3 p)", "Material getMaterial");
const animateOf = (shader: string) => between(shader, "void animate() {", "\n}");

const SPIN = `
  @scene { cube; }
  cube { animation: spin 4s; }
  @keyframes spin { to { rotate-y: 1turn; } }
`;

describe("animate()", () => {
  it("computes the animated values, and map() only reads them", () => {
    const shader = compileGSS(SPIN);
    expect(animateOf(shader)).toContain("= rot(mix(0.0, 6.283,");
    expect(mapOf(shader)).not.toContain("iTime");
    expect(mapOf(shader)).toMatch(/q\.xz \*= anim\d+;/);
  });

  it("runs first in main(), before the march and the picking", () => {
    const shader = compileGSS(SPIN);
    expect(shader).toMatch(/void main\(\) \{\n {2}animate\(\);/);
  });

  it("takes the :hover mixes out of map() too", () => {
    const shader = compileGSS("@scene { cube; } cube:hover { translate: 0 1 0; }");
    expect(mapOf(shader)).not.toContain("uHover");
    expect(animateOf(shader)).toContain("uHover[0]");
  });

  it("computes a value shared by several objects once", () => {
    const shader = compileGSS(`
      @scene { cube * 3; }
      cube { animation: spin 4s; }
      @keyframes spin { to { rotate-y: 1turn; } }
    `);
    expect(animateOf(shader).match(/rot\(/g)).toHaveLength(1);
  });

  it("is not there when nothing moves: the shader stays minimal", () => {
    const shader = compileGSS("@scene { cube; } cube { rotate-y: 30deg; }");
    expect(shader).not.toContain("animate");
    expect(mapOf(shader)).toContain("q.xz *= rot(0.524);"); // a constant stays where it acts
  });

  it("is called by the Shadertoy export too", () => {
    expect(toShadertoy(compileScene(SPIN))).toMatch(/void mainImage\(out vec4 outColor, in vec2 fragCoord\) \{\n {2}animate\(\);/);
  });
});
