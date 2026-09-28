import { describe, it, expect } from "vitest";
import { formatGss } from "./format";
import scene from "../scene.gss?raw";
import { compileGSS } from "../compiler";
import { PROPERTIES, AT_RULES } from "../compiler/registry";

describe("formatGss", () => {
  it("puts each declaration on its own line", () => {
    expect(
      formatGss("@scene { cube; } cube { rotate-x: 45deg; color: #fff; }"),
    ).toBe(
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
    expect(
      formatGss("@keyframes k { from { scale: 1; } to { scale: 2; } }"),
    ).toBe(
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
        expect(compileGSS(formatGss(example)), example).toBe(
          compileGSS(example),
        );
      }
    }
  });
});

describe("multiple selectors", () => {
  it("puts each selector of a list on its own line", () => {
    expect(formatGss("#a,#b{color:#fff;}")).toBe(
      "#a,\n#b {\n  color: #fff;\n}\n",
    );
  });

  it("keeps the offsets of @keyframes on one line", () => {
    expect(formatGss("@keyframes k { 0%, 100% { scale: 1; } }")).toContain(
      "  0%, 100% {\n",
    );
  });
});

describe("formatGss with comments", () => {
  it("keeps a comment on its own line", () => {
    expect(formatGss("@scene {\n/* shapes */\ncube; }")).toBe(
      "@scene {\n  /* shapes */\n  cube;\n}\n",
    );
  });

  it("keeps a comment at the end of a line", () => {
    expect(formatGss("cube { color: #fff; /* white */ }")).toBe(
      "cube {\n  color: #fff; /* white */\n}\n",
    );
  });

  it("never touches the inside of a comment", () => {
    const header = "/* Test scene\n   Zone 1:   transforms; */\n\ncube {\n}\n";
    expect(formatGss(header)).toBe(header);
  });

  it("keeps at most one blank line", () => {
    expect(formatGss("cube {\n  scale: 1;\n\n\n\n  color: #fff;\n}")).toBe(
      "cube {\n  scale: 1;\n\n  color: #fff;\n}\n",
    );
  });

  it("keeps what touches together, and one space where there was space", () => {
    expect(
      formatGss("@scene{cube#a.b;}#a{material:glass(1.5,   hammered 0.3);}"),
    ).toBe(
      "@scene {\n  cube#a.b;\n}\n\n#a {\n  material: glass(1.5, hammered 0.3);\n}\n",
    );
  });

  it("puts one space after the colon of a declaration, none before", () => {
    expect(formatGss("cube{radius:1;material :glass(1.5);}")).toBe(
      "cube {\n  radius: 1;\n  material: glass(1.5);\n}\n",
    );
  });

  it("does the same in the frames of @keyframes", () => {
    expect(formatGss("@keyframes k{to{scale:2;}}")).toBe(
      "@keyframes k {\n  to {\n    scale: 2;\n  }\n}\n",
    );
  });

  it("leaves the colons of selectors in @scene stuck", () => {
    expect(formatGss("@scene { cube:nth-child(odd); }")).toBe(
      "@scene {\n  cube:nth-child(odd);\n}\n",
    );
  });

  it("formats scene.gss without changing its meaning", () => {
    expect(compileGSS(formatGss(scene))).toBe(compileGSS(scene));
  });

  it("scene.gss is already formatted (run npm run format)", () => {
    expect(formatGss(scene)).toBe(scene);
  });

  it("gives the same result when run twice", () => {
    expect(formatGss(formatGss(scene))).toBe(formatGss(scene));
  });
});
