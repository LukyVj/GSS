import { describe, it, expect } from "vitest";
import { expandScene } from "./expand";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";

describe("expandScene", () => {
  it("expands multiplied elements, with a global index", () => {
    expect(
      expandScene([
        { tag: "cube", id: null, classes: ["corner"], count: 2 },
        { tag: "torus", id: "hero", classes: [], count: 1 },
      ]),
    ).toEqual([
      { tag: "cube", id: null, classes: ["corner"], index: 1, siblingIndex: 1, siblingCount: 3, groups: [] },
      { tag: "cube", id: null, classes: ["corner"], index: 2, siblingIndex: 2, siblingCount: 3, groups: [] },
      { tag: "torus", id: "hero", classes: [], index: 3, siblingIndex: 3, siblingCount: 3, groups: [] },
    ]);
  });

  it("numbers multiplied ids", () => {
    const ids = expandScene([
      { tag: "torus", id: "hero", classes: [], count: 3 },
    ]).map((instance) => instance.id);
    expect(ids).toEqual(["hero-1", "hero-2", "hero-3"]);
  });
});

const expandGSS = (source: string) =>
  expandScene(parse(tokenize(source)).scene);

describe("expandScene with groups", () => {
  it("only outputs drawn objects, numbered from 1", () => {
    const instances = expandGSS(
      "@scene { sphere; group#letters { cube#L; cube#U } }",
    );
    expect(instances.map((i) => i.id)).toEqual([null, "L", "U"]);
    expect(instances.map((i) => i.index)).toEqual([1, 2, 3]);
  });

  it("each object knows its groups", () => {
    const [sphere, L] = expandGSS(
      "@scene { sphere; group#letters { cube#L } }",
    );
    expect(sphere.groups).toEqual([]);
    expect(L.groups.map((g) => g.id)).toEqual(["letters"]);
  });

  it("nested groups: from the outermost to the innermost", () => {
    const [ball] = expandGSS("@scene { group#a { group#b { sphere } } }");
    expect(ball.groups.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("a multiplied group duplicates its children", () => {
    const cubes = expandGSS("@scene { group#g * 2 { cube } }");
    expect(cubes.map((c) => c.groups[0].id)).toEqual(["g-1", "g-2"]);
  });
});

describe("expandScene: sibling-index() and sibling-count()", () => {
  it("counts multiplied objects one by one, like elements in the DOM", () => {
    const instances = expandGSS("@scene { cube * 3; sphere; }");
    expect(instances.map((i) => i.siblingIndex)).toEqual([1, 2, 3, 4]);
    expect(instances.map((i) => i.siblingCount)).toEqual([4, 4, 4, 4]);
  });

  it("starts again inside each group, and a group is a sibling too", () => {
    const [sphere, a, b] = expandGSS("@scene { sphere; group#g { cube#a; cube#b } }");
    expect([sphere.siblingIndex, sphere.siblingCount]).toEqual([1, 2]);
    expect([a.siblingIndex, b.siblingIndex, b.siblingCount]).toEqual([1, 2, 2]);
    expect([a.groups[0].siblingIndex, a.groups[0].siblingCount]).toEqual([2, 2]);
  });

  it("each copy of a multiplied group has its own position", () => {
    const cubes = expandGSS("@scene { group * 3 { cube } }");
    expect(cubes.map((c) => c.groups[0].siblingIndex)).toEqual([1, 2, 3]);
    expect(cubes.map((c) => c.siblingIndex)).toEqual([1, 1, 1]);
  });
});
