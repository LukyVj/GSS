import { describe, it, expect } from "vitest";
import { escapeHighlight, escapeHighlights, localUrl } from "./search";

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

describe("escapeHighlight", () => {
  it("shows a tag of the docs as text, and keeps the marks of the search", () => {
    expect(escapeHighlight("<mark>From</mark> <<mark>gss-scene</mark>>")).toBe(
      "<mark>From</mark> &lt;<mark>gss-scene</mark>&gt;",
    );
  });

  it("leaves a text that is already escaped as it is", () => {
    expect(escapeHighlight("&lt;video&gt; and <mark>poster</mark>")).toBe("&lt;video&gt; and <mark>poster</mark>");
  });
});

describe("escapeHighlights", () => {
  it("escapes every highlighted and snippeted value of a result, and nothing else", () => {
    const item = {
      url: "/docs#a",
      hierarchy: { lvl1: "Embedding a scene", lvl2: "From <gss-scene>" },
      _highlightResult: { hierarchy: { lvl2: { value: "From <<mark>gss-scene</mark>>", matchLevel: "full" } } },
      _snippetResult: { content: { value: "write <gss-scene src>", matchLevel: "none" } },
    };
    const escaped = escapeHighlights(item);
    expect(escaped._highlightResult.hierarchy.lvl2).toEqual({ value: "From &lt;<mark>gss-scene</mark>&gt;", matchLevel: "full" });
    expect(escaped._snippetResult.content.value).toBe("write &lt;gss-scene src&gt;");
    expect(escaped.hierarchy.lvl2).toBe("From <gss-scene>");
  });
});
