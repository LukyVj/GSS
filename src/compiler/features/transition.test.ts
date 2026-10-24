import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readTransition, readTransitions, transitionOf } from "./transition";
import { compileScene } from "../index";

const single = (source: string) => readTransition(tokenize(source));
const EASE = { type: "cubic-bezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };

describe("readTransition", () => {
  it("is null when nothing is written, or none: the change is instant", () => {
    expect(readTransition(undefined)).toBeNull();
    expect(single("none")).toBeNull();
  });

  it("reads a duration, with ease by default, like CSS", () => {
    expect(single("0.3s")).toEqual({
      duration: 0.3,
      delay: 0,
      easing: EASE,
    });
    expect(single("300ms")).toEqual({
      duration: 0.3,
      delay: 0,
      easing: EASE,
    });
  });

  it("reads the easing and the delay, in any order, and all", () => {
    expect(single("all 0.5s ease-out 0.1s")).toEqual({
      duration: 0.5,
      delay: 0.1,
      easing: { type: "cubic-bezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
    });
    expect(single("cubic-bezier(0.2, 0, 0, 1) 1s")?.easing).toEqual({
      type: "cubic-bezier",
      x1: 0.2,
      y1: 0,
      x2: 0,
      y2: 1,
    });
    expect(single("1s linear(0, 1 50%, 1)")?.easing.type).toBe("linear");
  });

  it("accepts a negative delay: the transition starts partway, like CSS", () => {
    expect(single("1s -0.5s")?.delay).toBe(-0.5);
  });

  it("is null for 0s: nothing to glide", () => {
    expect(single("0s")).toBeNull();
  });

  it("rejects what is not a transition", () => {
    expect(() => single("ease")).toThrow("transition expects");
    expect(() => single("0.3")).toThrow("transition expects");
    expect(() => single("-1s")).toThrow("transition expects");
    expect(() => single("1s 1s 1s")).toThrow("transition expects");
  });
});

describe("readTransitions: one transition per property, like CSS", () => {
  const entries = (styles: Record<string, string>) =>
    readTransitions(Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, tokenize(v)])));
  const durations = (styles: Record<string, string>) =>
    entries(styles).map(({ property, transition }) => [property, transition?.duration ?? null]);

  it("reads a list, each item with its property, all by default", () => {
    expect(durations({ transition: "scale 0.2s, color 1s" })).toEqual([["scale", 0.2], ["color", 1]]);
    expect(durations({ transition: "0.3s" })).toEqual([["all", 0.3]]);
    expect(entries({ transition: "color 1s ease-out 0.1s" })[0].transition).toEqual({
      duration: 1,
      delay: 0.1,
      easing: { type: "cubic-bezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
    });
  });

  it("gives each property the last item that names it, like CSS", () => {
    const list = entries({ transition: "all 1s, scale 0.2s" });
    expect(transitionOf(list, "scale")?.duration).toBe(0.2);
    expect(transitionOf(list, "color")?.duration).toBe(1);
    expect(transitionOf(entries({ transition: "scale 0.2s, all 1s" }), "scale")?.duration).toBe(1);
  });

  it("leaves a property the list does not name instant", () => {
    expect(transitionOf(entries({ transition: "scale 0.2s" }), "color")).toBeNull();
    expect(transitionOf(entries({}), "scale")).toBeNull();
    expect(entries({ transition: "none" })).toEqual([]);
  });

  it("glides the properties of a shorthand with it", () => {
    expect(transitionOf(entries({ transition: "outline 0.5s" }), "outline-color")?.duration).toBe(0.5);
  });

  it("reads the longhands, which win over the shorthand, a short list repeated", () => {
    expect(
      durations({ "transition-property": "scale, color, opacity", "transition-duration": "0.2s, 1s" }),
    ).toEqual([["scale", 0.2], ["color", 1], ["opacity", 0.2]]);
    expect(durations({ transition: "scale 0.2s, color 1s", "transition-duration": "3s" })).toEqual([
      ["scale", 3],
      ["color", 3],
    ]);
    const [entry] = entries({
      "transition-duration": "1s",
      "transition-timing-function": "linear",
      "transition-delay": "0.5s",
    });
    expect(entry).toEqual({ property: "all", transition: { duration: 1, delay: 0.5, easing: { type: "linear", points: expect.anything() } } });
    expect(entries({ transition: "1s", "transition-property": "none" })).toEqual([]);
  });

  it("is instant for an item of 0s: nothing to glide", () => {
    expect(entries({ "transition-property": "scale" })).toEqual([{ property: "scale", transition: null }]);
    expect(transitionOf(entries({ transition: "all 1s, scale 0s" }), "scale")).toBeNull();
  });

  it("rejects an unknown property and a malformed list", () => {
    expect(() => entries({ transition: "scael 1s" })).toThrow('Unknown property "scael"');
    expect(() => entries({ transition: "scale color 1s" })).toThrow("transition expects");
    expect(() => entries({ transition: "scale 1s, none" })).toThrow("none stands alone");
    expect(() => entries({ "transition-duration": "fast" })).toThrow("transition-duration expects");
    expect(() => entries({ "transition-timing-function": "1s" })).toThrow("transition-timing-function expects");
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
