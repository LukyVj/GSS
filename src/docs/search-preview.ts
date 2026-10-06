// The preview of a result of the search: while a word is typed, the right column shows what
// the page of the selected result holds, its sentence, its syntax and an example, in place of
// the drawings. Read from the registry, like the docs: no request, and never a different text.
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS, type Example } from "../compiler/registry/registry";
import { GETTING_STARTED, INSTALLATION } from "./guide";
import { docEntries } from "./start-screen";
import { formatGss } from "./format";
import { highlightGss } from "./highlight";
import { highlightSyntax } from "./highlight-code";
import { renderProse } from "./prose";

export type Preview = {
  page: string; // the anchor of the page
  label: string;
  group: string;
  text: string; // trusted HTML: the prose of the registry, or the first paragraph of a guide
  syntax?: string;
  example?: Example;
};

type Source = { text: string; syntax?: string; examples: Example[] };

const PROPERTY_NAMES = new Set(PROPERTIES.map((property) => property.name));
const prose = (text: string) => renderProse(text, PROPERTY_NAMES);

// Every page of the docs, by its anchor, with what its preview shows
const SOURCES = new Map<string, Source>([
  ...[...GETTING_STARTED, ...INSTALLATION].map((entry): [string, Source] => [
    entry.anchor,
    { text: entry.paragraphs[0] ?? "", examples: entry.example ? [{ code: entry.example }] : [] },
  ]),
  ...AT_RULES.map((atRule): [string, Source] => [`at-${atRule.name}`, { text: prose(atRule.description), syntax: atRule.syntax, examples: atRule.examples }]),
  ...SELECTORS.map((selector): [string, Source] => [selector.anchor, { text: prose(selector.description), examples: selector.examples }]),
  ...FUNCTIONS.map((fn): [string, Source] => [fn.anchor, { text: prose(fn.description), syntax: fn.syntax, examples: fn.examples }]),
  ...SHAPE_DOCS.map((shape): [string, Source] => [`shape-${shape.name}`, { text: prose(shape.description), examples: shape.examples }]),
  ...PROPERTIES.map((property): [string, Source] => [property.name, { text: prose(property.description), syntax: property.syntax, examples: property.examples }]),
]);

let entries: Map<string, { label: string; group: string }> | undefined;

// "material--example-2" → the page "material", with its second example; "material--values" →
// the page, with its first example
export function previewEntry(anchor: string): Preview | null {
  const [page, part] = anchor.split("--");
  const source = SOURCES.get(page);
  entries ??= new Map(docEntries().map((entry) => [entry.anchor, entry]));
  const entry = entries.get(page);
  if (!source || !entry) return null;
  const index = Number(part?.match(/^example-(\d+)$/)?.[1] ?? 1) - 1;
  const example = source.examples[index] ?? source.examples[0];
  return {
    page,
    label: entry.label,
    group: entry.group,
    text: source.text,
    ...(source.syntax ? { syntax: source.syntax } : {}),
    ...(example ? { example } : {}),
  };
}

// ----- In the page -----

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// The code in the colors of the dark docs, whatever the page under the search
export function renderPreview(preview: Preview, href: string): HTMLElement {
  const panel = element("div", "gss-search-preview gss-dark");
  panel.dataset.page = preview.page;
  const title = element("h3", "gss-search-preview-title");
  title.append(element("code", "", preview.label));
  const text = element("p", "gss-search-preview-text");
  text.innerHTML = preview.text; // the registry and the guides, not read from anywhere
  panel.append(element("div", "gss-search-start-title", preview.group), title, text);
  if (preview.syntax) {
    const syntax = element("code", "gss syntax gss-search-preview-syntax");
    syntax.innerHTML = highlightSyntax(preview.syntax);
    panel.append(syntax);
  }
  if (preview.example) {
    if (preview.example.name) panel.append(element("div", "gss-search-preview-example", preview.example.name));
    const pre = element("pre", "gss-search-preview-code");
    const code = element("code", "gss");
    code.innerHTML = highlightGss(formatGss(preview.example.code));
    pre.append(code);
    panel.append(pre);
  }
  const link = element("a", "gss-concept-link", "Open the page →");
  link.href = href;
  panel.append(link);
  return panel;
}

// The preview takes the place of the drawings of the column; none brings them back
export function showPreview(column: HTMLElement, preview: HTMLElement | null): void {
  column.querySelector(":scope > .gss-search-preview")?.remove();
  column.toggleAttribute("data-preview", preview !== null);
  if (preview) {
    column.append(preview);
    column.scrollTop = 0;
  }
}

// The result DocSearch selects, by the pointer or the arrows, while a word is typed
export function placePreview(modal: HTMLElement, column: HTMLElement, href: (anchor: string) => string): void {
  const typed = modal.querySelector<HTMLInputElement>(".DocSearch-Input")?.value.trim();
  const hit = typed ? modal.querySelector<HTMLAnchorElement>('.DocSearch-Hit[aria-selected="true"] a') : null;
  const anchor = hit ? decodeURIComponent(new URL(hit.href, location.href).hash.slice(1)) : "";
  const shown = column.querySelector<HTMLElement>(":scope > .gss-search-preview");
  if ((shown?.dataset.anchor ?? "") === anchor) return; // the same result: the column keeps its scroll
  const preview = anchor ? previewEntry(anchor) : null;
  const panel = preview ? renderPreview(preview, href(anchor)) : null;
  if (panel) panel.dataset.anchor = anchor;
  showPreview(column, panel);
}
