import { describe, it, expect } from "vitest";
import { expandScene } from "./expand";

describe("expandScene", () => {
  it("déplie les éléments multipliés, avec un index global", () => {
    expect(
      expandScene([
        { tag: "cube", id: null, classes: ["corner"], count: 2 },
        { tag: "torus", id: "hero", classes: [], count: 1 },
      ]),
    ).toEqual([
      { tag: "cube", id: null, classes: ["corner"], index: 1 },
      { tag: "cube", id: null, classes: ["corner"], index: 2 },
      { tag: "torus", id: "hero", classes: [], index: 3 },
    ]);
  });

  it("numérote les ids multipliés (décision B)", () => {
    const ids = expandScene([
      { tag: "torus", id: "hero", classes: [], count: 3 },
    ]).map((instance) => instance.id);
    expect(ids).toEqual(["hero-1", "hero-2", "hero-3"]);
  });
});
