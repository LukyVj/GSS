import { describe, expect, it } from "vitest";
import { compileScene } from "../..";
import { generateWGSL } from ".";
import { PROPERTIES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../../registry/registry";
const scenes = import.meta.glob<string>(["../../../scenes/*.gss", "../../../scene.gss", "../../../home/*.gss"], { query: "?raw", import: "default", eager: true });
const examples = [...PROPERTIES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS].flatMap(item => item.examples.map((e, n) => [item.name + n, e.code]));
describe("WGSL scene lowering", () => {
  for (const [name, source] of [...Object.entries(scenes), ...examples]) {
    it(name, () => {
      const scene = compileScene(source);
      for (const variant of scene.media?.variants ?? [scene]) {
        expect(generateWGSL(variant.shader)).toContain("@fragment");
        for (const pass of variant.passes ?? []) expect(generateWGSL(pass.shader)).toContain("@fragment");
      }
    });
  }
});
