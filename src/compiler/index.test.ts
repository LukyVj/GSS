import { describe, it, expect } from "vitest";
import { compileScene } from "./index";

describe("compileScene", () => {
  it("counts the objects of the scene, multiplied ones included", () => {
    expect(compileScene("@scene { cube.corner * 4; sphere#dot; }").objects).toBe(5);
  });
  it("counts no object in an empty scene", () => {
    expect(compileScene("@scene { }").objects).toBe(0);
  });
});
