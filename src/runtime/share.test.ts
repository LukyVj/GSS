import { describe, it, expect } from "vitest";
import { encodeCode, decodeCode } from "./share";
import scene from "../scene.gss?raw";

describe("share links", () => {
  it("give back exactly the code they were made from", async () => {
    const hash = await encodeCode(scene);
    expect(hash.startsWith("#code=")).toBe(true);
    expect(await decodeCode(hash)).toBe(scene);
  });

  it("only use characters that are safe in a URL", async () => {
    expect(await encodeCode(scene)).toMatch(/^#code=[A-Za-z0-9_-]+$/);
  });

  it("are much shorter than the code", async () => {
    expect((await encodeCode(scene)).length).toBeLessThan(scene.length / 2);
  });

  it("ignore a hash without code, or a broken one", async () => {
    expect(await decodeCode("")).toBeNull();
    expect(await decodeCode("#materials")).toBeNull();
    expect(await decodeCode("#code=!!!")).toBeNull();
  });
});
