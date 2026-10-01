import { describe, it, expect } from "vitest";
import { createTransitions } from "./transitions";
import type { Transition } from "../compiler/transition";
import type { Easing } from "../compiler/easing";

const LINEAR: Easing = {
  type: "linear",
  points: [
    { input: 0, output: 0 },
    { input: 1, output: 1 },
  ],
};
const glide = (
  duration: number,
  delay = 0,
  easing: Easing = LINEAR,
): Transition => ({
  duration,
  delay,
  easing,
});
const ON = Float32Array.of(1);
const OFF = Float32Array.of(0);

// One slot of uHover[]: update(targets, now in ms) → the values the shader gets

describe("createTransitions", () => {
  it("jumps without a transition, as before", () => {
    const slots = createTransitions([{ enter: null, leave: null }]);
    expect(slots.update(ON, 0)[0]).toBe(1);
    expect(slots.update(OFF, 10)[0]).toBe(0);
  });

  it("glides to 1 with the enter transition", () => {
    const slots = createTransitions([{ enter: glide(1), leave: null }]);
    expect(slots.update(ON, 1000)[0]).toBe(0);
    expect(slots.update(ON, 1500)[0]).toBeCloseTo(0.5);
    expect(slots.update(ON, 2000)[0]).toBe(1);
    expect(slots.update(ON, 9000)[0]).toBe(1);
  });

  it("glides back to 0 with the leave transition", () => {
    const slots = createTransitions([{ enter: null, leave: glide(2) }]);
    slots.update(ON, 0); // instant: 1
    expect(slots.update(OFF, 1000)[0]).toBe(1);
    expect(slots.update(OFF, 2000)[0]).toBeCloseTo(0.5);
    expect(slots.update(OFF, 3000)[0]).toBe(0);
  });

  it("waits for the delay", () => {
    const slots = createTransitions([{ enter: glide(1, 0.5), leave: null }]);
    slots.update(ON, 0);
    expect(slots.update(ON, 250)[0]).toBe(0);
    expect(slots.update(ON, 1000)[0]).toBeCloseTo(0.5);
  });

  it("jumps after the delay when the duration is 0", () => {
    const slots = createTransitions([{ enter: glide(0, 0.5), leave: null }]);
    expect(slots.update(ON, 0)[0]).toBe(0);
    expect(slots.update(ON, 499)[0]).toBe(0);
    expect(slots.update(ON, 500)[0]).toBe(1);
  });

  it("starts partway with a negative delay", () => {
    const slots = createTransitions([{ enter: glide(1, -0.5), leave: null }]);
    expect(slots.update(ON, 0)[0]).toBeCloseTo(0.5);
  });

  it("goes back from where it is, in the time already spent, like CSS", () => {
    const slots = createTransitions([{ enter: glide(1), leave: glide(1) }]);
    slots.update(ON, 0);
    expect(slots.update(ON, 500)[0]).toBeCloseTo(0.5);
    // the mouse leaves halfway: half the way back, in half the duration
    expect(slots.update(OFF, 500)[0]).toBeCloseTo(0.5);
    expect(slots.update(OFF, 750)[0]).toBeCloseTo(0.25);
    expect(slots.update(OFF, 1000)[0]).toBe(0);
  });

  it("follows the easing, and can overshoot", () => {
    const ease: Easing = {
      type: "cubic-bezier",
      x1: 0.25,
      y1: 0.1,
      x2: 0.25,
      y2: 1,
    };
    const slots = createTransitions([
      { enter: glide(1, 0, ease), leave: null },
    ]);
    slots.update(ON, 0);
    expect(slots.update(ON, 500)[0]).toBeCloseTo(0.8024, 3);

    const back: Easing = {
      type: "cubic-bezier",
      x1: 0.3,
      y1: -0.5,
      x2: 0.7,
      y2: 1.5,
    };
    const bouncy = createTransitions([
      { enter: glide(1, 0, back), leave: null },
    ]);
    bouncy.update(ON, 0);
    expect(bouncy.update(ON, 100)[0]).toBeLessThan(0);
  });

  it("keeps each slot on its own", () => {
    const slots = createTransitions([
      { enter: glide(1), leave: null },
      { enter: null, leave: null },
    ]);
    const values = slots.update(Float32Array.of(1, 1), 0);
    expect([...values]).toEqual([0, 1]);
  });

  it("jumps when motion is reduced (prefers-reduced-motion)", () => {
    const slots = createTransitions([{ enter: glide(1), leave: glide(1) }]);
    expect(slots.update(ON, 0, true)[0]).toBe(1);
    expect(slots.update(OFF, 10, true)[0]).toBe(0);
  });
});
