import { highlightGss } from "../docs/highlight";
import { PROPERTIES, SELECTORS, SHAPE_DOCS } from "../compiler/registry/registry";

// Highlights pillar GSS and fills the registry counts so the home page reads without JS.

export function prerenderHomeHtml(html: string): string {
  let out = html.replace(/<code data-gss>([\s\S]*?)<\/code>/g, (_match, source: string) => {
    return `<code data-gss class="gss">${highlightGss(source)}</code>`;
  });
  out = out.replace(
    /(<strong id="count-shapes">)[^<]*/,
    `$1${SHAPE_DOCS.length}`,
  );
  out = out.replace(
    /(<strong id="count-properties">)[^<]*/,
    `$1${PROPERTIES.length}`,
  );
  out = out.replace(
    /(<strong id="count-selectors">)[^<]*/,
    `$1${SELECTORS.length}`,
  );
  return out;
}
