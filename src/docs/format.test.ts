import { describe, it, expect } from "vitest";
import { formatGss } from "./format";
import scene from "../scene.gss?raw";
import { compileGSS } from "../compiler";
import { PROPERTIES, AT_RULES } from "../compiler/registry/registry";

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
        expect(compileGSS(formatGss(example.code)), example.code).toBe(
          compileGSS(example.code),
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

  it("keeps a comment on its own line after an element without ;", () => {
    const code =
      "@scene {\n  prism#star\n\n  /* drops */\n  sphere.drop * 2\n}\n";
    expect(formatGss(code)).toBe(code);
  });
});

describe("formatGss with mixins", () => {
  it("keeps the parameters of @mixin on one line, with one space after each colon", () => {
    expect(formatGss("@mixin --ball(--x, --size:0.4,  --tint <color> :#3a7bff){radius:var(--size);@contents;}")).toBe(
      "@mixin --ball(--x, --size: 0.4, --tint <color>: #3a7bff) {\n  radius: var(--size);\n  @contents;\n}\n",
    );
  });

  it("puts @apply on its own line, and its block like a rule", () => {
    expect(formatGss("@mixin --m{size:1;} cube{color:red;@apply --ball(0.6,  #ff5a36);@apply --small{color:red;}}")).toBe(
      "@mixin --m {\n  size: 1;\n}\n\ncube {\n  color: red;\n  @apply --ball(0.6, #ff5a36);\n  @apply --small {\n    color: red;\n  }\n}\n",
    );
  });
});

describe("formatGss with groups", () => {
  it("puts one element per line, with or without ;", () => {
    expect(
      formatGss(
        "@scene { sphere#foo group#letters { cube#L cube#U; cube#C } }",
      ),
    ).toBe(
      `@scene {
  sphere#foo
  group#letters {
    cube#L
    cube#U;
    cube#C
  }
}
`,
    );
  });

  it("keeps the spaces of a descendant selector", () => {
    expect(formatGss("#letters   #S #left{size:1}")).toBe(
      `#letters #S #left {
  size: 1
}
`,
    );
  });

  it("keeps the GLSL of a @paint as it is written, and the blocks around it apart", () => {
    const glsl = `{
  // it's GLSL: { not GSS }
  out vec4 color;
  void main(){color=vec4(1.0);}
}`;
    expect(formatGss(`@paint fill ${glsl} @scene{cube;}`)).toBe(`@paint fill ${glsl}

@scene {
  cube;
}
`);
  });
});
