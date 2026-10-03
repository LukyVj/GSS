import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileScene } from "../index";

describe("reference studies", () => {
  for (const name of ["zdog-burger", "zdog-character", "camera-cutaway"]) {
    it(`${name} compiles for both GPU backends`, () => {
      const source = readFileSync(new URL(`../../scenes/${name}.gss`, import.meta.url), "utf8");
      const scene = compileScene(source, { target: "dual" });
      expect(scene.shader).toBeTruthy();
      expect(scene.wgsl).toBeTruthy();
    });
  }
});
