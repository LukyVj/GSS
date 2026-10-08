import { describe, it, expect } from "vitest";
import { createTriggers } from "./triggers";

// A state that starts an animation (decision 141): once triggered, its slot stays at
// 1 until the animation ends, button up or not, and uStart[] gets the start time.

describe("createTriggers", () => {
  it("passes the targets through when no state starts an animation", () => {
    const triggers = createTriggers([], 1);
    const { targets, starts } = triggers.update(Float32Array.of(1), 10);
    expect([...targets]).toEqual([1]);
    expect(starts.length).toBe(0);
  });

  it("holds the slot at 1 for the length of the animation, released or not", () => {
    const triggers = createTriggers([{ slot: 0, start: 0, hold: 2 }], 1);
    expect([...triggers.update(Float32Array.of(1), 10).targets]).toEqual([1]);
    expect([...triggers.update(Float32Array.of(0), 11).targets]).toEqual([1]);
    expect([...triggers.update(Float32Array.of(0), 11.9).targets]).toEqual([1]);
    expect([...triggers.update(Float32Array.of(0), 12).targets]).toEqual([0]);
  });

  it("holds it forever when the last frame stays", () => {
    const triggers = createTriggers([{ slot: 0, start: 0, hold: null }], 1);
    triggers.update(Float32Array.of(1), 10);
    expect([...triggers.update(Float32Array.of(0), 1000).targets]).toEqual([1]);
  });

  it("writes the start time of each started animation in uStart[]", () => {
    const triggers = createTriggers([{ slot: 1, start: 0, hold: null }], 2);
    expect([...triggers.update(Float32Array.of(0, 0), 5).starts]).toEqual([0]);
    expect([...triggers.update(Float32Array.of(0, 1), 7.5).starts]).toEqual([7.5]);
    expect([...triggers.update(Float32Array.of(0, 0), 9).starts]).toEqual([7.5]);
  });

  it("restarts on a new press, like CSS when the class comes back", () => {
    const triggers = createTriggers([{ slot: 0, start: 0, hold: null }], 1);
    triggers.update(Float32Array.of(1), 1);
    triggers.update(Float32Array.of(0), 2); // released: still held
    const { starts, targets } = triggers.update(Float32Array.of(1), 3);
    expect([...starts]).toEqual([3]);
    expect([...targets]).toEqual([1]);
  });

  it("keeps a press that lasts longer than the animation", () => {
    const triggers = createTriggers([{ slot: 0, start: 0, hold: 1 }], 1);
    triggers.update(Float32Array.of(1), 0);
    expect([...triggers.update(Float32Array.of(1), 5).targets]).toEqual([1]);
    expect([...triggers.update(Float32Array.of(0), 5).targets]).toEqual([0]);
  });

  it("leaves the other slots alone", () => {
    const triggers = createTriggers([{ slot: 1, start: 0, hold: null }], 2);
    triggers.update(Float32Array.of(1, 1), 0);
    expect([...triggers.update(Float32Array.of(0, 0), 1).targets]).toEqual([0, 1]);
  });

  it("forgets everything on reset: a new scene", () => {
    const triggers = createTriggers([{ slot: 0, start: 0, hold: null }], 1);
    triggers.update(Float32Array.of(1), 0);
    triggers.reset();
    expect([...triggers.update(Float32Array.of(0), 1).targets]).toEqual([0]);
  });
});
