import { describe, it, expect } from "vitest";
import { createClock } from "./clock";
import { resolveImage } from "./textures";
import { valueImports } from "../test/imports";

// Decision 63: the runtime draws a CompiledScene without the compiler, keeps its own
// clock (a paused scene resumes where it was) and reads images next to the .gss file.

describe("createClock", () => {
  it("counts the seconds between ticks", () => {
    const clock = createClock(1000);
    expect(clock.tick(1500)).toBe(0.5);
    expect(clock.tick(2000)).toBe(0.5);
    expect(clock.seconds).toBe(1);
  });

  it("does not count the time of a pause", () => {
    const clock = createClock(0);
    clock.tick(1000); // 1 s
    // paused from 1000 to 9000, then resumed
    clock.resume(9000);
    expect(clock.tick(9500)).toBe(0.5);
    expect(clock.seconds).toBe(1.5);
  });

  it("stands still when frozen (prefers-reduced-motion)", () => {
    const clock = createClock(0);
    clock.freeze(true);
    expect(clock.tick(1000)).toBe(0);
    expect(clock.seconds).toBe(0);
    clock.freeze(false);
    expect(clock.tick(1500)).toBe(0.5);
  });
});

describe("resolveImage", () => {
  const base = "https://example.com/scenes/logo.gss";

  it("reads a relative image next to the .gss file, like url() in a stylesheet", () => {
    expect(resolveImage("dirt.png", base)).toBe(
      "https://example.com/scenes/dirt.png",
    );
    expect(resolveImage("../img/dirt.png", base)).toBe(
      "https://example.com/img/dirt.png",
    );
  });

  it("keeps absolute paths on the site and full URLs", () => {
    expect(resolveImage("/textures/dirt.png", base)).toBe(
      "https://example.com/textures/dirt.png",
    );
    expect(resolveImage("https://cdn.test/a.png", base)).toBe(
      "https://cdn.test/a.png",
    );
  });

  it("leaves the path as written without a base (the playground, the docs)", () => {
    expect(resolveImage("/textures/dirt.png")).toBe("/textures/dirt.png");
  });
});

describe("the runtime without the compiler", () => {
  it("view.ts never imports the compiler (only its types)", () => {
    const files = valueImports("runtime/view.ts");
    expect(files).toContain("runtime/hover.ts"); // the helper does follow imports
    expect(files.filter((file) => file.startsWith("compiler/"))).toEqual([]);
  });

  it("renderer.ts does: it compiles", () => {
    expect(valueImports("runtime/renderer.ts")).toContain("compiler/index.ts");
  });
});
