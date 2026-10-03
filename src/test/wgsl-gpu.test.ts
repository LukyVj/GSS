import { afterAll, describe, expect, it } from "vitest";
import { compileOnWebGPU, closeWebGPU } from "./webgpu";
import { generateWGSL } from "../compiler/shader/wgsl";
import { compileScene } from "../compiler";
import { PROPERTIES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
const scenes = import.meta.glob<string>(["../scenes/*.gss", "../scene.gss", "../home/*.gss"], { query: "?raw", import: "default", eager: true });
const examples = [...PROPERTIES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS].flatMap(item => item.examples.map((e, n) => [item.name + n, e.code]));
const SWIFTSHADER_DROPS = new Set(["../scenes/soft-relic.gss", "../scenes/camera-cutaway.gss"]);
afterAll(closeWebGPU);
describe("generated shaders and pipelines validate on WebGPU", () => {
  for (const [name, source] of [...Object.entries(scenes), ...examples]) {
    // Two studies drop SwiftShader's WebGPU instance, and every test after them fails
    // with it. Both run on WebGPU in Chrome on Metal; gpu.test.ts validates them on WebGL.
    const test = SWIFTSHADER_DROPS.has(name) ? it.skip : it;
    test(name, async () => {
      const scene = compileScene(source);
      for (const variant of scene.media?.variants ?? [scene]) {
        expect(await compileOnWebGPU(generateWGSL(variant.shader))).toBe("");
        for (const pass of variant.passes ?? []) expect(await compileOnWebGPU(generateWGSL(pass.shader))).toBe("");
      }
    }, 60000);
  }
});
