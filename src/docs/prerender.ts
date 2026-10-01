import {
  PROPERTIES,
  AT_RULES,
  SELECTORS,
  SHAPE_DOCS,
  FUNCTIONS,
} from "../compiler/registry/registry";
import { renderDocs } from "./render";

// Fills the empty #docs shell at build (and in dev) so the reference is readable without JS.

export function prerenderDocsHtml(html: string): string {
  const body = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
  if (!html.includes('<main id="docs"></main>')) {
    throw new Error('prerender docs: expected <main id="docs"></main>');
  }
  return html.replace('<main id="docs"></main>', `<main id="docs">${body}</main>`);
}
