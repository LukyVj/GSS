import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readAnimation, readAnimations } from "./animation";
import type { Styles } from "../cascade/resolve";

// Styles from "property: value" pairs, as the cascade gives them
const styles = (declarations: Record<string, string>): Styles =>
  Object.fromEntries(
    Object.entries(declarations).map(([p, v]) => [p, tokenize(v)]),
  );
const read = (animation: string, more: Record<string, string> = {}) =>
  readAnimation(styles({ animation, ...more }))!;

describe("readAnimation: the shorthand", () => {
  it("is null without an animation", () => {
    expect(readAnimation({})).toBeNull();
  });

  it("loops forever by default, as GSS always did", () => {
    expect(read("float 2s")).toMatchObject({
      name: { value: "float" },
      duration: 2,
      delay: 0,
      iterations: Infinity,
      direction: "normal",
      fill: "none",
      easing: null,
    });
  });

  it("reads alternate, as before", () => {
    expect(read("float 2s ease-in-out alternate")).toMatchObject({
      direction: "alternate",
      easing: { type: "cubic-bezier" },
    });
  });

  it("reads the second time as the delay, like CSS", () => {
    expect(read("float 2s 500ms").delay).toBe(0.5);
    expect(read("float 2s -1s").delay).toBe(-1);
  });

  it("reads a number of iterations, and infinite", () => {
    expect(read("float 2s 3").iterations).toBe(3);
    expect(read("float 2s 1.5").iterations).toBe(1.5);
    expect(read("float 2s infinite").iterations).toBe(Infinity);
  });

  it("reads every direction and fill mode", () => {
    expect(read("float 2s reverse").direction).toBe("reverse");
    expect(read("float 2s alternate-reverse").direction).toBe(
      "alternate-reverse",
    );
    for (const fill of ["none", "forwards", "backwards", "both"])
      expect(read(`float 2s ${fill}`).fill).toBe(fill);
  });

  it("takes everything at once, in any order after the name", () => {
    expect(read("float ease-out 1 2s forwards 0.5s reverse")).toMatchObject({
      duration: 2,
      delay: 0.5,
      iterations: 1,
      direction: "reverse",
      fill: "forwards",
    });
  });

  it("rejects what it cannot read", () => {
    expect(() => read("float")).toThrow("animation needs a duration");
    expect(() => read("float 2s 1s 3s")).toThrow("animation expects");
    expect(() => read("float 2s -2")).toThrow("animation expects");
    expect(() => read("float 2s 3 4")).toThrow("animation expects");
    expect(() => read("float 2s reverse alternate")).toThrow(
      "animation expects",
    );
    expect(() => read("float 2s paused")).toThrow("animation expects");
  });
});

describe("readAnimation: the longhands", () => {
  it("override what the shorthand says", () => {
    expect(
      read("float 2s", {
        "animation-duration": "1s",
        "animation-delay": "0.2s",
        "animation-iteration-count": "2",
        "animation-direction": "alternate",
        "animation-fill-mode": "both",
        "animation-timing-function": "ease-in",
      }),
    ).toMatchObject({
      duration: 1,
      delay: 0.2,
      iterations: 2,
      direction: "alternate",
      fill: "both",
      easing: { type: "cubic-bezier", x1: 0.42 },
    });
  });

  it("need an animation to change", () => {
    expect(() => readAnimation(styles({ "animation-delay": "1s" }))).toThrow(
      "animation-delay changes an animation",
    );
  });

  it("reject a wrong value", () => {
    expect(() =>
      read("float 2s", { "animation-iteration-count": "-1" }),
    ).toThrow("animation-iteration-count expects");
    expect(() => read("float 2s", { "animation-direction": "up" })).toThrow(
      "animation-direction expects",
    );
    expect(() => read("float 2s", { "animation-delay": "2" })).toThrow(
      "animation-delay expects",
    );
  });
});

describe("readAnimations: a list of animations, like CSS", () => {
  const list = (animation: string, more: Record<string, string> = {}) => readAnimations(styles({ animation, ...more }));

  it("reads one animation per comma, each with its own settings", () => {
    const [a, b] = list("spin 2s linear, float 1s 0.5s 3 alternate");
    expect(a).toMatchObject({ name: { value: "spin" }, duration: 2, iterations: Infinity });
    expect(b).toMatchObject({ name: { value: "float" }, duration: 1, delay: 0.5, iterations: 3, direction: "alternate" });
  });

  it("keeps the commas inside an easing", () => {
    const animations = list("spin 2s cubic-bezier(0.1, 0.7, 1, 0.1), float 1s");
    expect(animations.map((a) => a.name.value)).toEqual(["spin", "float"]);
    expect(animations[0].easing).toMatchObject({ type: "cubic-bezier", x1: 0.1, y2: 0.1 });
  });

  it("gives each animation its value of a longhand, the list repeated when it is shorter", () => {
    const animations = list("a 1s, b 1s, c 1s", { "animation-direction": "reverse, alternate" });
    expect(animations.map((a) => a.direction)).toEqual(["reverse", "alternate", "reverse"]);
  });

  it("reads one timeline per animation", () => {
    const animations = list("a 1s, b 1s", { "animation-timeline": "--one, view()" });
    expect(animations.map((a) => a.timeline)).toEqual([
      { type: "named", name: "--one" },
      { type: "view", axis: "block" },
    ]);
  });

  it("reads one range per animation", () => {
    const [a, b] = list("a 1s, b 1s", { "animation-timeline": "view()", "animation-range": "entry, exit" });
    expect(a.timeline).toMatchObject({ range: { start: { name: "entry" } } });
    expect(b.timeline).toMatchObject({ range: { start: { name: "exit" } } });
  });

  it("leaves out none, like an animation-name of none in CSS", () => {
    expect(list("none, b 1s").map((a) => a.name.value)).toEqual(["b"]);
    expect(list("none")).toEqual([]);
  });

  it("refuses an empty animation in the list", () => {
    expect(() => list("a 1s, , b 1s")).toThrow(/animation needs/);
  });
});
