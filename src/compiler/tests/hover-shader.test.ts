import { inlineAnimations } from "./inline-animations";
import { describe, it, expect } from "vitest";
import { compileScene, compileGSS } from "..";
import { toShadertoy } from "../shader/shadertoy";

// Step 4a of :hover: the shader. Each object that can be hovered gets a slot in
// uHover[], a number from 0 (at rest) to 1 (hovered). Every animatable property
// that :hover changes becomes mix(rest, hovered, uHover[slot]).
// The runtime fills uHover[] at step 4b; transition will make it glide later.

// The line of getMaterial() for the object with this id
function materialLine(shader: string, id: number): string {
  const line = shader
    .split("\n")
    .find((l) => l.includes(`if (id == ${id}.0) return`));
  if (!line) throw new Error(`No material line for id ${id}`);
  return line;
}

// The part of map() for one object: from its comment to the next blank line
// The part of map() for one object, with the animated values put back in place
function mapPart(compiled: string, label: string): string {
  const shader = inlineAnimations(compiled);
  const start = shader.indexOf(` // ${label}\n`);
  if (start === -1) throw new Error(`No map() part for ${label}`);
  const end = shader.indexOf("\n\n", start);
  return shader.slice(start, end === -1 ? undefined : end);
}

describe("the hover slots of a scene", () => {
  it("are empty without a :hover rule, and the shader has no uHover", () => {
    const compiled = compileScene(`@scene { cube; } cube { color: #fff; }`);
    expect(compiled.hover).toEqual([]);
    expect(compiled.shader).not.toContain("uHover");
  });

  it("list the triggers of each object that can be hovered, in scene order", () => {
    const compiled = compileScene(`
      @scene { cube#a; sphere#b; cube#c; }
      cube:hover { color: #f00; }
    `);
    // slot 0 is #a (id 1), slot 1 is #c (id 3): #b cannot be hovered
    expect(compiled.hover).toEqual([[1], [3]]);
  });

  it("give the shader one float per slot", () => {
    const shader = compileGSS(`
      @scene { cube#a; sphere#b; cube#c; }
      cube:hover { color: #f00; }
    `);
    expect(shader).toContain("uniform float uHover[2];");
  });
});

// One hover state per kind of trigger: an object hovered itself and an object whose
// group is hovered are two states, each with its slot
describe("the hover states of an object in the shader", () => {
  const cloud = `
    @scene { group#cloud { sphere.point * 3; } }
    .point:hover { scale: 2; }
    #cloud:has(.point:hover) .point { translate: 0 1 0; }
  `;

  it("give each state its own slot, the states of an object one after the other", () => {
    const compiled = compileScene(cloud);
    expect(compiled.hover).toEqual([[1], [1, 2, 3], [2], [1, 2, 3], [3], [1, 2, 3]]);
    expect(compiled.shader).toContain("uniform float uHover[6];");
    expect(compiled.transitions).toHaveLength(6);
  });

  it("mix each property with the slot of the state that changes it", () => {
    const part = mapPart(compileGSS(cloud), "sphere.point");
    // hovering another point moves this one, but only hovering it scales it
    expect(part).toContain("q -= mix(vec3(0.0), vec3(0.0, 1.0, 0.0), uHover[1]);");
    expect(part).toContain("q /= mix(1.0, 2.0, uHover[0]);");
  });

  it("let the more specific rule win when both states are on, like CSS", () => {
    const shader = compileGSS(`
      @scene { group#g { cube; sphere; } }
      #g:hover cube { scale: 3; }
      cube:hover { scale: 2; }
    `);
    expect(mapPart(shader, "cube")).toContain("q /= mix(mix(1.0, 2.0, uHover[0]), 3.0, uHover[1]);");
    // !important wins over a more specific rule: its state is mixed last
    const important = compileGSS(`
      @scene { group#g { cube; sphere; } }
      #g:hover cube { scale: 3; }
      cube:hover { scale: 2 !important; }
    `);
    expect(mapPart(important, "cube")).toContain("q /= mix(mix(1.0, 3.0, uHover[1]), 2.0, uHover[0]);");
  });

  it("take the transition of their own rules", () => {
    const compiled = compileScene(`
      @scene { group#g { cube; sphere; } }
      cube:hover { scale: 2; }
      #g:hover cube { translate: 0 1 0; transition: 0.5s; }
    `);
    expect(compiled.transitions[0].enter).toBeNull();
    expect(compiled.transitions[1].enter).toEqual(expect.objectContaining({ duration: 0.5 }));
  });

  it("stay under the pressed state, which only mixes what :active changes", () => {
    const shader = compileGSS(`
      @scene { group#g { cube; sphere; } }
      cube:hover { scale: 2; }
      #g:hover cube { translate: 0 1 0; }
      cube:active { scale: 3; }
    `);
    const part = mapPart(shader, "cube");
    expect(part).toContain("q -= mix(vec3(0.0), vec3(0.0, 1.0, 0.0), uHover[1]);");
    expect(part).toContain("q /= mix(mix(1.0, 2.0, uHover[0]), 3.0, uHover[2]);");
  });
});

// :hover on a group: one slot per state of the group, after the slots of the objects,
// shared by every object of the group
describe("a hovered group in the shader", () => {
  const scene = `
    @scene { group#g { cube; sphere; } }
    #g { transition: 0.4s; }
    #g:hover { scale: 1.5; translate: 0 1 0; }
  `;

  it("gives the group one slot, hovered by any of its objects", () => {
    const compiled = compileScene(scene);
    expect(compiled.hover).toEqual([[1, 2]]);
    expect(compiled.transitions).toEqual([
      { enter: expect.objectContaining({ duration: 0.4 }), leave: expect.objectContaining({ duration: 0.4 }) },
    ]);
  });

  it("moves every object of the group with that slot", () => {
    const shader = compileGSS(scene);
    for (const label of ["cube", "sphere"]) {
      const part = mapPart(shader, label);
      expect(part).toContain("q -= mix(vec3(0.0), vec3(0.0, 1.0, 0.0), uHover[0]);");
      expect(part).toContain("q /= mix(1.0, 1.5, uHover[0]);");
    }
  });

  it("puts the group slots after the slots of the objects", () => {
    const compiled = compileScene(`
      @scene { group#g { cube; sphere; } }
      #g:hover { scale: 1.5; }
      cube:hover { color: #ff0000; }
    `);
    expect(compiled.hover).toEqual([[1], [1, 2]]);
    expect(mapPart(compiled.shader, "cube")).toContain("mix(1.0, 1.5, uHover[1])");
  });

  it("fades the group's opacity", () => {
    const shader = compileGSS(`@scene { group#g { cube; } } #g:hover { opacity: 0.5; }`);
    expect(shader).toContain("mix(1.0, 0.5, uHover[0])");
  });

  it("cannot start an animation yet", () => {
    expect(() =>
      compileScene(`@scene { group#g { cube; } } #g:hover { animation: spin 1s; } @keyframes spin { to { rotate-y: 90deg; } }`),
    ).toThrow("A :hover rule on a group cannot start an animation yet: start it on its objects, like #g:hover cube { animation: … }");
  });

  it("leaves the shader of a scene without group :hover as it was", () => {
    const shader = compileGSS(`@scene { group#g { cube; } } #g:hover cube { scale: 1.5; }`);
    expect(shader).toContain("uniform float uHover[1];");
  });
});

// The sizes of the shapes on :hover: each number of the shape is mixed like the rest
describe("a hovered size in the shader", () => {
  it("mixes the radius of a sphere", () => {
    const shader = compileGSS(`@scene { sphere; } sphere { radius: 0.5; } sphere:hover { radius: 1; }`);
    expect(mapPart(shader, "sphere")).toContain("sdSphere(q, mix(0.5, 1.0, uHover[0]))");
  });

  it("starts from the size of the shape when the object does not set one", () => {
    const shader = compileGSS(`@scene { torus; } torus:hover { radius: 1.5; }`);
    expect(mapPart(shader, "torus")).toContain("mix(1.0, 1.5, uHover[0])");
  });

  it("mixes each number of a size", () => {
    const part = mapPart(compileGSS(`@scene { cube; } cube { size: 1; } cube:hover { size: 1 2 1; }`), "cube");
    expect(part).toContain("mix(1.0, 2.0, uHover[0])");
    expect(part).toContain("vec3(0.5, ");
    // the radius of a cone, bottom and top
    const cone = mapPart(compileGSS(`@scene { cone; } cone:hover { radius: 0.5 0.3; }`), "cone");
    expect(cone).toContain("mix(0.0, 0.3, uHover[0])");
  });

  it("keeps the shader of a size that does not change", () => {
    const shader = compileGSS(`@scene { sphere; } sphere { radius: 0.7; } sphere:hover { color: #ff0000; }`);
    expect(mapPart(shader, "sphere")).toContain("sdSphere(q, 0.7)");
  });

  it("keeps the bounding sphere of a path, around its largest size", () => {
    const rest = compileGSS(`@scene { path; } path { d: path("M0 0 L10 0"); view-box: 0 0 10 10; stroke-width: 1; }`);
    const hovered = compileGSS(`@scene { path; } path { d: path("M0 0 L10 0"); view-box: 0 0 10 10; stroke-width: 1; } path:hover { stroke-width: 2; }`);
    // the test of the sphere stays: length(q) - R
    const bound = (shader: string) => /length\(q\) - [\d.]+/.test(shader);
    expect(bound(rest)).toBe(true);
    expect(bound(hovered)).toBe(true);
  });
});

// :not(:hover): a slot that is 1 when nothing, or something else, is hovered
describe(":not(:hover) in the shader and the export", () => {
  it("lists 0 among the triggers of its slot", () => {
    expect(compileScene(`@scene { cube; sphere; } cube:not(:hover) { color: #ff0000; }`).hover).toEqual([[0, 2]]);
  });

  it("keeps the state on at rest in Shadertoy, where nothing is hovered", () => {
    const exported = toShadertoy(compileScene(`@scene { cube; sphere; } cube:not(:hover) { color: #ff0000; } sphere:hover { color: #0000ff; }`));
    expect(exported).toContain("const float uHover[2] = float[2](1.0, 0.0);");
  });
});

// hover-distance(), hover-direction() (decision 215): measured on the GPU from the object
// under the pointer to this one, both where they are with nothing under the pointer
describe("hover-distance() and hover-direction()", () => {
  const cloud = `
    @scene { group#c { sphere.p * 3; } }
    .p { radius: 0.3; translate: calc(sibling-index() - 2 + hover-direction(x) * 0.5 * exp(-2 * hover-distance())) 0 0; }
  `;

  it("read the object under the pointer, uPointer, and the place of each object at rest", () => {
    const compiled = compileScene(cloud);
    expect(compiled.pointer).toEqual({ transition: null });
    expect(compiled.shader).toContain("uniform vec4 uPointer;");
    // the place glides from the object hovered before to the one hovered now (decision 216)
    expect(compiled.shader).toContain("hoverPoint = mix(hoverAt(uPointer.y), hoverAt(uPointer.x), uPointer.z);");
    expect(compiled.shader).toContain("if (id == 2.0) return restCenter2();");
    expect(compiled.shader).toContain("hoverDir1 = hoverDirection(restCenter1());");
    expect(compiled.shader).toContain("hoverDir1.x");
    // at rest, an object is where nothing under the pointer would put it
    expect(compiled.shader).toMatch(/vec3 restCenter1\(\) \{[^}]*vec3\(0\.0\)\.x[^}]*1000000\.0/);
  });

  it("go anywhere the math goes on the GPU, like a color", () => {
    const shader = compileGSS(`@scene { sphere * 2; } sphere { color: color-mix(in oklab, red, blue calc(100% * exp(-1 * hover-distance()))); }`);
    expect(shader).toContain("hoverDist2 = hoverDistance(restCenter2());");
  });

  it("measure from an object, not a group or the scene", () => {
    expect(() => compileScene(`@scene { group#g { cube; } } #g { translate: calc(hover-distance()) 0 0; }`)).toThrow(
      "hover-distance() goes in a rule that styles objects",
    );
    expect(() => compileScene(`@scene { cube; } cube { translate: calc(hover-direction(w)) 0 0; }`)).toThrow(
      "hover-direction() takes an axis, like: hover-direction(x)",
    );
  });

  it("go in the frames of an animation too, through the variables of the object", () => {
    const compiled = compileScene(`
      @scene { sphere.p * 2; }
      .p { --push: calc(hover-direction(x) * 0.3); --a: calc(sibling-index() + var(--push)) 0 0; animation: go 2s infinite; }
      @keyframes go { from { translate: var(--a); } to { translate: 0 1 0; } }
    `);
    expect(compiled.pointer).toBeDefined();
    expect(compiled.shader).toContain("vec3 restCenter1() {");
  });

  it("glide with the transition of the objects that read them (decision 216)", () => {
    const compiled = compileScene(`@scene { sphere * 2; } sphere { transition: 0.4s; translate: calc(hover-direction(x) * 0.3) 0 0; }`);
    expect(compiled.pointer?.transition).toEqual(expect.objectContaining({ duration: 0.4 }));
  });

  it("leave a scene that does not use them as it was", () => {
    const compiled = compileScene(`@scene { cube; } cube:hover { scale: 2; }`);
    expect(compiled.pointer).toBeUndefined();
    expect(compiled.shader).not.toContain("uPointer");
  });
});

describe("a hovered property in the shader", () => {
  it("mixes the color at rest and the hovered color", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube { color: #ffffff; }
      cube:hover { color: #ff0000; }
    `);
    expect(materialLine(shader, 1)).toContain(
      "mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.0, 0.0), uHover[0])",
    );
  });

  it("mixes translate, the rotations and scale", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube { translate: 0 0.5 0; }
      cube:hover { translate: 0 1 0; rotate-y: 90deg; scale: 2; }
    `);
    const part = mapPart(shader, "cube");
    expect(part).toContain(
      "q -= mix(vec3(0.0, 0.5, 0.0), vec3(0.0, 1.0, 0.0), uHover[0]);",
    );
    // no rotation at rest: from 0 to 90deg
    expect(part).toContain("q.xz *= rot(mix(0.0, 1.571, uHover[0]));");
    expect(part).toContain("q /= mix(1.0, 2.0, uHover[0]);");
    // the distance is multiplied back by the same scale
    expect(part).toContain("* mix(1.0, 2.0, uHover[0]), 1.0)");
  });

  it("leaves alone what :hover does not change", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube { translate: 0 0.5 0; color: #ffffff; }
      cube:hover { color: #ff0000; }
    `);
    expect(mapPart(shader, "cube")).toContain("q -= vec3(0.0, 0.5, 0.0);");
    expect(mapPart(shader, "cube")).not.toContain("uHover");
  });

  it("uses the slot of each object, not its id", () => {
    const shader = compileGSS(`
      @scene { sphere#a; cube#b; }
      cube:hover { color: #ff0000; }
    `);
    expect(materialLine(shader, 2)).toContain("uHover[0]");
    expect(materialLine(shader, 1)).not.toContain("uHover");
  });

  it("goes through var() and the named colors, like the rest of the cascade", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube { --c: #ffffff; color: var(--c); }
      cube:hover { --c: red; }
    `);
    expect(materialLine(shader, 1)).toContain(
      "mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.0, 0.0), uHover[0])",
    );
  });

  it("moves the object, not its group, for #g:hover cube", () => {
    const shader = compileGSS(`
      @scene { group#g { cube; } }
      #g { translate: 1 0 0; }
      #g:hover cube { translate: 0 1 0; }
    `);
    const part = mapPart(shader, "cube");
    expect(part).toContain("q -= vec3(1.0, 0.0, 0.0);"); // the group, as always
    expect(part).toContain(
      "q -= mix(vec3(0.0), vec3(0.0, 1.0, 0.0), uHover[0]);",
    );
  });

  it("keeps playing an animation while it mixes another property", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube { color: #ffffff; animation: float 2s; }
      cube:hover { color: #ff0000; }
      @keyframes float { to { translate: 0 1 0; } }
    `);
    expect(mapPart(shader, "cube")).toContain("iTime");
    expect(materialLine(shader, 1)).toContain("uHover[0]");
  });

  it("moves the texture with the object", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube { texture: url("a.png"); }
      cube:hover { translate: 0 1 0; }
    `);
    const space = shader.slice(shader.indexOf("vec3 space1("));
    expect(space.slice(0, space.indexOf("}"))).toContain("uHover[0]");
  });
});

describe("the Shadertoy export of a scene with :hover", () => {
  it("shows every object at rest: Shadertoy has no picking", () => {
    const exported = toShadertoy(
      compileScene(`
        @scene { cube#a; cube#b; }
        cube:hover { color: #ff0000; }
      `),
    );
    expect(exported).not.toMatch(/^uniform /m);
    expect(exported).toContain(
      "const float uHover[2] = float[2](0.0, 0.0); // :hover needs the GSS runtime",
    );
  });
});

// Step 4b: the picking pass. The same shader, drawn on one pixel under the mouse,
// writes the id of the object it hits instead of its color.
describe("the picking pass in the shader", () => {
  const hovered = compileGSS(`
    @scene { cube; }
    cube:hover { color: #ff0000; }
  `);

  it("is only there when the scene has a :hover rule", () => {
    const plain = compileGSS(`@scene { cube; }`);
    expect(plain).not.toContain("uPicking");
    expect(plain).toContain(
      "vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy)",
    );
  });

  it("aims at the mouse pixel instead of its own pixel", () => {
    expect(hovered).toContain("uniform bool uPicking;");
    expect(hovered).toContain("uniform vec2 uPick;");
    expect(hovered).toContain(
      "vec2 pixel = uPicking ? uPick : gl_FragCoord.xy;",
    );
    expect(hovered).toContain("vec2 uv = (pixel - 0.5 * iResolution.xy)");
  });

  it("writes the id right after the march, before any lighting", () => {
    const pick = hovered.indexOf("if (uPicking) {");
    expect(pick).toBeGreaterThan(hovered.indexOf("vec2 hit = march(ro, rd);"));
    expect(pick).toBeLessThan(hovered.indexOf("calcNormal(p)"));
    expect(hovered).toContain(
      "float picked = t < MAX_DIST ? id : 0.0; // 0: the background",
    );
    expect(hovered).toContain(
      "outColor = vec4(mod(picked, 256.0) / 255.0, floor(picked / 256.0) / 255.0, 0.0, 1.0);",
    );
  });

  it("is off in the Shadertoy export", () => {
    const exported = toShadertoy(
      compileScene(`@scene { cube; } cube:hover { color: #ff0000; }`),
    );
    expect(exported).not.toMatch(/^uniform /m);
    expect(exported).toContain("const bool uPicking = false;");
    expect(exported).toContain("const vec2 uPick = vec2(0.0);");
  });
});
