import { afterAll, describe, expect, it } from "vitest";
import { compileOnWebGPU, closeWebGPU } from "./webgpu";
import { generateWGSL } from "../compiler/shader/wgsl";
import { compileScene } from "../compiler";
import { PROPERTIES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
const scenes = import.meta.glob<string>(["../scenes/*.gss", "../scene.gss", "../home/*.gss"], { query: "?raw", import: "default", eager: true });
const examples = [...PROPERTIES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS].flatMap(item => item.examples.map((e, n) => [item.name + n, e.code]));
const SWIFTSHADER_DROPS = new Set(["../scenes/soft-relic.gss", "../scenes/camera-cutaway.gss"]);
afterAll(closeWebGPU);
// 3 min: the WebGPU of the test browser is SwiftShader. It builds a pipeline on the CPU,
// after inlining every function call: the distance function of the scene is compiled
// again at each call site. grass.gss (64 animated tufts) takes about 25 s, longer while
// other test runs share the CPU. A wrong shader still fails at once, with its message:
// the timeout only stops a hang.
describe("generated shaders and pipelines validate on WebGPU", () => {
  for (const [name, source] of [...Object.entries(scenes), ...examples]) {
    // Two studies drop SwiftShader's WebGPU instance, and every test after them fails
    // with it. Both run on WebGPU in Chrome on Metal; gpu.test.ts validates them on WebGL.
    const test = SWIFTSHADER_DROPS.has(name) ? it.skip : it;
    test(name, async () => {
      const scene = compileScene(source);
      // Each different shader once: @media variants often share one (a query that only
      // moves the camera changes no code), and the same code validates the same way.
      const shaders = new Set<string>();
      for (const variant of scene.media?.variants ?? [scene]) {
        shaders.add(generateWGSL(variant.shader));
        for (const pass of variant.passes ?? []) shaders.add(generateWGSL(pass.shader));
      }
      for (const shader of shaders) expect(await compileOnWebGPU(shader)).toBe("");
    }, 180000);
  }
});
