import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compileScene } from "../compiler";
import { compileOnGpu, closeGpu } from "./gpu";
import { compileOnWebGPU, closeWebGPU } from "./webgpu";

afterAll(async () => { await closeGpu(); await closeWebGPU(); });
describe("reference study shaders", () => {
  for (const name of ["zdog-burger", "zdog-character", "camera-cutaway"]) {
    const source = readFileSync(new URL(`../scenes/${name}.gss`, import.meta.url), "utf8");
    it(`${name} validates on WebGL`, async () => {
      const scene = compileScene(source);
      for (const variant of scene.media?.variants ?? [scene]) expect(await compileOnGpu(variant.shader)).toBe("");
    }, 60000);
    if (name !== "camera-cutaway") {
      it(`${name} validates on WebGPU`, async () => {
        const scene = compileScene(source, { target: "dual" });
        for (const variant of scene.media?.variants ?? [scene]) expect(await compileOnWebGPU(variant.wgsl!)).toBe("");
      }, 60000);
    }
  }
});
