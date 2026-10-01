import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readTransition } from "./transition";
import { compileScene } from "../index";

const transitionOf = (source: string) => readTransition(tokenize(source));
const EASE = { type: "cubic-bezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };

describe("readTransition", () => {
  it("is null when nothing is written, or none: the change is instant", () => {
    expect(readTransition(undefined)).toBeNull();
    expect(transitionOf("none")).toBeNull();
  });

  it("reads a duration, with ease by default, like CSS", () => {
    expect(transitionOf("0.3s")).toEqual({
      duration: 0.3,
      delay: 0,
      easing: EASE,
    });
    expect(transitionOf("300ms")).toEqual({
      duration: 0.3,
      delay: 0,
      easing: EASE,
    });
  });

  it("reads the easing and the delay, in any order, and all", () => {
    expect(transitionOf("all 0.5s ease-out 0.1s")).toEqual({
      duration: 0.5,
      delay: 0.1,
      easing: { type: "cubic-bezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
    });
    expect(transitionOf("cubic-bezier(0.2, 0, 0, 1) 1s")?.easing).toEqual({
      type: "cubic-bezier",
      x1: 0.2,
      y1: 0,
      x2: 0,
      y2: 1,
    });
    expect(transitionOf("1s linear(0, 1 50%, 1)")?.easing.type).toBe("linear");
  });

  it("accepts a negative delay: the transition starts partway, like CSS", () => {
    expect(transitionOf("1s -0.5s")?.delay).toBe(-0.5);
  });

  it("is null for 0s: nothing to glide", () => {
    expect(transitionOf("0s")).toBeNull();
  });

  it("asks for one transition for the whole object", () => {
    expect(() => transitionOf("scale 0.3s")).toThrow(
      "transition applies to every property",
    );
    expect(() => transitionOf("0.3s, 1s")).toThrow("one transition per object");
  });

  it("rejects what is not a transition", () => {
    expect(() => transitionOf("ease")).toThrow("transition expects");
    expect(() => transitionOf("0.3")).toThrow("transition expects");
    expect(() => transitionOf("-1s")).toThrow("transition expects");
    expect(() => transitionOf("1s 1s 1s")).toThrow("transition expects");
  });
});

describe("transition in compileScene", () => {
  const compiled = (rules: string) =>
    compileScene(`@scene { cube#a; cube#b; sphere; } ${rules}`);

  it("gives each hover slot the transition to enter :hover and to leave it", () => {
    const { transitions } = compiled(
      "cube { transition: 1s linear; } cube:hover { scale: 1.2; }",
    );
    expect(transitions).toHaveLength(2); // the two cubes; the sphere has no :hover
    expect(transitions[0].enter?.duration).toBe(1);
    expect(transitions[0].leave?.duration).toBe(1);
  });

  it("enters with the transition of :hover, leaves with the one at rest, like CSS", () => {
    const [slot] = compiled(
      "#a { transition: 1s; } #a:hover { scale: 1.2; transition: 0.2s; }",
    ).transitions;
    expect(slot.enter?.duration).toBe(0.2);
    expect(slot.leave?.duration).toBe(1);
  });

  it("is instant without a transition, as before", () => {
    const [slot] = compiled("#a:hover { scale: 1.2; }").transitions;
    expect(slot).toEqual({ enter: null, leave: null });
  });

  it("reads var() and calc(), like every property", () => {
    const [slot] = compiled(
      "scene { --t: 0.4s; } #a { transition: calc(var(--t) * 2) ease-in; } #a:hover { scale: 1.2; }",
    ).transitions;
    expect(slot.enter?.duration).toBeCloseTo(0.8);
  });

  it("can be written in a :hover rule, though it is not animatable", () => {
    expect(() =>
      compiled("#a:hover { transition: 0.3s; scale: 1.2; }"),
    ).not.toThrow();
  });
});
