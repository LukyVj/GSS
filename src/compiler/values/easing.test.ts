import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readEasing, findEasing } from "./easing";

const easingOf = (source: string) => readEasing(tokenize(source));

describe("readEasing: the CSS keywords", () => {
  it("gives each keyword the cubic-bezier() of CSS", () => {
    expect(easingOf("ease")).toEqual({
      type: "cubic-bezier",
      x1: 0.25,
      y1: 0.1,
      x2: 0.25,
      y2: 1,
    });
    expect(easingOf("ease-in")).toEqual({
      type: "cubic-bezier",
      x1: 0.42,
      y1: 0,
      x2: 1,
      y2: 1,
    });
    expect(easingOf("ease-out")).toEqual({
      type: "cubic-bezier",
      x1: 0,
      y1: 0,
      x2: 0.58,
      y2: 1,
    });
    expect(easingOf("ease-in-out")).toEqual({
      type: "cubic-bezier",
      x1: 0.42,
      y1: 0,
      x2: 0.58,
      y2: 1,
    });
  });

  it("reads linear as a straight line from (0, 0) to (1, 1)", () => {
    expect(easingOf("linear")).toEqual({
      type: "linear",
      points: [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    });
  });

  it("returns null for what is not an easing, so a shorthand can keep looking", () => {
    expect(easingOf("alternate")).toBeNull();
    expect(easingOf("float")).toBeNull();
    expect(easingOf("2s")).toBeNull();
  });
});

describe("readEasing: cubic-bezier()", () => {
  it("reads the four numbers", () => {
    expect(easingOf("cubic-bezier(0.2, 0, 0, 1)")).toEqual({
      type: "cubic-bezier",
      x1: 0.2,
      y1: 0,
      x2: 0,
      y2: 1,
    });
  });

  it("lets y go outside 0–1: the curve can overshoot, like a bounce", () => {
    expect(easingOf("cubic-bezier(0.3, -0.5, 0.7, 1.5)")).toEqual({
      type: "cubic-bezier",
      x1: 0.3,
      y1: -0.5,
      x2: 0.7,
      y2: 1.5,
    });
  });

  it("rejects an x outside 0–1: time cannot go backward", () => {
    expect(() => easingOf("cubic-bezier(1.2, 0, 0, 1)")).toThrow(
      "cubic-bezier() expects",
    );
    expect(() => easingOf("cubic-bezier(0.2, 0, -0.1, 1)")).toThrow(
      "cubic-bezier() expects",
    );
  });

  it("rejects anything but four numbers", () => {
    expect(() => easingOf("cubic-bezier(0.2, 0, 1)")).toThrow(
      "cubic-bezier() expects",
    );
    expect(() => easingOf("cubic-bezier(0.2, 0, 1, 1, 1)")).toThrow(
      "cubic-bezier() expects",
    );
    expect(() => easingOf("cubic-bezier(0.2, 0, 1, 1s)")).toThrow(
      "cubic-bezier() expects",
    );
  });
});

describe("readEasing: linear()", () => {
  const points = (source: string) => {
    const easing = easingOf(source);
    if (easing?.type !== "linear") throw new Error("not a linear()");
    return easing.points.map((p) => [p.input, p.output]);
  };

  it("spreads the points evenly when no position is written", () => {
    expect(points("linear(0, 0.25, 1)")).toEqual([
      [0, 0],
      [0.5, 0.25],
      [1, 1],
    ]);
  });

  it("reads a position written as a percentage", () => {
    expect(points("linear(0, 0.25 75%, 1)")).toEqual([
      [0, 0],
      [0.75, 0.25],
      [1, 1],
    ]);
  });

  it("spreads a run of points between the two positions around it", () => {
    expect(points("linear(0, 0.2, 0.4, 1 100%)")).toEqual([
      [0, 0],
      [1 / 3, 0.2],
      [2 / 3, 0.4],
      [1, 1],
    ]);
    expect(points("linear(0 20%, 0.5, 1 60%)")).toEqual([
      [0.2, 0],
      [0.4, 0.5],
      [0.6, 1],
    ]);
  });

  it("makes two points of a stop with two positions: a flat step", () => {
    expect(points("linear(0, 0.5 25% 75%, 1)")).toEqual([
      [0, 0],
      [0.25, 0.5],
      [0.75, 0.5],
      [1, 1],
    ]);
  });

  it("never lets a position go back: it takes the largest one before it", () => {
    expect(points("linear(0, 0.5 80%, 1 50%)")).toEqual([
      [0, 0],
      [0.8, 0.5],
      [0.8, 1],
    ]);
  });

  it("rejects fewer than two stops, or a stop that is not a number", () => {
    expect(() => easingOf("linear(1)")).toThrow("linear() expects");
    expect(() => easingOf("linear()")).toThrow("linear() expects");
    expect(() => easingOf("linear(0, 1s)")).toThrow("linear() expects");
    expect(() => easingOf("linear(0, 1 10% 20% 30%)")).toThrow(
      "linear() expects",
    );
  });
});

describe("findEasing: the easing among the tokens of a shorthand", () => {
  const find = (source: string) => {
    const { easing, rest } = findEasing(tokenize(source));
    return {
      easing: easing?.type ?? null,
      rest: rest.map((t) => t.value).join(" "),
    };
  };

  it("finds a keyword and leaves the other tokens", () => {
    expect(find("2s ease-in-out alternate")).toEqual({
      easing: "cubic-bezier",
      rest: "2 alternate",
    });
  });

  it("finds a function with everything inside its parentheses", () => {
    expect(find("0.3s cubic-bezier(0.2, 0, 0, 1) 1s")).toEqual({
      easing: "cubic-bezier",
      rest: "0.3 1",
    });
    expect(find("linear(0, 0.5 25%, 1) 2s")).toEqual({
      easing: "linear",
      rest: "2",
    });
  });

  it("finds nothing when there is no easing", () => {
    expect(find("2s alternate")).toEqual({ easing: null, rest: "2 alternate" });
  });

  it("rejects two easings", () => {
    expect(() => findEasing(tokenize("2s ease-in linear"))).toThrow(
      "only one easing",
    );
  });
});
