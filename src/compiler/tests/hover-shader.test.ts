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
