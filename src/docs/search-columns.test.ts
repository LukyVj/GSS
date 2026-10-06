// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { COLUMNS, clampWidth, mountColumnResizers, readWidths } from "./search-columns";
import { docSections, renderContents } from "./start-screen";

function modal(width = 1120): HTMLElement {
  const element = document.createElement("div");
  element.className = "DocSearch-Modal";
  element.innerHTML = '<header class="DocSearch-SearchBar"></header><footer class="DocSearch-Footer"></footer>';
  Object.defineProperty(element, "clientWidth", { value: width });
  document.body.append(element);
  return element;
}
const handle = (element: HTMLElement, column: string) =>
  element.querySelector<HTMLElement>(`.gss-search-resizer[data-column="${column}"]`)!;
const width = (element: HTMLElement, column: string) => element.style.getPropertyValue(`--gss-search-${column}`);
const key = (target: HTMLElement, name: string, shiftKey = false) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("the width of a column of the search", () => {
  it("stays between its smallest and its largest", () => {
    expect(clampWidth("contents", 10, 1120)).toBe(COLUMNS.contents.min);
    expect(clampWidth("contents", 5000, 1120)).toBe(COLUMNS.contents.max);
    expect(clampWidth("concepts", 380, 1120)).toBe(380);
  });

  it("never takes more than its share of a narrow window, so the results keep room", () => {
    expect(clampWidth("concepts", COLUMNS.concepts.max, 800)).toBeLessThan(COLUMNS.concepts.max);
    expect(clampWidth("concepts", COLUMNS.concepts.max, 800)).toBeGreaterThanOrEqual(COLUMNS.concepts.min);
  });

  it("is read back from what the reader chose, and anything else is ignored", () => {
    localStorage.setItem("gss-search-columns", JSON.stringify({ contents: 300, concepts: "wide" }));
    expect(readWidths()).toEqual({ contents: 300 });
    localStorage.setItem("gss-search-columns", "{");
    expect(readWidths()).toEqual({});
  });
});

describe("the handles between the columns", () => {
  it("are separators the keyboard can reach, one beside each column", () => {
    const element = modal();
    mountColumnResizers(element);
    for (const column of ["contents", "concepts"]) {
      const separator = handle(element, column);
      expect(separator.getAttribute("role")).toBe("separator");
      expect(separator.getAttribute("aria-orientation")).toBe("vertical");
      expect(separator.tabIndex).toBe(0);
      expect(separator.getAttribute("aria-valuenow")).toBe(String(COLUMNS[column as keyof typeof COLUMNS].initial));
    }
    mountColumnResizers(element);
    expect(element.querySelectorAll(".gss-search-resizer")).toHaveLength(2);
  });

  it("widen a column with the arrows, toward the results for the right one", () => {
    const element = modal();
    mountColumnResizers(element);
    key(handle(element, "contents"), "ArrowRight");
    expect(width(element, "contents")).toBe(`${COLUMNS.contents.initial + 16}px`);
    key(handle(element, "concepts"), "ArrowLeft", true);
    expect(width(element, "concepts")).toBe(`${COLUMNS.concepts.initial + 64}px`);
    expect(handle(element, "concepts").getAttribute("aria-valuenow")).toBe(String(COLUMNS.concepts.initial + 64));
  });

  it("go to the smallest and largest with Home and End, and back with Enter", () => {
    const element = modal();
    mountColumnResizers(element);
    const separator = handle(element, "contents");
    key(separator, "Home");
    expect(width(element, "contents")).toBe(`${COLUMNS.contents.min}px`);
    key(separator, "End");
    expect(width(element, "contents")).toBe(`${COLUMNS.contents.max}px`);
    key(separator, "Enter");
    expect(width(element, "contents")).toBe("");
  });

  it("follow the pointer", () => {
    const element = modal();
    mountColumnResizers(element);
    const separator = handle(element, "concepts");
    separator.dispatchEvent(new PointerEvent("pointerdown", { clientX: 800, button: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 700, bubbles: true }));
    expect(separator.classList.contains("gss-search-resizer--active")).toBe(true);
    expect(handle(element, "contents").classList.contains("gss-search-resizer--active")).toBe(false);
    window.dispatchEvent(new PointerEvent("pointerup", { clientX: 700, bubbles: true }));
    expect(separator.classList.contains("gss-search-resizer--active")).toBe(false);
    expect(width(element, "concepts")).toBe(`${COLUMNS.concepts.initial + 100}px`);
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 600, bubbles: true }));
    expect(width(element, "concepts")).toBe(`${COLUMNS.concepts.initial + 100}px`);
  });

  it("keep the widths for the next time the search opens", () => {
    mountColumnResizers(modal());
    key(handle(document.querySelector(".DocSearch-Modal")!, "contents"), "ArrowRight");
    document.body.innerHTML = "";
    const next = modal();
    mountColumnResizers(next);
    expect(width(next, "contents")).toBe(`${COLUMNS.contents.initial + 16}px`);
    expect(width(next, "concepts")).toBe("");
  });
});

describe("the contents of the search", () => {
  it("carry the icon of each group of the docs, shown when the column is wide enough", () => {
    const column = renderContents(docSections(), true);
    const links = [...column.querySelectorAll(".gss-search-contents-link")];
    expect(links.length).toBe(docSections().length);
    for (const link of links) expect(link.querySelector("svg.gss-search-contents-icon")?.getAttribute("aria-hidden")).toBe("true");
  });
});
