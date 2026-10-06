// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { placePreview, previewEntry, renderPreview, showPreview } from "./search-preview";
import { docEntries } from "./start-screen";
import { renderDocs } from "./render";
import { GETTING_STARTED } from "./guide";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";

const docs = document.createElement("div");
docs.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);

describe("the preview of a result of the search", () => {
  it("exists for every page of the docs, named and grouped like the contents", () => {
    for (const entry of docEntries()) {
      expect(previewEntry(entry.anchor), entry.anchor).toMatchObject({ page: entry.anchor, label: entry.label, group: entry.group });
    }
  });

  it("exists for every part a result can land on, and shows the page of that part", () => {
    for (const article of docs.querySelectorAll("article")) {
      for (const part of article.querySelectorAll("[id]")) {
        expect(previewEntry(part.id)?.page, part.id).toBe(article.id);
      }
    }
  });

  it("says what the page is, with its syntax when it has one", () => {
    const preview = previewEntry("material")!;
    expect(preview.text).toContain("<code>");
    expect(preview.syntax).toBe(PROPERTIES.find((property) => property.name === "material")!.syntax);
    expect(previewEntry("shape-cone")!.syntax).toBeUndefined();
  });

  it("shows the first example of the page, or the one the result lands on", () => {
    const property = PROPERTIES.find((p) => p.examples.length >= 2)!;
    expect(previewEntry(property.name)!.example?.code).toBe(property.examples[0].code);
    expect(previewEntry(`${property.name}--example-2`)!.example?.code).toBe(property.examples[1].code);
    expect(previewEntry(`${property.name}--values`)!.example?.code).toBe(property.examples[0].code);
  });

  it("shows the first paragraph and the scene of a guide", () => {
    const guide = GETTING_STARTED.find((entry) => entry.example)!;
    expect(previewEntry(guide.anchor)).toMatchObject({ text: guide.paragraphs[0], example: { code: guide.example } });
  });

  it("is none for a page the docs do not have", () => {
    expect(previewEntry("")).toBeNull();
    expect(previewEntry("no-such-page--example-1")).toBeNull();
  });
});

describe("the preview, in the page", () => {
  it("shows the code in its colors, and links to the part the result lands on", () => {
    const preview = renderPreview(previewEntry("material--example-1")!, "./docs.html#material--example-1");
    expect(preview.classList.contains("gss-dark")).toBe(true);
    expect(preview.querySelector("pre code.gss .gss-property")).not.toBeNull();
    expect(preview.querySelector("a")!.getAttribute("href")).toBe("./docs.html#material--example-1");
    const more = preview.querySelector(".gss-search-preview-more")!;
    expect(more.querySelector(".gss-search-preview-subset")!.textContent).toBe("This is an excerpt of the page");
    expect(more.lastElementChild!.tagName).toBe("A");
  });

  it("offers to try the example, with its code and its HTML", () => {
    const withHtml = PROPERTIES.flatMap((property) => property.examples.map((example, i) => ({ property, example, i }))).find(({ example }) => example.html)!;
    const preview = renderPreview(previewEntry(`${withHtml.property.name}--example-${withHtml.i + 1}`)!, "#");
    const button = preview.querySelector<HTMLButtonElement>("button.gss-search-try")!;
    expect(button.textContent).toBe("Try it");
    expect(button.dataset.example).toBe(withHtml.example.code);
    expect(button.dataset.html).toBe(withHtml.example.html);
    const plain = renderPreview(previewEntry("material")!, "#").querySelector<HTMLButtonElement>("button.gss-search-try")!;
    expect(plain.dataset.html).toBeUndefined();
  });

  it("offers nothing to try on a page without an example", () => {
    const guide = GETTING_STARTED.find((entry) => !entry.example)!;
    expect(renderPreview(previewEntry(guide.anchor)!, "#").querySelector("button.gss-search-try")).toBeNull();
  });

  it("takes the place of the drawings, which come back without it", () => {
    const column = document.createElement("aside");
    column.innerHTML = '<div class="gss-search-start-title"></div><article class="gss-concept"></article>';
    showPreview(column, renderPreview(previewEntry("material")!, "#material"));
    expect(column.hasAttribute("data-preview")).toBe(true);
    expect(column.querySelectorAll(".gss-search-preview")).toHaveLength(1);
    showPreview(column, renderPreview(previewEntry("color")!, "#color"));
    expect(column.querySelectorAll(".gss-search-preview")).toHaveLength(1);
    showPreview(column, null);
    expect(column.hasAttribute("data-preview")).toBe(false);
    expect(column.querySelector(".gss-search-preview")).toBeNull();
    expect(column.querySelector(".gss-concept")).not.toBeNull();
  });
});

describe("the preview of the selected result", () => {
  const href = (anchor: string) => `#${anchor}`;
  function modal(query: string, hits: [string, boolean][]): { modal: HTMLElement; column: HTMLElement } {
    const element = document.createElement("div");
    element.innerHTML = `<input class="DocSearch-Input" value="${query}"><ul>${hits
      .map(([anchor, selected]) => `<li class="DocSearch-Hit" aria-selected="${selected}"><a href="/docs#${anchor}"></a></li>`)
      .join("")}</ul><aside class="gss-search-concepts"><article class="gss-concept"></article></aside>`;
    return { modal: element, column: element.querySelector("aside")! };
  }
  const shown = (column: HTMLElement) => column.querySelector<HTMLElement>(".gss-search-preview")?.dataset.anchor;

  it("follows the result DocSearch selects", () => {
    const { modal: element, column } = modal("glass", [["material", false], ["material--example-2", true]]);
    placePreview(element, column, href);
    expect(shown(column)).toBe("material--example-2");
    element.querySelectorAll(".DocSearch-Hit").forEach((hit, i) => hit.setAttribute("aria-selected", String(i === 0)));
    placePreview(element, column, href);
    expect(shown(column)).toBe("material");
  });

  it("keeps the preview of the same result, and its scroll", () => {
    const { modal: element, column } = modal("glass", [["material", true]]);
    placePreview(element, column, href);
    const first = column.querySelector(".gss-search-preview");
    placePreview(element, column, href);
    expect(column.querySelector(".gss-search-preview")).toBe(first);
  });

  it("gives the drawings back when the box is empty, or nothing is selected", () => {
    const { modal: element, column } = modal("glass", [["material", true]]);
    placePreview(element, column, href);
    element.querySelector<HTMLInputElement>(".DocSearch-Input")!.value = "";
    placePreview(element, column, href);
    expect(shown(column)).toBeUndefined();
    const none = modal("glass", [["material", false]]);
    placePreview(none.modal, none.column, href);
    expect(shown(none.column)).toBeUndefined();
  });
});
