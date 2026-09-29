import { describe, it, expect } from "vitest";
import { expandScene } from "./expand";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";

describe("expandScene", () => {
  it("expands multiplied elements, with a global index", () => {
    expect(
      expandScene([
        { tag: "cube", id: null, classes: ["corner"], count: 2 },
        { tag: "torus", id: "hero", classes: [], count: 1 },
      ]),
    ).toEqual([
      { tag: "cube", id: null, classes: ["corner"], index: 1, groups: [] },
      { tag: "cube", id: null, classes: ["corner"], index: 2, groups: [] },
      { tag: "torus", id: "hero", classes: [], index: 3, groups: [] },
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
