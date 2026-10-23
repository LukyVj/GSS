// The autocompletion of the extension: the same suggestions as the playground (decision 89),
// in a .gss file and in the <script type="text/gss"> of an HTML page. Pure functions here;
// extension.ts hands them to VS Code. esbuild copies the playground's code into the extension.
import { mixinSuggestions, propertySuggestions } from "../../../src/runtime/completion";

export type SuggestionItem = {
  label: string;
  kind: "property" | "mixin";
  detail?: string;
  documentation?: string; // Markdown: code between backticks, like the registry writes it
  insertText: string;
};

// What to offer at offset, and where the typed part starts (an offset of the same text)
export type Suggestions = { from: number; items: SuggestionItem[] };

// The GSS of the script the offset is in: from after its ">" to its "</script", or to the
// end of the page while it is not closed yet; null outside any such script
export function gssScriptAt(page: string, offset: number): { start: number; end: number } | null {
  const opening = /<script\b(?=[^>]*\btype\s*=\s*(['"]?)text\/gss\1[\s>/])[^>]*>/gi;
  for (let found = opening.exec(page); found; found = opening.exec(page)) {
    const start = found.index + found[0].length;
    if (start > offset) return null;
    const closing = page.slice(start).search(/<\/script/i);
    const end = closing < 0 ? page.length : start + closing;
    if (offset <= end) return { start, end };
    opening.lastIndex = end;
  }
  return null;
}

// explicit: asked for (Ctrl+Space), where nothing typed yet offers every property
export function suggestAt(
  text: string,
  offset: number,
  language: "gss" | "html",
  explicit: boolean,
): Suggestions | null {
  const script = language === "html" ? gssScriptAt(text, offset) : { start: 0, end: text.length };
  if (!script) return null;
  const code = text.slice(script.start, script.end);
  const pos = offset - script.start;

  // After @apply: the mixins of the file, or of the script (decision 174)
  const mixins = mixinSuggestions(code, pos);
  if (mixins)
    return {
      from: script.start + mixins.from,
      items: mixins.names.map((name) => ({ label: name, kind: "mixin", detail: "@mixin", insertText: name })),
    };

  const found = propertySuggestions(code, pos);
  // Nothing typed: only when asked, not after every { or ;
  if (!found || (found.from === pos && !explicit)) return null;
  // "color: ", ready for the value; just the name when a ":" already follows
  const colon = code[pos] === ":";
  return {
    from: script.start + found.from,
    items: found.properties.map((property) => ({
      label: property.name,
      kind: "property",
      detail: property.syntax,
      documentation: property.description,
      insertText: colon ? property.name : `${property.name}: `,
    })),
  };
}
