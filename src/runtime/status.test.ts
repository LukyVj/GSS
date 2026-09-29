import { describe, it, expect } from "vitest";
import { plural, statusParts, fpsText } from "./status";

describe("plural", () => {
  it("keeps the word singular for 1", () => {
    expect(plural(1, "object")).toBe("1 object");
  });
  it("adds an s otherwise, 0 included", () => {
    expect(plural(0, "object")).toBe("0 objects");
    expect(plural(3, "error")).toBe("3 errors");
  });
});

describe("statusParts", () => {
  const stats = { errors: 0, objects: 3, glslLines: 412, compileMs: 4.3 };

  it("says ok, then the numbers of the last compile", () => {
    expect(statusParts(stats)).toEqual(["ok", "3 objects", "glsl 412 lines", "compiled in 4 ms"]);
  });
  it("says only the errors when there are some", () => {
    expect(statusParts({ ...stats, errors: 1 })).toEqual(["1 error"]);
  });
  it("never says 0 ms", () => {
    expect(statusParts({ ...stats, compileMs: 0.2 })).toContain("compiled in <1 ms");
  });
});

describe("fpsText", () => {
  it("counts the frames of one second", () => {
    expect(fpsText(59, 1000)).toBe("59 fps");
  });
  it("brings any duration back to one second", () => {
    expect(fpsText(30, 520)).toBe("58 fps");
  });
});
