// hover-distance() measures from the point under the pointer (decision 217): uPointer = [the
// pixel the place is at, x and y, its depth along the ray, how present the pointer is]
import { describe, expect, it } from "vitest";
import { createPointer } from "./pointer";
import type { Transition } from "../compiler/features/transition";

const linear: Transition = { duration: 1, delay: 0, easing: { type: "linear", points: [{ input: 0, output: 0 }, { input: 1, output: 1 }] } };

describe("createPointer", () => {
  it("jumps without a transition", () => {
    const pointer = createPointer(null);
    expect([...pointer.update([10, 20, 5], 0)]).toEqual([10, 20, 5, 1]);
    expect([...pointer.update([30, 20, 4], 5)]).toEqual([30, 20, 4, 1]);
    expect([...pointer.update(null, 10)]).toEqual([30, 20, 4, 0]);
  });

  it("fades in where the pointer arrives, and out where it left", () => {
    const pointer = createPointer(linear);
    expect([...pointer.update([10, 20, 5], 0)]).toEqual([10, 20, 5, 0]);
    expect(pointer.update([10, 20, 5], 500)[3]).toBeCloseTo(0.5);
    expect(pointer.update(null, 1000)[3]).toBeCloseTo(1);
    expect([...pointer.update(null, 1500)].slice(0, 3)).toEqual([10, 20, 5]); // the place stays while it fades
    expect(pointer.update(null, 1500)[3]).toBeCloseTo(0.5);
  });

  it("glides to the point under the pointer, from where it was", () => {
    const pointer = createPointer(linear);
    pointer.update([0, 0, 4], 0);
    pointer.update([0, 0, 4], 1000);
    expect([...pointer.update([100, 0, 8], 1000)]).toEqual([0, 0, 4, 1]);
    const half = pointer.update([100, 0, 8], 1500);
    expect(half[0]).toBeCloseTo(50);
    expect(half[2]).toBeCloseTo(6);
    // the pointer moves on: the glide starts again from where the place is now, like CSS
    const again = pointer.update([200, 0, 8], 1500);
    expect(again[0]).toBeCloseTo(50);
    expect(pointer.update([200, 0, 8], 2000)[0]).toBeCloseTo(125);
    expect(pointer.update([200, 0, 8], 2500)[0]).toBe(200);
  });

  it("jumps when motion is reduced", () => {
    const pointer = createPointer(linear);
    expect([...pointer.update([10, 20, 5], 0, true)]).toEqual([10, 20, 5, 1]);
    expect([...pointer.update([40, 20, 5], 10, true)]).toEqual([40, 20, 5, 1]);
  });
});
