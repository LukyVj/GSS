import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { readAnimation } from "./animation";
import type { Styles } from "./resolve";

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
