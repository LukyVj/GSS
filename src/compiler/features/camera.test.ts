import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { resolveSceneStyles } from "../cascade/resolve";
import { readCamera } from "./camera";
import { compileScene } from "../index";

const cameraOf = (source: string) =>
  readCamera(resolveSceneStyles(parse(tokenize(source)).rules));

describe("readCamera", () => {
  it("uses the default camera", () => {
    expect(cameraOf("")).toEqual({
      distance: 8,
      yaw: 0,
      pitch: 0.4,
      spin: 0,
    });
  });

  it("reads the distance", () => {
    expect(cameraOf("scene { camera-distance: 12; }").distance).toBe(12);
  });

  it("rejects a distance out of range", () => {
    expect(() => cameraOf("scene { camera-distance: 30; }")).toThrow(
      "camera-distance expects",
    );
  });

  it("reads the angle", () => {
    const camera = cameraOf("scene { camera-angle: 90deg 45deg; }");
    expect(camera.yaw).toBeCloseTo(Math.PI / 2);
    expect(camera.pitch).toBeCloseTo(Math.PI / 4);
  });

  it("rejects an angle without two values", () => {
    expect(() => cameraOf("scene { camera-angle: 45deg; }")).toThrow(
      "camera-angle expects",
    );
  });

  it("turns a duration into a speed", () => {
    expect(cameraOf("scene { camera-spin: 20s; }").spin).toBeCloseTo(
      (2 * Math.PI) / 20,
    );
    expect(cameraOf("scene { camera-spin: 500ms; }").spin).toBeCloseTo(
      (2 * Math.PI) / 0.5,
    );
  });

  it("stops the rotation with none", () => {
    expect(cameraOf("scene { camera-spin: none; }").spin).toBe(0);
  });

  it("rejects a spin without a time unit", () => {
    expect(() => cameraOf("scene { camera-spin: 20; }")).toThrow(
      "camera-spin expects",
    );
  });

  it("does not spin when camera-spin is not written", () => {
    expect(cameraOf("scene { }").spin).toBe(0);
  });
});

describe("compileScene", () => {
  it("returns the shader and the camera settings", () => {
    const { shader, camera } = compileScene(
      "@scene { cube; } scene { camera-distance: 12; }",
    );
    expect(shader).toContain("#version 300 es");
    expect(camera.distance).toBe(12);
  });
});
