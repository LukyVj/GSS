import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const scene = (sceneRule: string, more = "@scene { sphere; } sphere { translate: 0 1 0; }") =>
  compileGSS(`${more} scene { ${sceneRule} }`);
const mainOf = (shader: string) => shader.slice(shader.indexOf("void main() {"));
const fn = (shader: string, head: string) => shader.slice(shader.indexOf(head), shader.indexOf("\n}\n", shader.indexOf(head)));

describe("ambient-occlusion: less ambient light where the objects close in", () => {
  it("keeps the shader as it was with none", () => {
    expect(scene("ambient-occlusion: none;")).toBe(scene(""));
    expect(scene("")).not.toContain("calcAO");
  });

  it("measures, at the point main() shades, how much of the scene closes in around its normal", () => {
    const shader = scene("ambient-occlusion: 1;");
    const ao = fn(shader, "float calcAO(vec3 p, vec3 n) {");
    expect(ao).toContain("for (int i = 0; i < 5; i++) {");
    expect(ao).toContain("float h = 0.01 + 0.5 * float(i) / 4.0;");
    expect(ao).toContain("return clamp(1.0 - 1.0 * 1.8 * occ / (0.5 * 5.0), 0.0, 1.0);");
    expect(mainOf(shader)).toMatch(/vec3 n = calcNormal\(p\);\n\s*ao = calcAO\(p, n\);/);
  });

  it("darkens the ambient light only, never the sun", () => {
    const shader = scene("ambient-occlusion: 1; ambient: 0.3;");
    expect(fn(shader, "vec3 diffuse(vec3 n, vec3 color) {")).toContain("return color * (0.3 * ao + 0.7 * diff);");
    const lit = scene("ambient-occlusion: 1; ambient: 0.3 #9db4ff;");
    expect(fn(lit, "vec3 diffuse(vec3 p, vec3 n, vec3 color) {")).toContain("return color * (AMBIENT_LIGHT * ao + lighting(p, n));");
  });

  it("lights a reflection without it, and gives the surface its own back", () => {
    const shader = scene("ambient-occlusion: 1;", "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; }");
    const trace = fn(shader, "vec3 trace(vec3 ro, vec3 rd) {");
    expect(trace).toContain("float kept = ao;");
    expect(trace).toContain("ao = 1.0;");
    expect(trace).toContain("vec3 seen = traceSeen(ro, rd);");
    expect(trace).toContain("ao = kept;");
    expect(shader.indexOf("vec3 traceSeen(vec3 ro, vec3 rd) {")).toBeLessThan(shader.indexOf("vec3 trace(vec3 ro, vec3 rd) {"));
  });

  it("reads a strength, a radius and a number of samples", () => {
    const ao = fn(scene("ambient-occlusion: 0.6 1.2 8;"), "float calcAO(vec3 p, vec3 n) {");
    expect(ao).toContain("for (int i = 0; i < 8; i++) {");
    expect(ao).toContain("float h = 0.01 + 1.2 * float(i) / 7.0;");
    expect(ao).toContain("return clamp(1.0 - 0.6 * 1.8 * occ / (1.2 * 8.0), 0.0, 1.0);");
  });

  it("shades each surface of a transparent object with its own", () => {
    const shader = scene("ambient-occlusion: 1;", "@scene { sphere; cube; } sphere { translate: 0 1 0; opacity: 0.5; }");
    expect(shader).toMatch(/vec3 n = (?:calcNormal\(p\)|holeNormal\(p, rd, id\));\n\s*ao = calcAO\(p, n\);/);
  });

  it("works with shadows and with geometricPrecision", () => {
    for (const rule of ["shadows: soft;", "shape-rendering: geometricPrecision;"]) {
      const shader = scene(`ambient-occlusion: 1; ${rule}`);
      expect(shader).toContain("ao = calcAO(p, n);");
    }
  });

  it("lowers to WGSL", () => {
    const wgsl = compileGSS("@scene { sphere; } scene { ambient-occlusion: 1; } sphere { material: chrome; }", "wgsl");
    expect(wgsl).toContain("calcAO");
    expect(wgsl).toContain("traceSeen");
  });

  it("refuses values out of range", () => {
    expect(() => scene("ambient-occlusion: 3;")).toThrow("ambient-occlusion expects none, or a strength from 0 to 2, then a radius from 0.05 to 5 and a number of samples from 2 to 16 if needed, like: ambient-occlusion: 0.8 0.5 5;");
    expect(() => scene("ambient-occlusion: 1 9;")).toThrow("ambient-occlusion expects none");
    expect(() => scene("ambient-occlusion: 1 0.5 5.5;")).toThrow("ambient-occlusion expects none");
    expect(() => scene("ambient-occlusion: 1 0.5 5 2;")).toThrow("ambient-occlusion expects none");
  });
});
