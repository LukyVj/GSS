import { describe, it, expect } from "vitest";
import { summarize, createSamples } from "./stats";

describe("summarize", () => {
  const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1); // 1 … 100 ms

  it("gives the median, p95 and p99 of the frame times", () => {
    expect(summarize(oneToHundred)).toEqual({
      count: 100,
      meanMs: 50.5,
      medianMs: 50,
      p95Ms: 95,
      p99Ms: 99,
    });
  });
  it("does not care about the order of the samples", () => {
    expect(summarize([...oneToHundred].reverse())).toEqual(
      summarize(oneToHundred),
    );
  });
  it("sorts numbers as numbers, not as text", () => {
    expect(summarize([9, 10, 100])?.medianMs).toBe(10);
  });
  it("ignores what is not a frame: NaN, Infinity, 0, negative", () => {
    expect(summarize([NaN, Infinity, 0, -3, 16])?.count).toBe(1);
  });
  it("returns null with no valid sample", () => {
    expect(summarize([])).toBeNull();
  });
});

describe("createSamples", () => {
  it("keeps only the last ones", () => {
    const samples = createSamples(3);
    [1, 2, 3, 4, 5].forEach((x) => samples.push(x));
    expect(samples.values()).toEqual([3, 4, 5]);
  });
  it("starts over after clear()", () => {
    const samples = createSamples(3);
    samples.push(1);
    samples.clear();
    expect(samples.values()).toEqual([]);
  });
});
