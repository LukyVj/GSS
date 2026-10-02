import { inlineAnimations } from "../tests/inline-animations";
import { describe, it, expect } from "vitest";
import { readAngle } from "../values/values";
import { compileGSS } from "../index";

export const SHAPE_FUNCTIONS = [
  "sdSphere",
  "sdRoundBox",
  "sdTorus",
  "sdCylinder",
  "sdCappedCone",
  "sdCapsule",
];
export const PATH_HELPERS = ["segment2", "crosses", "extrude", "box2"];
// Everything the metal, jelly and glass materials bring
export const MATERIAL_FUNCTIONS = [
  "metal",
  "jelly",
  "glass",
  "trace",
  "fresnel",
  "shadeMetal",
  "thickness",
  "shadeJelly",
  "hash3",
  "noise",
  "bump",
  "frostSettings",
  "marchInside",
  "shadeGlass",
];
export const MAP_HELPERS = [
  "rot",
  "opS",
  "opI",
  "opSmoothU",
  "opSmoothS",
  "opSmoothI",
];

describe("readAngle", () => {
  it("converts degrees to radians", () => {
    expect(
      readAngle([{ type: "DIMENSION", value: 180, unit: "deg" }]),
    ).toBeCloseTo(Math.PI);
  });

  it("keeps radians", () => {
    expect(readAngle([{ type: "DIMENSION", value: 1.5, unit: "rad" }])).toBe(
      1.5,
    );
  });

  it("converts turns", () => {
    expect(
      readAngle([{ type: "DIMENSION", value: 0.25, unit: "turn" }]),
    ).toBeCloseTo(Math.PI / 2);
  });

  it("accepts 0 without unit", () => {
    expect(readAngle([{ type: "NUMBER", value: 0 }])).toBe(0);
  });

  it("rejects an unknown unit", () => {
    expect(() =>
      readAngle([{ type: "DIMENSION", value: 3, unit: "px" }]),
    ).toThrow("px");
  });

  it("rejects a number without unit", () => {
    expect(() => readAngle([{ type: "NUMBER", value: 45 }])).toThrow();
  });
});

describe("scale", () => {
  it("divides the point and multiplies the distance back", () => {
    const shader = compileGSS("@scene { sphere; } sphere { scale: 4; }");
    expect(shader).toContain("q /= 4.0;");
    expect(shader).toContain("sdSphere(q, 0.5) * 4.0");
  });
  it("rejects several values", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { scale: 2 3; }"),
    ).toThrow("scale expects");
  });

  it("rejects zero", () => {
    expect(() => compileGSS("@scene { sphere; } sphere { scale: 0; }")).toThrow(
      "scale expects",
    );
  });

  it("rejects negative numbers", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { scale: -1; }"),
    ).toThrow("scale expects");
  });
});

describe("generateShader", () => {
  it("applies the rotation before measuring the distance", () => {
    const shader = compileGSS("@scene { torus; } torus { rotate-x: 90deg; }");
    const rotation = shader.indexOf("q.yz *= rot(");
    const distance = shader.indexOf("sdTorus(q");
    expect(rotation).toBeGreaterThan(-1); // the rotation exists
    expect(rotation).toBeLessThan(distance); // and it comes before
  });

  it("shows the value it got when the radius is negative", () => {
    expect(() => compileGSS("@scene { cone } cone { radius: -0.5; }")).toThrow("got -0.5");
  });

  it("clamps a negative radius computed by calc() at 0, like CSS", () => {
    expect(() => compileGSS("@scene { cone } cone { radius: calc(-1 * 0.5) 0.2; }")).not.toThrow();
  });
});

describe("decor", () => {
  it("uses the decor colors", () => {
    const shader = compileGSS(
      "@scene { cube; } scene { floor: #111; background: #000; }",
    );
    expect(shader).toContain(
      "return matte(vec3(0.067, 0.067, 0.067));  // the floor",
    );
    expect(shader).toContain("const vec3 BACKGROUND = vec3(0.0, 0.0, 0.0);");
  });

  it("keeps the decor default without scene rule", () => {
    const shader = compileGSS("@scene { cube; }");
    expect(shader).toContain("const vec3 BACKGROUND = vec3(0.03);");
  });
});

describe("lighting", () => {
  it("points the light from two angles", () => {
    expect(
      compileGSS("@scene { cube; } scene { light: 0deg 90deg; }"),
    ).toContain("const vec3 LIGHT_DIR = vec3(0.0, 1.0, 0.0);");
    expect(
      compileGSS("@scene { cube; } scene { light: 90deg 0deg; }"),
    ).toContain("const vec3 LIGHT_DIR = vec3(1.0, 0.0, 0.0);");
  });

  it("keeps the default light direction", () => {
    expect(compileGSS("@scene { cube; }")).toContain(
      "const vec3 LIGHT_DIR = vec3(-0.408, 0.816, 0.408);",
    );
  });

  it("rejects a light without two angles", () => {
    expect(() =>
      compileGSS("@scene { cube; } scene { light: 45deg; }"),
    ).toThrow("light expects");
  });

  it("sets the ambient light", () => {
    expect(compileGSS("@scene { cube; } scene { ambient: 0.3; }")).toContain(
      "color * (0.3 + 0.7 * diff)",
    );
  });

  it("keeps the default ambient light", () => {
    expect(compileGSS("@scene { cube; }")).toContain(
      "color * (0.1 + 0.9 * diff)",
    );
  });

  it("rejects an ambient light above 1", () => {
    expect(() => compileGSS("@scene { cube; } scene { ambient: 2; }")).toThrow(
      "ambient expects",
    );
  });

  it("removes the floor", () => {
    expect(compileGSS("@scene { cube; } scene { floor: none; }")).toContain(
      "res = opU(res, vec2(1e10, 0.0)); // the floor",
    );
  });
});

describe("camera", () => {
  it("sets the camera target", () => {
    expect(
      compileGSS("@scene { cube; } scene { camera-target: 0 2 0; }"),
    ).toContain("vec3 target = vec3(0.0, 2.0, 0.0);");
  });

  it("keeps the default camera target", () => {
    expect(compileGSS("@scene { cube; }")).toContain(
      "vec3 target = vec3(0.0, 0.5, 0.0);",
    );
  });
});

describe("shape dimensions", () => {
  it("uses the default cube size", () => {
    expect(compileGSS("@scene { cube; }")).toContain(
      "sdRoundBox(q, vec3(0.5, 0.5, 0.5), 0.08)",
    );
  });

  it("halves the size of the cube", () => {
    expect(compileGSS("@scene { cube; } cube { size: 2 1 1; }")).toContain(
      "sdRoundBox(q, vec3(1.0, 0.5, 0.5), 0.08)",
    );
  });

  it("accepts a single size value", () => {
    expect(compileGSS("@scene { cube; } cube { size: 2; }")).toContain(
      "sdRoundBox(q, vec3(1.0, 1.0, 1.0), 0.08)",
    );
  });

  it("rejects an invalid size", () => {
    expect(() => compileGSS("@scene { cube; } cube { size: 1 2; }")).toThrow(
      "size expects",
    );
    expect(() => compileGSS("@scene { cube; } cube { size: -1; }")).toThrow(
      "size expects",
    );
  });

  it("sets the corner radius", () => {
    expect(
      compileGSS("@scene { cube; } cube { corner-radius: 0.2; }"),
    ).toContain("sdRoundBox(q, vec3(0.5, 0.5, 0.5), 0.2)");
  });

  it("keeps the corner radius inside the cube", () => {
    expect(
      compileGSS("@scene { cube; } cube { size: 0.4; corner-radius: 1; }"),
    ).toContain("sdRoundBox(q, vec3(0.2, 0.2, 0.2), 0.2)");
  });

  it("sets the sphere radius", () => {
    expect(compileGSS("@scene { sphere; } sphere { radius: 1; }")).toContain(
      "sdSphere(q, 1.0)",
    );
  });

  it("sets the torus radius and thickness", () => {
    expect(
      compileGSS("@scene { torus; } torus { radius: 2; thickness: 0.5; }"),
    ).toContain("sdTorus(q, vec2(2.0, 0.5))");
  });

  it("uses the default cylinder dimensions", () => {
    expect(compileGSS("@scene { cylinder; }")).toContain(
      "sdCylinder(q, 0.5, 0.5)",
    );
  });

  it("halves the height of the cylinder", () => {
    expect(
      compileGSS("@scene { cylinder; } cylinder { radius: 0.4; height: 2; }"),
    ).toContain("sdCylinder(q, 1.0, 0.4)");
  });

  it("uses the default cone dimensions", () => {
    expect(compileGSS("@scene { cone; }")).toContain(
      "sdCappedCone(q, 0.5, 0.5, 0.0)",
    );
  });

  it("reads the bottom and top radii of a cone", () => {
    expect(
      compileGSS("@scene { cone; } cone { radius: 0.5 0.2; height: 1.5; }"),
    ).toContain("sdCappedCone(q, 0.75, 0.5, 0.2)");
  });

  it("rejects three radii on a cone", () => {
    expect(() =>
      compileGSS("@scene { cone; } cone { radius: 1 2 3; }"),
    ).toThrow("radius expects one or two");
  });

  it("still rejects two radii on a sphere", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { radius: 1 2; }"),
    ).toThrow("radius expects one positive number");
  });

  it("uses the default capsule dimensions", () => {
    expect(compileGSS("@scene { capsule; }")).toContain(
      "sdCapsule(q, 0.25, 0.25)",
    );
  });

  it("measures the capsule height with its round ends", () => {
    expect(
      compileGSS("@scene { capsule; } capsule { radius: 0.25; height: 1.5; }"),
    ).toContain("sdCapsule(q, 0.5, 0.25)");
  });

  it("rejects a capsule shorter than its diameter", () => {
    expect(() =>
      compileGSS("@scene { capsule; } capsule { radius: 1; height: 1; }"),
    ).toThrow("capsule height must be at least twice its radius");
  });

  it("uses the default plane dimensions", () => {
    expect(compileGSS("@scene { plane; }")).toContain(
      "sdRoundBox(q, vec3(0.5, 0.01, 0.5), 0.0)",
    );
  });

  it("reads the width and the depth of a plane", () => {
    expect(compileGSS("@scene { plane; } plane { size: 4 2; }")).toContain(
      "sdRoundBox(q, vec3(2.0, 0.01, 1.0), 0.0)",
    );
  });

  it("makes a square plane with one size", () => {
    expect(compileGSS("@scene { plane; } plane { size: 3; }")).toContain(
      "sdRoundBox(q, vec3(1.5, 0.01, 1.5), 0.0)",
    );
  });

  it("rejects three sizes on a plane", () => {
    expect(() =>
      compileGSS("@scene { plane; } plane { size: 1 2 3; }"),
    ).toThrow("size expects one or two positive numbers on a plane");
  });
});

describe("operation", () => {
  it("adds objects by default", () => {
    expect(compileGSS("@scene { cube; }")).toContain(
      "res = opU(res, vec2(sdRoundBox",
    );
  });

  it("subtracts an object", () => {
    expect(
      compileGSS("@scene { cube; sphere; } sphere { operation: subtract; }"),
    ).toContain("res = opS(res, vec2(sdSphere");
  });

  it("intersects an object", () => {
    expect(
      compileGSS("@scene { cube; sphere; } sphere { operation: intersect; }"),
    ).toContain("res = opI(res, vec2(sdSphere");
  });

  it("rejects an unknown operation", () => {
    expect(() =>
      compileGSS("@scene { cube; } cube { operation: merge; }"),
    ).toThrow("operation expects");
  });

  it("adds the floor after the objects", () => {
    const shader = compileGSS(
      "@scene { sphere; } sphere { operation: subtract; }",
    );
    expect(shader.indexOf("// the floor")).toBeGreaterThan(
      shader.indexOf("sdSphere(q"),
    );
  });
  it("returns the result after adding the floor", () => {
    expect(compileGSS("@scene { cube; }")).toMatch(
      /the floor: id 0\n\s*return res;/,
    );
  });
});

describe("blend", () => {
  it("keeps sharp junctions by default", () => {
    expect(compileGSS("@scene { cube; sphere; }")).toContain(
      "res = opU(res, vec2(sdSphere(q, 0.5) * 1.0, 2.0));",
    );
  });

  it("smooths a union", () => {
    expect(
      compileGSS("@scene { cube; sphere; } sphere { blend: 0.3; }"),
    ).toContain(
      "res = opSmoothU(res, vec2(sdSphere(q, 0.5) * 1.0, 2.0), 0.3);",
    );
  });

  it("smooths a subtraction", () => {
    expect(
      compileGSS(
        "@scene { cube; sphere; } sphere { operation: subtract; blend: 0.3; }",
      ),
    ).toContain(
      "res = opSmoothS(res, vec2(sdSphere(q, 0.5) * 1.0, 2.0), 0.3);",
    );
  });

  it("smooths an intersection", () => {
    expect(
      compileGSS(
        "@scene { cube; sphere; } sphere { operation: intersect; blend: 0.3; }",
      ),
    ).toContain(
      "res = opSmoothI(res, vec2(sdSphere(q, 0.5) * 1.0, 2.0), 0.3);",
    );
  });

  it("rejects a negative blend", () => {
    expect(() => compileGSS("@scene { cube; } cube { blend: -1; }")).toThrow(
      "blend expects",
    );
  });
});

describe("animation", () => {
  const source = `
    @scene { sphere#ball; }
    #ball { animation: float 2s ease-in-out infinite alternate; }
    @keyframes float {
      from { translate: 0 1 0; }
      to   { translate: 0 2 0; }
    }
  `;

  it("moves the object between from and to over time", () => {
    const shader = compileGSS(source);
    expect(shader).toContain("mix(vec3(0.0, 1.0, 0.0), vec3(0.0, 2.0, 0.0),");
    expect(shader).toContain("iTime / 2.0");
  });

  it("rejects an unknown animation name", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { animation: nope 2s; }"),
    ).toThrow('No @keyframes named "nope"');
  });

  it("goes through percentage frames", () => {
    const shader = compileGSS(`
      @scene { sphere; }
      sphere { animation: bounce 2s; }
      @keyframes bounce {
        0%   { translate: 0 0 0; }
        50%  { translate: 0 2 0; }
        100% { translate: 0 0 0; }
      }
    `);
    expect(shader).toContain("- 0.5) / 0.5");
  });

  it("uses the object's own translate when from is missing", () => {
    const shader = compileGSS(`
      @scene { sphere; }
      sphere { translate: 0 1 0; animation: up 2s; }
      @keyframes up { to { translate: 0 3 0; } }
    `);
    expect(shader).toContain("mix(vec3(0.0, 1.0, 0.0), vec3(0.0, 3.0, 0.0),");
  });
  it("animates rotation", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube { animation: spin 4s; }
      @keyframes spin { to { rotate-y: 1turn; } }
    `);
    expect(inlineAnimations(shader)).toContain("q.xz *= rot(mix(0.0, 6.283,");
  });

  it("animates scale", () => {
    const shader = compileGSS(`
      @scene { sphere; }
      sphere { animation: pulse 1s alternate; }
      @keyframes pulse { to { scale: 1.5; } }
    `);
    expect(inlineAnimations(shader)).toContain("q /= mix(1.0, 1.5,");
  });

  it("animates color", () => {
    const shader = compileGSS(`
      @scene { sphere; }
      sphere { color: #ff0000; animation: fade 2s alternate; }
      @keyframes fade { to { color: #0000ff; } }
    `);
    expect(shader).toContain(
      "return matte(mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0),",
    );
  });

  it("leaves alone the properties the animation does not touch", () => {
    const shader = compileGSS(`
      @scene { sphere; }
      sphere { translate: 0 1 0; animation: pulse 1s; }
      @keyframes pulse { to { scale: 2; } }
    `);
    expect(shader).toContain("q -= vec3(0.0, 1.0, 0.0);");
  });
});

describe("shader structure", () => {
  it("marches in a function that can be called again", () => {
    const shader = compileGSS("@scene { cube; }");
    expect(shader).toContain("vec2 march(vec3 ro, vec3 rd)");
    expect(shader).toContain("vec2 hit = march(ro, rd);");
  });

  it("gives each object a material, matte by default", () => {
    const shader = compileGSS("@scene { cube; } cube { color: #ff0000; }");
    expect(shader).toContain("Material getMaterial(float id)");
    expect(shader).toContain(
      "if (id == 1.0) return matte(vec3(1.0, 0.0, 0.0));  // cube",
    );
  });

  it("lights a surface in a function", () => {
    expect(compileGSS("@scene { cube; }")).toContain(
      "vec3 diffuse(vec3 n, vec3 color)",
    );
  });

  it("shares the background and the light with the whole shader", () => {
    const shader = compileGSS("@scene { cube; }");
    expect(shader).toContain("const vec3 BACKGROUND = vec3(0.03);");
    expect(shader).toContain(
      "const vec3 LIGHT_DIR = vec3(-0.408, 0.816, 0.408);",
    );
  });

  it("can tell what any ray sees", () => {
    expect(compileGSS("@scene { cube; } cube { material: gold; }")).toContain(
      "vec3 trace(vec3 ro, vec3 rd)",
    );
  });
});

describe("groups", () => {
  it("moves into the group's space before the object's", () => {
    const shader = compileGSS(`
      @scene { group#g { sphere } }
      #g { translate: 0 1 0; }
      sphere { translate: 2 0 0; }
    `);
    const group = shader.indexOf("q -= vec3(0.0, 1.0, 0.0);");
    const object = shader.indexOf("q -= vec3(2.0, 0.0, 0.0);");
    expect(group).toBeGreaterThan(-1);
    expect(object).toBeGreaterThan(group);
  });

  it("multiplies the distance by every scale", () => {
    const shader = compileGSS(`
      @scene { group#g { sphere } }
      #g { scale: 2; }
      sphere { scale: 3; }
    `);
    expect(shader).toContain("* 2.0 * 3.0,");
  });

  it("turns the group before its children", () => {
    const shader = compileGSS(`
      @scene { group#g { cube } }
      #g { rotate-y: 90deg; }
    `);
    // the group's rotation comes before the cube's own translate
    expect(shader.indexOf("q.xz *= rot(")).toBeLessThan(
      shader.lastIndexOf("q -= vec3(0.0);"),
    );
  });
});

describe("groups", () => {
  it("moves into the group's space before the object's", () => {
    const shader = compileGSS(`
      @scene { group#g { sphere } }
      #g { translate: 0 1 0; }
      sphere { translate: 2 0 0; }
    `);
    const group = shader.indexOf("q -= vec3(0.0, 1.0, 0.0);");
    const object = shader.indexOf("q -= vec3(2.0, 0.0, 0.0);");
    expect(group).toBeGreaterThan(-1);
    expect(object).toBeGreaterThan(group);
  });

  it("multiplies the distance by every scale", () => {
    const shader = compileGSS(`
      @scene { group#g { sphere } }
      #g { scale: 2; }
      sphere { scale: 3; }
    `);
    expect(shader).toContain("* 2.0 * 3.0,");
  });
});

describe("only the GLSL the scene uses", () => {
  it("an empty scene has no shape function", () => {
    const shader = compileGSS("");
    for (const name of SHAPE_FUNCTIONS)
      expect(shader).not.toContain(`float ${name}(`);
  });

  it("a sphere brings sdSphere, and nothing else", () => {
    const shader = compileGSS("@scene { sphere; }");
    expect(shader).toContain("float sdSphere(");
    for (const name of SHAPE_FUNCTIONS.filter((n) => n !== "sdSphere"))
      expect(shader).not.toContain(`float ${name}(`);
  });

  it("a plane brings sdRoundBox", () => {
    const shader = compileGSS("@scene { plane; }");
    expect(shader).toContain("float sdRoundBox(");
    for (const name of SHAPE_FUNCTIONS.filter((n) => n !== "sdRoundBox"))
      expect(shader).not.toContain(`float ${name}(`);
  });

  it("an empty scene has no path helper", () => {
    const shader = compileGSS("");
    for (const name of PATH_HELPERS) expect(shader).not.toContain(`${name}(`);
  });

  it("a path brings segment2 and box2, not the prism helpers", () => {
    const shader = compileGSS(
      '@scene { path; } path { d: path("M0 0 L1 1"); }',
    );
    expect(shader).toContain("float segment2(");
    expect(shader).toContain("float box2(");
    expect(shader).not.toContain("bool crosses(");
    expect(shader).not.toContain("float extrude(");
  });

  it("a prism brings the four helpers", () => {
    const shader = compileGSS(
      "@scene { prism; } prism { d: polygon(0 -1, 1 1, -1 1); }",
    );
    expect(shader).toContain("float segment2(");
    expect(shader).toContain("float box2(");
    expect(shader).toContain("bool crosses(");
    expect(shader).toContain("float extrude(");
  });

  it("an empty scene has no rotation or operation, but keeps opU for the floor", () => {
    const shader = compileGSS("");
    for (const name of MAP_HELPERS) expect(shader).not.toContain(`${name}(`);
    expect(shader).toContain("vec2 opU(");
  });

  it("a rotation brings rot", () => {
    const shader = compileGSS("@scene { cube; } cube { rotate-y: 30deg; }");
    expect(shader).toContain("mat2 rot(");
  });

  it("subtract brings opS, and only opS", () => {
    const shader = compileGSS(
      "@scene { cube; sphere; } sphere { operation: subtract; }",
    );
    expect(shader).toContain("vec2 opS(");
    for (const name of MAP_HELPERS.filter((n) => n !== "opS"))
      expect(shader).not.toContain(`vec2 ${name}(`);
  });

  it("blend brings the smooth version of the operation", () => {
    const shader = compileGSS(
      "@scene { cube; sphere; } sphere { operation: intersect; blend: 0.3; }",
    );
    expect(shader).toContain("vec2 opSmoothI(");
    expect(shader).not.toContain("vec2 opI(");
    expect(shader).not.toContain("vec2 opSmoothU(");
  });

  it("an empty scene has only the matte material", () => {
    const shader = compileGSS("");
    expect(shader).toContain("Material matte(");
    for (const name of MATERIAL_FUNCTIONS)
      expect(shader).not.toContain(`${name}(`);
  });

  it("a metal brings its shading, its reflection, and nothing of jelly or glass", () => {
    const shader = compileGSS("@scene { sphere; } sphere { material: gold; }");
    expect(shader).toContain("Material metal(");
    expect(shader).toContain("vec3 shadeMetal(");
    expect(shader).toContain("vec3 fresnel(");
    expect(shader).toContain("vec3 trace(");
    expect(shader).toContain("if (m.kind == METAL)");
    expect(shader).not.toContain("vec3 shadeJelly(");
    expect(shader).not.toContain("vec3 shadeGlass(");
    expect(shader).not.toContain("float noise(");
    expect(shader).not.toContain("float thickness(");
  });

  it("a jelly brings thickness, but no reflection", () => {
    const shader = compileGSS("@scene { sphere; } sphere { material: jelly; }");
    expect(shader).toContain("Material jelly(");
    expect(shader).toContain("vec3 shadeJelly(");
    expect(shader).toContain("float thickness(");
    expect(shader).toContain("if (m.kind == JELLY)");
    expect(shader).not.toContain("vec3 trace(");
    expect(shader).not.toContain("vec3 fresnel(");
    expect(shader).not.toContain("vec3 shadeMetal(");
  });

  it("a glass brings shadeGlass and everything it calls, even indirectly", () => {
    const shader = compileGSS("@scene { sphere; } sphere { material: glass; }");
    for (const definition of [
      "Material glass(",
      "vec3 shadeGlass(",
      "float marchInside(",
      "vec3 frostSettings(",
      "vec3 bump(",
      "float noise(",
      "vec3 hash3(", // called by noise(), not by shadeGlass() directly
      "float thickness(",
      "vec3 fresnel(",
      "vec3 trace(",
      "const int HAMMERED",
    ])
      expect(shader).toContain(definition);
    expect(shader).not.toContain("vec3 shadeMetal(");
    expect(shader).not.toContain("vec3 shadeJelly(");
  });

  it("keeps the frost styles for glass: FROSTED comes only with it", () => {
    expect(compileGSS("")).not.toContain("FROSTED");
    expect(
      compileGSS("@scene { sphere; } sphere { material: gold; }"),
    ).not.toContain("FROSTED");
    expect(
      compileGSS("@scene { sphere; } sphere { material: glass; }"),
    ).toContain("const int FROSTED = 0;");
  });

  it("never leaves two blank lines in a row, even where parts were left out", () => {
    const twoBlankLines = /\n[ \t]*\n[ \t]*\n/;
    for (const source of [
      "",
      "@scene { sphere; } sphere { material: glass; }",
      '@scene { path; prism; } path { d: path("M0 0 L1 1"); } prism { d: polygon(0 -1, 1 1, -1 1); }',
    ])
      expect(compileGSS(source)).not.toMatch(twoBlankLines);
  });

  describe("a tidy shader", () => {
    const SECTION_COMMENTS = [
      "// Shapes written by GSS",
      "// The metal, jelly and glass materials",
      "// Rotations and the other operations",
      "// The lighting of metal, jelly and glass",
    ];

    it("leaves out the comment of a section that has nothing in it", () => {
      const shader = compileGSS("");
      for (const comment of SECTION_COMMENTS)
        expect(shader).not.toContain(comment);
    });

    it("keeps the comment of a section that has something in it", () => {
      const shader = compileGSS(
        '@scene { path; sphere; } path { d: path("M0 0 L1 1"); rotate-y: 30deg; } sphere { material: glass; }',
      );
      for (const comment of SECTION_COMMENTS) expect(shader).toContain(comment);
    });

    it("has no line made only of spaces", () => {
      for (const source of [
        "",
        "@scene { sphere; } sphere { material: gold; }",
      ])
        expect(compileGSS(source)).not.toMatch(/\n[ \t]+\n/);
    });

    it("indents main() like the rest", () => {
      expect(compileGSS("")).toContain("\n  if (t < MAX_DIST) {\n");
    });

    it("closes the if of main() right after the diffuse light when no material needs more", () => {
      expect(compileGSS("")).toContain("col = diffuse(n, m.color);\n  }");
    });

    it("starts getMaterial() with the floor when there is no object", () => {
      expect(compileGSS("")).toContain(
        "Material getMaterial(float id) {\n  return matte(",
      );
    });

    it("indents the material lines like the floor line", () => {
      expect(compileGSS("@scene { sphere; }")).toContain(
        "Material getMaterial(float id) {\n  if (id == 1.0)",
      );
    });
  });
});
