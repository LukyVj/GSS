import { describe, it, expect } from "vitest";
import { readAngle } from "./codegen";
import { compileGSS } from "./index";

describe("readAngle", () => {
  it("convertit les degrés en radians", () => {
    expect(
      readAngle([{ type: "DIMENSION", value: 180, unit: "deg" }]),
    ).toBeCloseTo(Math.PI);
  });

  it("garde les radians", () => {
    expect(readAngle([{ type: "DIMENSION", value: 1.5, unit: "rad" }])).toBe(
      1.5,
    );
  });

  it("convertit les tours", () => {
    expect(
      readAngle([{ type: "DIMENSION", value: 0.25, unit: "turn" }]),
    ).toBeCloseTo(Math.PI / 2);
  });

  it("accepte 0 sans unité", () => {
    expect(readAngle([{ type: "NUMBER", value: 0 }])).toBe(0);
  });

  it("refuse une unité inconnue", () => {
    expect(() =>
      readAngle([{ type: "DIMENSION", value: 3, unit: "px" }]),
    ).toThrow("px");
  });

  it("refuse un nombre sans unité", () => {
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
  it("applique la rotation avant de mesurer la distance", () => {
    const shader = compileGSS("@scene { torus; } torus { rotate-x: 90deg; }");
    const rotation = shader.indexOf("q.yz *= rot(");
    const distance = shader.indexOf("sdTorus(q");
    expect(rotation).toBeGreaterThan(-1); // la rotation existe
    expect(rotation).toBeLessThan(distance); // et elle vient avant
  });
});

describe("décor", () => {
  it("utilise les couleurs du décor", () => {
    const shader = compileGSS(
      "@scene { cube; } scene { floor: #111; background: #000; }",
    );
    expect(shader).toContain("return vec3(0.067, 0.067, 0.067);  // le sol");
    expect(shader).toContain("vec3 col = vec3(0.0, 0.0, 0.0);");
  });

  it("garde le décor par défaut sans règle scene", () => {
    const shader = compileGSS("@scene { cube; }");
    expect(shader).toContain("vec3 col = vec3(0.03);");
  });
});
