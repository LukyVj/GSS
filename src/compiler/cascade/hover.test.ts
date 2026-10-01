import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { expandScene } from "./expand";
import { parseSelector, resolveStyles, specificity } from "./resolve";
import { validateProperties } from "./validate";

// Step 1 of :hover: the pseudo-class, in the selectors. The cascade of the
// hover state, the triggers, :has(), the shader and the picking come next.
const selector = (text: string) => parseSelector(tokenize(text));

function styled(source: string) {
  const stylesheet = parse(tokenize(source));
  return resolveStyles(expandScene(stylesheet.scene), stylesheet.rules);
}

describe(":hover in a selector", () => {
  it("is read on a compound, like CSS", () => {
    expect(selector("cube:hover")).toMatchObject({ tag: "cube", hover: true });
    expect(selector(".letter:hover")).toMatchObject({
      tag: null,
      classes: ["letter"],
      hover: true,
    });
    expect(selector("*:hover")).toMatchObject({ tag: null, hover: true });
  });

  it("can go anywhere after the tag, like CSS", () => {
    expect(selector("cube:hover.big")).toMatchObject({
      tag: "cube",
      classes: ["big"],
      hover: true,
    });
    expect(selector("cube.big:hover#a")).toMatchObject({
      tag: "cube",
      id: "a",
      classes: ["big"],
      hover: true,
    });
  });

  it("can be on an ancestor: the group is hovered", () => {
    expect(selector("#letters:hover .letter")).toMatchObject({
      classes: ["letter"],
      ancestors: [{ id: "letters", hover: true }],
    });
    expect(selector("#letters:hover .letter").hover).toBeUndefined();
  });

  it("is absent from a plain selector", () => {
    expect(selector("cube.big").hover).toBeUndefined();
  });

  it("counts like a class in the specificity, like CSS", () => {
    expect(specificity(selector("cube:hover"))).toBe(101);
    expect(specificity(selector("cube:hover"))).toBe(
      specificity(selector("cube.big")),
    );
    expect(specificity(selector("#g:hover cube"))).toBe(10_101);
  });

  it("explains an unknown pseudo-class", () => {
    expect(() => selector("cube:active")).toThrow(
      'Unknown pseudo-class ":active": GSS knows :hover',
    );
    expect(() => selector("cube:")).toThrow(/Unknown pseudo-class/);
  });
});

describe("a :hover rule and the normal styles", () => {
  it("does not change the object when nothing is hovered", () => {
    const [cube] = styled(`
      @scene { cube; }
      cube { color: #fff; }
      cube:hover { color: #f00; translate: 0 1 0; }
    `);
    expect(cube.styles.color).toEqual([
      expect.objectContaining({ type: "HASH", value: "fff" }),
    ]);
    expect(cube.styles.translate).toBeUndefined();
  });

  it("does not change the objects of a hovered group either", () => {
    const [cube] = styled(`
      @scene { group#g { cube; } }
      #g:hover cube { color: #f00; }
    `);
    expect(cube.styles.color).toBeUndefined();
  });
});

// Step 2 of :hover: the triggers. For each object, the objects that, hovered,
// put it in its hover state. The runtime will set uHover[object] to 1 when the
// object under the mouse is one of them.
function triggers(source: string): Record<string, number[]> {
  return Object.fromEntries(
    styled(source).map((object) => [
      object.id ?? object.tag,
      object.hoverTriggers,
    ]),
  );
}

describe("the hover triggers of an object", () => {
  it("are empty without a :hover rule", () => {
    expect(
      triggers(`@scene { cube#a; sphere#b; } cube { color: #f00; }`),
    ).toEqual({
      a: [],
      b: [],
    });
  });

  it("are the object itself for cube:hover", () => {
    expect(
      triggers(
        `@scene { cube#a; sphere#b; cube#c; } cube:hover { color: #f00; }`,
      ),
    ).toEqual({ a: [1], b: [], c: [3] });
  });

  it("are the object itself for *:hover, for every object", () => {
    expect(
      triggers(`@scene { cube#a; sphere#b; } *:hover { color: #f00; }`),
    ).toEqual({
      a: [1],
      b: [2],
    });
  });

  it("are every object of the group for #g:hover cube, like CSS", () => {
    // hovering the sphere hovers #g, so the cube of #g changes too
    expect(
      triggers(`
        @scene { group#g { cube#a; sphere#b; } cube#c; }
        #g:hover cube { color: #f00; }
      `),
    ).toEqual({ a: [1, 2], b: [], c: [] });
  });

  it("include the objects of the nested groups", () => {
    expect(
      triggers(`
        @scene { group#outer { group#inner { cube#a; } sphere#b; } }
        #outer:hover cube { color: #f00; }
      `),
    ).toEqual({ a: [1, 2], b: [] });
  });

  it("must all be hovered at once when the selector has several :hover", () => {
    // #outer:hover and #inner:hover: only the objects of #inner hover both
    expect(
      triggers(`
        @scene { group#outer { group#inner { cube#a; } sphere#b; } }
        #outer:hover #inner:hover cube { color: #f00; }
        #outer:hover cube:hover { translate: 0 1 0; }
      `),
    ).toEqual({ a: [1], b: [] });
  });

  it("add up over the rules, sorted and without duplicates", () => {
    expect(
      triggers(`
        @scene { group#g { sphere#b; cube#a; } }
        cube:hover { color: #f00; }
        #g:hover cube { translate: 0 1 0; }
        #g:hover .x, #g:hover cube { rotate-y: 10deg; }
      `),
    ).toEqual({ a: [1, 2], b: [] });
  });
});

// Step 3 of :hover: the hover styles. Each object gets a second cascade, with
// the :hover rules this time. The shader will mix(styles, hoverStyles, uHover).
describe("the hover styles of an object", () => {
  it("apply the :hover rules on top of the normal ones", () => {
    const [cube] = styled(`
      @scene { cube; }
      cube { color: #fff; translate: 0 0.5 0; }
      cube:hover { color: #f00; }
    `);
    expect(cube.styles.color).toEqual([
      expect.objectContaining({ value: "fff" }),
    ]);
    expect(cube.hoverStyles.color).toEqual([
      expect.objectContaining({ value: "f00" }),
    ]);
    // what :hover does not change stays
    expect(cube.hoverStyles.translate).toEqual(cube.styles.translate);
  });

  it("are the normal styles without a :hover rule", () => {
    const [cube] = styled(`@scene { cube; } cube { color: #fff; }`);
    expect(cube.hoverStyles).toEqual(cube.styles);
  });

  it("follow the specificity, like CSS: #a beats cube:hover", () => {
    const [a, b] = styled(`
      @scene { cube#a; cube#b; }
      #a { color: #00f; }
      cube:hover { color: #f00; }
      #b { color: #0f0; }
      #b:hover { color: #ff0; }
    `);
    expect(a.hoverStyles.color).toEqual([
      expect.objectContaining({ value: "00f" }),
    ]);
    expect(b.hoverStyles.color).toEqual([
      expect.objectContaining({ value: "ff0" }),
    ]);
  });

  it("lose against a normal !important, like CSS", () => {
    const [cube] = styled(`
      @scene { cube; }
      cube { color: #fff !important; }
      cube:hover { color: #f00; }
    `);
    expect(cube.hoverStyles.color).toEqual([
      expect.objectContaining({ value: "fff" }),
    ]);
  });

  it("apply the rules of a hovered group", () => {
    const [cube] = styled(`
      @scene { group#g { cube; } }
      #g:hover cube { translate: 0 1 0; }
    `);
    expect(cube.styles.translate).toBeUndefined();
    expect(cube.hoverStyles.translate).toBeDefined();
  });

  it("refuse a :hover rule that only styles groups, for now", () => {
    expect(() =>
      styled(`@scene { group#g { cube; } } #g:hover { translate: 0 1 0; }`),
    ).toThrow(
      "A :hover rule cannot style a group yet: style its objects, like #g:hover cube",
    );
    // *:hover also matches the objects: fine, the groups just ignore it
    expect(() =>
      styled(`@scene { group#g { cube; } } *:hover { color: #f00; }`),
    ).not.toThrow();
  });
});

describe("what a :hover rule can change", () => {
  const compile = (source: string) =>
    validateProperties(parse(tokenize(source)).rules);

  it("is any animatable property, like @keyframes", () => {
    expect(() =>
      compile(
        `cube:hover { color: #f00; translate: 0 1 0; rotate-y: 45deg; scale: 1.2; --lift: 1; }`,
      ),
    ).not.toThrow();
  });

  it("is never a property that cannot be animated", () => {
    expect(() => compile(`cube:hover { size: 2; }`)).toThrow(
      '"size" cannot change on :hover. Animatable properties: ',
    );
    expect(() => compile(`#g:hover cube { material: gold; }`)).toThrow(
      '"material" cannot change on :hover',
    );
  });

  it("is not a face, for now", () => {
    expect(() => compile(`cube:hover::top { texture: url("a.png"); }`)).toThrow(
      "A face cannot change on :hover yet",
    );
  });
});
