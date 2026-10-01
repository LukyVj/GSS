import { it, expect } from "vitest";
import { compileScene } from "../index";
import watch from "../../scenes/watch.gss?raw";

it("compiles the watch with steps, modern colors, gradients and every media combination", () => {
  const scene = compileScene(watch);
  expect(scene.media?.queries).toEqual([
    "(max-width: 700px)",
    "(prefers-color-scheme: dark)",
    "(prefers-reduced-motion: reduce)",
  ]);
  expect(scene.media?.variants).toHaveLength(8);
  for (const variant of scene.media!.variants) {
    expect(variant.objects).toBeGreaterThan(0);
    expect(variant.shader).toContain("vec3 gradientColor(");
    expect(variant.shader).toContain("vec3 background(vec3 rd)");
    expect(variant.hover.length).toBeGreaterThan(0);
  }
  expect(scene.media!.variants[1].dpr).toBe(1);
  expect(scene.media!.variants[0].shader).not.toBe(scene.media!.variants[2].shader);
  expect(scene.media!.variants[4].transitions.every(({ enter, leave }) => enter === null && leave === null)).toBe(true);
});
