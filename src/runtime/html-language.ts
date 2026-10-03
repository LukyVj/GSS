import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// The HTML tab of the playground (decision 101): a small reader of tags, attributes,
// strings and comments, enough to write the elements that element(#id) shows. Colored with
// the palette of GSS code (src/styles/gss-code.css, .gss-dark), like the GLSL tab.
type State = { tag: boolean; quote: string | null; comment: boolean };

const html = StreamLanguage.define<State>({
  name: "html",
  startState: () => ({ tag: false, quote: null, comment: false }),
  copyState: (state) => ({ ...state }),
  token(stream, state) {
    // A comment or a quoted value can go over several lines
    if (state.comment) {
      if (stream.skipTo("-->")) {
        stream.match("-->");
        state.comment = false;
      } else stream.skipToEnd();
      return "comment";
    }
    if (state.quote) {
      if (stream.skipTo(state.quote)) {
        stream.next();
        state.quote = null;
      } else stream.skipToEnd();
      return "string";
    }
    if (stream.match("<!--")) {
      state.comment = true;
      return "comment";
    }
    if (!state.tag) {
      if (stream.match(/^<\/?[A-Za-z][\w-]*/)) {
        state.tag = true;
        return "tagName";
      }
      if (stream.match(/^&[\w#]+;/)) return "character";
      stream.next();
      stream.eatWhile(/[^<&]/);
      return null;
    }
    // Inside a tag: attributes, their values, the end of the tag
    if (stream.eatSpace()) return null;
    if (stream.match(/^\/?>/)) {
      state.tag = false;
      return "tagName";
    }
    const quote = stream.peek();
    if (quote === '"' || quote === "'") {
      stream.next();
      state.quote = quote;
      return "string";
    }
    if (stream.match(/^[\w:-]+/)) return "attributeName";
    stream.next();
    return "punctuation";
  },
});

const htmlColors = HighlightStyle.define([
  { tag: t.tagName, color: "var(--gss-selector)" },
  { tag: t.attributeName, color: "var(--gss-property)" },
  { tag: t.string, color: "var(--gss-string)" },
  { tag: t.character, color: "var(--gss-number)" },
  { tag: t.comment, color: "var(--gss-comment)", fontStyle: "italic" },
  { tag: t.punctuation, color: "var(--gss-punct)" },
]);

// Everything the HTML tab needs to read and color the elements of a scene
export const htmlLanguage = [html, syntaxHighlighting(htmlColors)];
