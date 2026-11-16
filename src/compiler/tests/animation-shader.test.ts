import { describe, it, expect } from "vitest";
import { compileScene } from "../index";

// How the shader plays an animation: delay, iterations, direction, fill mode
const shaderOf = (animation: string, extra = "") =>
  compileScene(
    `@scene { sphere; } sphere { translate: 0 1 0; animation: ${animation}; ${extra} } @keyframes move { to { translate: 0 2 0; } }`,
  ).shader;

describe("animation controls in the shader", () => {
  it("keeps the loops written before the same, in the same words", () => {
    expect(shaderOf("move 2s")).toContain("fract(iTime / 2.0)");
    expect(shaderOf("move 2s alternate")).toContain(
      "(1.0 - abs(mod(iTime / 2.0, 2.0) - 1.0))",
    );
    expect(shaderOf("move 2s infinite")).toBe(shaderOf("move 2s"));
    expect(shaderOf("move 2s normal none")).toBe(shaderOf("move 2s"));
    expect(shaderOf("move 2s")).not.toContain("playhead");
  });

  it("plays the rest with playhead(), written once, only when used", () => {
    const shader = shaderOf("move 2s 3 reverse");
    expect(shader).toContain("playhead(iTime, 2.0, 3.0, 1)");
    expect(shader.match(/float playhead\(/g)).toHaveLength(1);
  });

  it("starts after the delay", () => {
    expect(shaderOf("move 2s 0.5s backwards")).toContain(
      "playhead(iTime - 0.5, 2.0, 1000000000.0, 0)",
    );
    expect(shaderOf("move 2s -0.5s")).toContain("playhead(iTime + 0.5, 2.0");
  });

  it("numbers the directions: normal 0, reverse 1, alternate 2, alternate-reverse 3", () => {
    expect(shaderOf("move 2s 2 alternate")).toContain(", 2.0, 2)");
    expect(shaderOf("move 2s alternate-reverse")).toContain(", 3)");
  });

  it("shows the object's own value before the delay and after the end, like CSS", () => {
    // fill none, a delay and 2 iterations: the animation only plays in between
    expect(shaderOf("move 2s 1s 2")).toContain(
      "((iTime >= 1.0 && iTime < 5.0) ? ",
    );
  });

  it("holds the first frame during the delay with backwards, the last one with forwards", () => {
    expect(shaderOf("move 2s 1s 2 backwards")).toContain("((iTime < 5.0) ? ");
    expect(shaderOf("move 2s 1s 2 forwards")).toContain("((iTime >= 1.0) ? ");
    expect(shaderOf("move 2s 1s 2 both")).not.toContain("((iTime");
  });

  it("ends exactly on the last keyframe, like CSS: the last segment is measured from the end", () => {
    // (1.0 - 0.99) / 0.01 is a little under 1 in floats: an animation that ended on
    // visibility: hidden left the object visible, and step-end missed its last step
    const ending = (animation: string) =>
      compileScene(
        `@scene { sphere; } sphere { animation: ${animation}; } @keyframes k { 0% { visibility: visible; } 99% { visibility: visible; } 100% { visibility: hidden; } }`,
      ).shader;
    expect(ending("k 1s 1 both")).toContain(
      "clamp(1.0 - (1.0 - playhead(iTime, 1.0, 1.0, 0)) / 0.01, 0.0, 1.0)",
    );
    // The other segments do not change
    expect(ending("k 1s 1 both")).toContain(
      "clamp((playhead(iTime, 1.0, 1.0, 0) - 0.0) / 0.99, 0.0, 1.0)",
    );
    // A loop never stays on its end: its shader is the one GSS always wrote
    expect(ending("k 1s")).toContain("clamp((fract(iTime / 1.0) - 0.99) / 0.01, 0.0, 1.0)");
    expect(ending("k 1s")).not.toContain("1.0 - (1.0 - ");
    expect(ending("k 1s -0.5s")).not.toContain("1.0 - (1.0 - ");
    // A first iteration played backwards stays on its end during a delay that holds it
    expect(ending("k 1s 2s reverse backwards")).toContain("clamp(1.0 - (1.0 - playhead(iTime - 2.0, ");
    // The same at the end of a scroll, and of an animation a state starts
    const keyframes = "@keyframes k { 99% { scale: 1; } to { scale: 2; } }";
    expect(
      compileScene(`@scene { sphere; } sphere { animation: k 1s; animation-timeline: scroll(); } ${keyframes}`).shader,
    ).toContain("clamp(1.0 - (1.0 - uTimeline.x) / 0.01, 0.0, 1.0)");
    expect(
      compileScene(`@scene { sphere; } sphere:hover { animation: k 1s; } ${keyframes}`).shader,
    ).toContain("clamp(1.0 - (1.0 - playhead((iTime - uStart[0]), 1.0, 1.0, 0)) / 0.01, 0.0, 1.0)");
  });

  it("reads the longhands", () => {
    expect(
      shaderOf(
        "move 2s",
        "animation-iteration-count: 1; animation-fill-mode: forwards;",
      ),
    ).toContain("playhead(iTime, 2.0, 1.0, 0)");
  });
});

describe("a list of animations in the shader, like CSS", () => {
  const keyframes = "@keyframes up { to { translate: 0 2 0; } } @keyframes red { to { color: #ff0000; } } @keyframes left { to { translate: -1 1 0; } }";
  const shader = (rules: string) => compileScene(`@scene { sphere; } sphere { translate: 0 1 0; ${rules} } ${keyframes}`).shader;

  it("plays two animations of different properties together", () => {
    const both = shader("animation: up 2s, red 3s;");
    expect(both).toContain("fract(iTime / 2.0)");
    expect(both).toContain("fract(iTime / 3.0)");
  });

  it("is the shader of the one animation when the list holds one", () => {
    expect(shader("animation: up 2s;")).toBe(shader("animation: up 2s, none;"));
  });

  it("lets the last animation of a property win, from the value the ones before it give", () => {
    // left starts from where up is, like CSS starts a missing 0% from the value under it
    const code = shader("animation: up 2s, left 4s 1s 1;");
    const up = code.indexOf("iTime / 2.0");
    const left = code.indexOf("playhead(iTime - 1.0, 4.0");
    expect(up).toBeGreaterThan(-1);
    expect(left).toBeGreaterThan(-1);
    // left starts from where up is, and outside its time gives way to up, not to the rest
    const up2 = "mix(vec3(0.0, 1.0, 0.0), vec3(0.0, 2.0, 0.0), clamp((fract(iTime / 2.0) - 0.0) / 1.0, 0.0, 1.0))";
    expect(code).toContain(`((iTime >= 1.0 && iTime < 5.0) ? mix(${up2}, vec3(-1.0, 1.0, 0.0), `);
    expect(code).toContain(` : ${up2})`);
  });

  it("gives each animation of the list its own timeline", () => {
    const compiled = compileScene(
      `@scene { sphere; } sphere { animation: up 1s, red 1s; animation-timeline: --a, --b; } ${keyframes}`,
    );
    expect(compiled.timelines).toEqual([
      { type: "named", name: "--a" },
      { type: "named", name: "--b" },
    ]);
    expect(compiled.shader).toContain("uTimeline.x");
    expect(compiled.shader).toContain("uTimeline.y");
  });
});
