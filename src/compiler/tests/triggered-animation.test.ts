import { describe, it, expect } from "vitest";
import { compileScene, compileGSS } from "..";
import { toShadertoy } from "../shader/shadertoy";
import { generateWGSL } from "../shader/wgsl";

// An animation in a :hover or :active rule (decision 141): the state starts it, and
// the state stays on until it ends. The shader plays it from the start time of its
// slot, uStart[k]; the runtime fills uStart[] and holds the slot (runtime/triggers.ts).

const FALL = "@keyframes fall { to { rotate-x: 90deg; } }";
const SCENE = "scene { camera-angle: 0deg 0deg; }";

describe("an animation started by a state", () => {
  it("is accepted in a :active rule, and in a :hover one", () => {
    expect(() => compileScene(`@scene { cube; } cube:active { animation: fall 1s forwards; } ${FALL}`)).not.toThrow();
    expect(() => compileScene(`@scene { cube; } cube:hover { animation: fall 1s; } ${FALL}`)).not.toThrow();
    expect(() =>
      compileScene(`@scene { cube; } cube:active { animation: fall 1s; animation-fill-mode: forwards; } ${FALL}`),
    ).not.toThrow();
  });

  it("still refuses a property that cannot change on :active", () => {
    expect(() => compileScene("@scene { cube; } cube:active { size: 2; }")).toThrow(/cannot change on :active/);
  });

  it("plays from the start time of its slot: uStart[], and iTime - uStart[k]", () => {
    const { shader } = compileScene(`@scene { cube; } cube:active { animation: fall 1s forwards; } ${FALL}`);
    expect(shader).toContain("uniform float uStart[1];");
    expect(shader).toContain("(iTime - uStart[0])");
    expect(shader).not.toMatch(/playhead\(iTime,/);
  });

  it("numbers uStart[] after the slots that start nothing", () => {
    const { shader, triggers } = compileScene(
      `@scene { cube; sphere; } cube:hover { color: red; } sphere:active { animation: fall 1s forwards; } ${FALL}`,
    );
    // slot 0: the cube's :hover, no animation; slot 1: the sphere's :active, uStart[0]
    expect(shader).toContain("uniform float uStart[1];");
    expect(shader).toContain("mix(");
    expect(triggers).toEqual([{ slot: 1, start: 0, hold: null }]);
  });

  it("tells the runtime how long the state holds: the animation's length, or forever", () => {
    const length = (animation: string) =>
      compileScene(`@scene { cube; } cube:active { animation: ${animation}; } ${FALL}`).triggers![0].hold;
    expect(length("fall 2s 1")).toBe(2);
    expect(length("fall 2s 0.5s 3")).toBe(6.5);
    expect(length("fall 2s 1 forwards")).toBe(null); // the last frame stays
    expect(length("fall 2s 1 both")).toBe(null);
    expect(length("fall 2s infinite")).toBe(null);
  });

  it("plays once unless it says how many times: a button fires, it does not loop", () => {
    const compile = (animation: string) =>
      compileScene(`@scene { cube; } cube:active { animation: ${animation}; } ${FALL}`);
    expect(compile("fall 2s").triggers![0].hold).toBe(2);
    expect(compile("fall 2s").shader).toContain("playhead((iTime - uStart[0]), 2.0, 1.0, 0)");
    expect(compile("fall 2s forwards").triggers![0].hold).toBe(null);
    expect(compile("fall 2s infinite").shader).toContain("fract((iTime - uStart[0]) / 2.0)");
    expect(compileScene(`@scene { cube; } cube:active { animation: fall 2s; animation-iteration-count: 3; } ${FALL}`).triggers![0].hold).toBe(6);
  });

  it("leaves the base animation alone: it keeps its own clock", () => {
    const { shader, triggers } = compileScene(
      `@scene { cube; } cube { animation: spin 2s; } cube:active { color: red; } @keyframes spin { to { rotate-y: 360deg; } } ${SCENE}`,
    );
    expect(shader).not.toContain("uStart");
    expect(triggers).toBeUndefined();
  });

  it("compiles every other scene exactly as before: no uStart without a started animation", () => {
    const { shader, triggers } = compileScene("@scene { cube; } cube:active { color: red; }");
    expect(shader).not.toContain("uStart");
    expect(triggers).toBeUndefined();
  });

  it("shows the object at rest on Shadertoy: uStart[] is a constant", () => {
    const compiled = compileScene(`@scene { cube; } cube:active { animation: fall 1s forwards; } ${FALL}`);
    const shadertoy = toShadertoy(compiled);
    expect(shadertoy).toContain("const float uStart[1] = float[1](0.0);");
    expect(shadertoy).not.toMatch(/^uniform/m);
  });

  it("lowers uStart[] to WGSL after the other uniforms", () => {
    const { shader } = compileScene(`@scene { cube; } cube:active { animation: fall 1s forwards; } ${FALL}`);
    const wgsl = generateWGSL(shader);
    expect(wgsl).toContain("hover: array<vec4<f32>, 1>,\n  start: array<vec4<f32>, 1>,\n}");
    expect(wgsl).toContain("gss.start[0].x");
  });

  it("is a registry example that compiles", () => {
    expect(compileGSS(`@scene { cube; } cube { translate: 0 0.5 0; } cube:active { animation: fall 1s forwards; } ${FALL}`)).toBeTruthy();
  });
});
