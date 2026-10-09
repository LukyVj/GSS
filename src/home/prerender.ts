import { highlightGss } from "../docs/highlight";
import { highlightCode } from "../docs/highlight-code";
import { PROPERTIES, SELECTORS, SHAPE_DOCS } from "../compiler/registry/registry";

// Highlights pillar GSS and the install snippets, and fills the registry counts so the
// home page reads without JS.

// The snippets are written escaped in index.html: the highlighter wants the code itself
const unescapeHtml = (text: string) =>
  text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

export function prerenderHomeHtml(html: string): string {
  let out = html.replace(/<code data-gss>([\s\S]*?)<\/code>/g, (_match, source: string) => {
    return `<code data-gss class="gss">${highlightGss(source)}</code>`;
  });
  out = out.replace(
    /<code data-lang="(sh|js|html)">([\s\S]*?)<\/code>/g,
    (_match, lang: "sh" | "js" | "html", source: string) =>
      `<code data-lang="${lang}" class="gss">${highlightCode(lang, unescapeHtml(source))}</code>`,
  );
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
