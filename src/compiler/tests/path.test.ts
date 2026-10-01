import { describe, it, expect } from "vitest";
import { compileGSS } from "..";

const brace = 'd: path("M12.5 4.5C9.5 4.5 9 6 9 8.5v4c0 2-1 3.5-3.5 3.5C8 16 9 17.5 9 19.5v4c0 2.5.5 4 3.5 4")';

describe("path objects", () => {
  it("become a GLSL function called from map()", () => {
    const shader = compileGSS(`@scene { path; } path { ${brace}; stroke-width: 2; }`);
    expect(shader).toContain("float sdShape0(vec3 p)");
    expect(shader).toContain("sdShape0(q)");
    expect(shader).toContain("segment2(q, ");
  });

  it("write the function once when objects share the same path", () => {
    const shader = compileGSS(`@scene { path * 3; } path { ${brace}; }`);
    expect(shader.match(/float sdShape\d\(vec3 p\)/g)).toHaveLength(1);
    expect(shader.match(/sdShape0\(q\)/g)).toHaveLength(3);
  });

  it("center on the view-box, y up", () => {
    // A dot at (16, 8) in a 32 box: 8 above the center
    const shader = compileGSS('@scene { path; } path { d: path("M16 8 L17 8"); view-box: 0 0 32 32; }');
    expect(shader).toContain("segment2(q, vec2(0.0, 8.0), vec2(1.0, 8.0))");
  });

  it("need a d", () => {
    expect(() => compileGSS("@scene { path; }")).toThrow("path needs a d");
  });

  it("explain a wrong d, a wrong view-box and an unknown command", () => {
    expect(() => compileGSS('@scene { path; } path { d: "M0 0 L1 1"; }')).toThrow('d expects path("…")');
    expect(() => compileGSS('@scene { path; } path { d: path("M0 0 L1 1"); view-box: 0 0 32; }')).toThrow(
      "view-box expects four numbers",
    );
    expect(() => compileGSS('@scene { path; } path { d: path("M0 0 X1 1"); }')).toThrow('Unknown path command "X"');
  });

  it("draws an arc", () => {
    expect(() => compileGSS('@scene { path; } path { d: path("M-1 0 A1 1 0 0 1 1 0"); }')).not.toThrow();
  });
});
