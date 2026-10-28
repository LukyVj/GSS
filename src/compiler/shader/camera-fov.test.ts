import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const scene = (sceneRule: string, more = "@scene { sphere; } sphere { translate: 0 1 0; }") =>
  compileGSS(`${more} scene { ${sceneRule} }`);
// Every place a ray goes through the camera, or a pixel is measured
const FOCAL = /1\.5 \* forward|1\.5 \* d \/ z|\(1\.5 \* iResolution\.y\)|\* 1\.5 \/ depth/;

describe("camera-fov: how wide the camera sees", () => {
  it("keeps the shader as it was with the field of view of the camera so far", () => {
    expect(scene("camera-fov: 36.87deg;")).toBe(scene(""));
    expect(scene("")).toContain("vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * forward);");
  });

  it("gives the rays of the camera the focal length of the angle, from top to bottom of the canvas", () => {
    // 0.5 / tan(45deg / 2) = 1.2071
    const shader = scene("camera-fov: 45deg;");
    expect(shader).toContain("vec3 rd = normalize(uv.x * right + uv.y * up + 1.2071 * forward);");
    expect(shader).not.toMatch(FOCAL);
  });

  it("measures the pixels with it: geometricPrecision, the background, the pointer, the views", () => {
    const sources = [
      scene("camera-fov: 20deg; shape-rendering: geometricPrecision;"),
      scene("camera-fov: 20deg; background: linear-gradient(#fff, #000);"),
      scene("camera-fov: 20deg; view: distance;"),
      compileScene("@scene { sphere; } scene { camera-fov: 20deg; } @debug-panel { display: open; }", { debug: true }).shader,
      compileGSS("@scene { sphere * 3; } scene { camera-fov: 20deg; } sphere { translate: calc(sibling-index() - 2) calc(1 - hover-distance()) 0; }"),
    ];
    for (const shader of sources) {
      expect(shader).toContain("2.8356");
      expect(shader).not.toMatch(FOCAL);
    }
  });

  it("lowers to WGSL", () => {
    expect(compileGSS("@scene { sphere; } scene { camera-fov: 45deg; }", "wgsl")).toContain("1.2071");
  });

  it("refuses an angle out of range, or a number", () => {
    expect(() => scene("camera-fov: 5deg;")).toThrow("camera-fov expects an angle from 10deg to 120deg, like: camera-fov: 50deg;");
    expect(() => scene("camera-fov: 150deg;")).toThrow("camera-fov expects an angle from 10deg to 120deg");
    expect(() => scene("camera-fov: 45;")).toThrow("camera-fov expects an angle");
  });
});
