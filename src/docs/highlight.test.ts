import { describe, it, expect } from "vitest";
import { highlightGss, classifyGss } from "./highlight";
import scene from "../scene.gss?raw";

// Reads the HTML back as plain text, like a browser would show it
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

// The kind given to a piece of text, e.g. kind(html, "radius") → "property"
function kind(html: string, text: string): string | undefined {
  return html.match(new RegExp(`<span class="gss-([\\w-]+)">${text}</span>`))?.[1];
}

describe("highlightGss", () => {
  it("never changes the text, so the colors line up with the editor", () => {
    expect(textOf(highlightGss(scene))).toBe(scene);
  });

  it("escapes HTML inside the code", () => {
    expect(highlightGss("/* <b> & */")).toBe('<span class="gss-comment">/* &lt;b&gt; &amp; */</span>');
  });

  it("tells selectors, properties and values apart", () => {
    const html = highlightGss(
      "@scene { cube#hero.big; } cube { radius: 1; color: #ff5a36; rotate-x: 70deg; material: glass(1.5); animation: a 2s ease-in-out; }",
    );
    expect(kind(html, "@scene")).toBe("at-rule");
    expect(kind(html, "cube")).toBe("selector");
    expect(kind(html, "#hero")).toBe("id");
    expect(kind(html, "big")).toBe("selector");
    expect(kind(html, "radius")).toBe("property");
    expect(kind(html, "#ff5a36")).toBe("color");
    expect(kind(html, "70")).toBe("number");
    expect(kind(html, "deg")).toBe("unit");
    expect(kind(html, "glass")).toBe("function");
    expect(kind(html, "ease-in-out")).toBe("keyword");
    expect(kind(highlightGss('path { d: path("M0 0"); }'), "&quot;M0 0&quot;")).toBe("string");
  });

  it("colors custom properties as variables, declared or read", () => {
    const html = highlightGss("scene { --size: 2; } cube { radius: var(--gap, 1); }");
    expect(kind(html, "--size")).toBe("variable");
    expect(kind(html, "--gap")).toBe("variable");
    expect(kind(html, "var")).toBe("function");
  });

  it("colors the frames of @keyframes as selectors", () => {
    const html = highlightGss("@keyframes k { from { scale: 1; } 50% { scale: 2; } }");
    expect(kind(html, "from")).toBe("selector");
    expect(kind(html, "scale")).toBe("property");
    expect(kind(html, "50%")).toBe("number");
  });
});

describe("classifyGss", () => {
  it("never throws on unfinished code", () => {
    expect(() => classifyGss("cube { color: # ~ /* not closed")).not.toThrow();
    expect(classifyGss("a ~").at(-1)).toEqual({ start: 2, end: 3, kind: "invalid" });
  });
});
