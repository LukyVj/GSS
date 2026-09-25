import { describe, it, expect } from "vitest";
import { readAngle } from "./codegen";
import { compileCSL } from "./index";

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

  describe("generateShader", () => {
    it("applique la rotation avant de mesurer la distance", () => {
      const shader = compileCSL("@scene { torus; } torus { rotate-x: 90deg; }");
      const rotation = shader.indexOf("q.yz *= rot(");
      const distance = shader.indexOf("sdTorus(q");
      expect(rotation).toBeGreaterThan(-1); // la rotation existe
      expect(rotation).toBeLessThan(distance); // et elle vient avant
    });
  });
});
