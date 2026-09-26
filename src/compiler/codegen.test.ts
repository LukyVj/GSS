import { describe, it, expect } from "vitest";
import { readAngle } from "./codegen";
import { compileGSS } from "./index";

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
});

describe("decor", () => {
  it("uses the decor colors", () => {
    const shader = compileGSS(
      "@scene { cube; } scene { floor: #111; background: #000; }",
    );
    expect(shader).toContain("return vec3(0.067, 0.067, 0.067);  // the floor");
    expect(shader).toContain("vec3 col = vec3(0.0, 0.0, 0.0);");
  });

  it("keeps the decor default without scene rule", () => {
    const shader = compileGSS("@scene { cube; }");
    expect(shader).toContain("vec3 col = vec3(0.03);");
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
});
