import { describe, it, expect } from "vitest";
import { formatGss } from "./format";
import { compileGSS } from "../compiler";
import { PROPERTIES, AT_RULES } from "../compiler/registry";

describe("formatGss", () => {
  it("puts each declaration on its own line", () => {
    expect(formatGss("@scene { cube; } cube { rotate-x: 45deg; color: #fff; }")).toBe(
      `@scene {
  cube;
}

cube {
  rotate-x: 45deg;
  color: #fff;
}
`,
    );
  });

  it("indents nested blocks", () => {
    expect(formatGss("@keyframes k { from { scale: 1; } to { scale: 2; } }")).toBe(
      `@keyframes k {
  from {
    scale: 1;
  }
  to {
    scale: 2;
  }
}
`,
    );
  });

  it("keeps an empty block on two lines", () => {
    expect(formatGss("cube {}")).toBe("cube {\n}\n");
  });

  it("never changes what an example means", () => {
    for (const { examples } of [...PROPERTIES, ...AT_RULES]) {
      for (const example of examples) {
        expect(compileGSS(formatGss(example)), example).toBe(compileGSS(example));
      }
    }
  });
});
