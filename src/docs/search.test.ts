import { describe, it, expect } from "vitest";
import { localUrl } from "./search";

describe("localUrl", () => {
  it("keeps the path and the anchor, so a result stays on the current site", () => {
    expect(localUrl("https://www.gss-lang.dev/docs#shape-cone")).toBe(
      "/docs#shape-cone",
    );
  });

  it("works without an anchor", () => {
    expect(localUrl("https://www.gss-lang.dev/docs")).toBe("/docs");
  });
});
