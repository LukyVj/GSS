import { describe, it, expect } from "vitest";
import { compileScene } from "../compiler/index";
import { changelogScene, POINTS } from "./scene";
import { prerenderChangelogHtml, releaseWeights, renderChangelog } from "./render";
import { readFileSync } from "node:fs";

describe("the cloud beside the changelog", () => {
  it("compiles: a cloud of points, moved by the scroll of the page", () => {
    const source = changelogScene([10, 20, 30]);
    expect(source).toContain(`sphere.point * ${POINTS}`);
    expect(source).toContain("animation-timeline: scroll(root)");
    expect(() => compileScene(source)).not.toThrow();
  });

  it("gives each version its own shape, held over its part of the scroll", () => {
    const source = changelogScene([1, 1, 2]);
    const frames = source.slice(source.indexOf("@keyframes morph"));
    expect(frames).toContain("0%, 20% { translate: var(--x0) var(--y0) var(--z0); }");
    expect(frames).toContain("30%, 45% { translate: var(--x1) var(--y1) var(--z1); }");
    expect(frames).toContain("60%, 100% { translate: var(--x2) var(--y2) var(--z2); }");
  });

  it("weighs each version by its lines", () => {
    const html = renderChangelog("## [0.0.2] — 2026-10-02\n\n### Added\n\n- A.\n- B.\n\n## [0.0.1] — 2026-10-01\n\n- C.\n");
    expect(releaseWeights(html)).toEqual([4 + 2 + 2, 4 + 1]);
  });

  it("is written into the page, after the changelog", () => {
    const html = prerenderChangelogHtml(readFileSync("changelog.html", "utf8"));
    expect(html).toMatch(/<aside class="cloud" aria-hidden="true"><gss-scene controls="none"><script type="text\/gss">[\s\S]*@keyframes morph[\s\S]*<\/script><\/gss-scene><\/aside>/);
  });
});
