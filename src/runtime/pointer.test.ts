// hover-distance() glides (decision 216): uPointer = [the object now, the one before, how far
// the place glided from one to the other, how present an object under the pointer is]
import { describe, expect, it } from "vitest";
import { createPointer } from "./pointer";
import type { Transition } from "../compiler/features/transition";

const linear: Transition = { duration: 1, delay: 0, easing: { type: "linear", points: [{ input: 0, output: 0 }, { input: 1, output: 1 }] } };

describe("createPointer", () => {
  it("jumps without a transition", () => {
    const pointer = createPointer(null);
    expect([...pointer.update(3, 0)]).toEqual([3, 3, 1, 1]);
    expect([...pointer.update(0, 10)]).toEqual([3, 3, 1, 0]);
  });

  it("fades in where the first object is, and out where the last one was", () => {
    const pointer = createPointer(linear);
    expect([...pointer.update(3, 0)]).toEqual([3, 3, 1, 0]);
    expect(pointer.update(3, 500)[3]).toBeCloseTo(0.5);
    expect(pointer.update(0, 1000)[3]).toBeCloseTo(1);
    expect([...pointer.update(0, 1500)].slice(0, 2)).toEqual([3, 3]); // the place stays while it fades
    expect(pointer.update(0, 1500)[3]).toBeCloseTo(0.5);
  });

  it("glides from the object hovered before to the one hovered now", () => {
    const pointer = createPointer(linear);
    pointer.update(3, 0);
    pointer.update(3, 1000);
    expect([...pointer.update(5, 1000)]).toEqual([5, 3, 0, 1]);
    expect(pointer.update(5, 1250)[2]).toBeCloseTo(0.25);
    expect(pointer.update(5, 2000)[2]).toBe(1);
  });

  it("jumps when motion is reduced", () => {
    const pointer = createPointer(linear);
    expect([...pointer.update(3, 0, true)]).toEqual([3, 3, 1, 1]);
  });
});
