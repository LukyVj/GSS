// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { resolvePage, neighbors, partsOf, type PageIndex } from "./pages";
import { renderDocs } from "./render";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";

describe("On this page example names", () => {
  it("uses the documented names and preserves existing example links", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    const article = root.querySelector<HTMLElement>("#fn-abs-sqrt-pow")!;
    expect(partsOf(article).slice(1)).toEqual([
      { id: "fn-abs-sqrt-pow--example-1", label: "abs()" },
      { id: "fn-abs-sqrt-pow--example-2", label: "sqrt()" },
      { id: "fn-abs-sqrt-pow--example-3", label: "pow()" },
      { id: "fn-abs-sqrt-pow--example-4", label: "abs(), sqrt() and pow() together" },
    ]);
    expect(article.querySelectorAll(".example")[1].id).toBe("fn-abs-sqrt-pow--example-2");
  });

  it("falls back for unnamed examples without borrowing another example's name", () => {
    const article = document.createElement("article");
    article.id = "sample";
    article.innerHTML = '<div class="example"></div><div class="example"></div><p class="example-name"> A &amp; B </p>';
    expect(partsOf(article).map((part) => part.label)).toEqual(["example 1", "A & B"]);
    article.innerHTML = '<div class="example"></div><p class="example-name"> </p>';
    expect(partsOf(article)).toEqual([{ id: "sample--example-1", label: "example" }]);
  });
});

const index: PageIndex = {
  sections: [
    { id: "getting-started", entries: ["why-gss", "first-scene"] },
    { id: "object-properties", entries: ["translate", "material"] },
  ],
};

describe("resolvePage", () => {
  it("shows the entry of the hash", () => {
    expect(resolvePage("#material", index)).toEqual({ page: "material", target: null });
  });
  it("shows the entry of a part, and scrolls to the part", () => {
    expect(resolvePage("#material--example-2", index)).toEqual({ page: "material", target: "material--example-2" });
  });
  it("opens a section at its first entry", () => {
    expect(resolvePage("#object-properties", index).page).toBe("translate");
  });
  it("starts at the first entry without a hash, or with an unknown one", () => {
    expect(resolvePage("", index).page).toBe("why-gss");
    expect(resolvePage("#nope", index).page).toBe("why-gss");
  });
});

describe("neighbors", () => {
  it("crosses sections, in reading order", () => {
    expect(neighbors("first-scene", index)).toEqual({ previous: "why-gss", next: "translate" });
  });
  it("has no previous at the start and no next at the end", () => {
    expect(neighbors("why-gss", index).previous).toBeUndefined();
    expect(neighbors("material", index).next).toBeUndefined();
  });
});
