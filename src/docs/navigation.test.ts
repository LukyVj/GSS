import { describe, it, expect } from "vitest";
import { DOC_GROUPS, groupEntries, sortEntries } from "./navigation";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
import { GETTING_STARTED, INSTALLATION } from "./guide";
import { renderDocs } from "./render";
import { VERSION, CDN_URL } from "../version";

const anchors = [
  ...PROPERTIES.map((p) => p.name),
  ...AT_RULES.map((a) => `at-${a.name}`),
  ...SELECTORS.map((s) => s.anchor),
  ...SHAPE_DOCS.map((s) => `shape-${s.name}`),
  ...FUNCTIONS.map((f) => f.anchor),
  ...GETTING_STARTED.map((g) => g.anchor),
  ...INSTALLATION.map((g) => g.anchor),
];

describe("documentation navigation", () => {
  it("assigns every current article exactly once, without stale anchors", () => {
    const configured = DOC_GROUPS.flatMap((group) => group.anchors);
    expect(new Set(configured).size).toBe(configured.length);
    expect([...configured].sort()).toEqual([...anchors].sort());
  });
  it("sorts alphabetically by default and honors explicit priorities without mutating input", () => {
    const entries = ["zebra", "apple", "middle"].map((label) => ({ anchor: label, label, html: "" }));
    expect(sortEntries(entries).map((e) => e.label)).toEqual(["apple", "middle", "zebra"]);
    expect(sortEntries(entries.map((e) => e.label === "zebra" ? { ...e, order: -1 } : e)).map((e) => e.label)).toEqual(["zebra", "apple", "middle"]);
    expect(entries[0].label).toBe("zebra");
  });
  it("keeps new unclassified entries reachable", () => {
    expect(groupEntries([{ anchor: "future", label: "Future", html: "" }])[0].entries[0].anchor).toBe("future");
  });
  it("groups all color entries together and keeps math separate", () => {
    const colors = DOC_GROUPS.find((g) => g.id === "colors")!;
    expect(colors.anchors).toEqual(expect.arrayContaining(["color", "background", "floor", "fn-oklab-oklch", "fn-color-mix", "fn-gradients"]));
    expect(DOC_GROUPS.find((g) => g.id === "values")!.anchors).toContain("fn-calc");
    expect(colors.anchors).not.toContain("fn-calc");
  });
  it("puts embedding first under Installation and includes versioned setup instructions", () => {
    const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    const installation = html.slice(html.indexOf('<section id="installation"'), html.indexOf('<section id="at-rules"'));
    expect(installation).toContain('id="embedding"');
    expect(installation.indexOf('id="embedding"')).toBeLessThan(installation.indexOf('id="install-package"'));
    expect(installation).toContain(`gss-lang@${VERSION}`);
    expect(installation).toContain(CDN_URL);
    expect(installation).toContain("gss-lang/runtime");
    expect(installation).toContain("gss-lang/vite");
    expect(html).not.toContain('id="other-reference"');
  });
});
