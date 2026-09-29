import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { cpp } from "@codemirror/lang-cpp";

// The colors of the GLSL tab. GLSL is read with the C++ grammar (close enough),
// and colored with the palette of GSS code (src/styles/gss-code.css, .gss-dark):
// the same meaning gets the same color on both sides of the compiler.
const glslColors = HighlightStyle.define([
  // if, return, const, uniform, in, out…
  { tag: [t.keyword, t.controlKeyword, t.modifier, t.definitionKeyword, t.operatorKeyword], color: "var(--gss-at-rule)" },
  // float, int, void, and the types GLSL adds (vec3, mat2…)
  { tag: [t.typeName, t.standard(t.typeName)], color: "var(--gss-id)" },
  // functions, called or declared: map(), sdSphere(), mix()
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--gss-property)" },
  // .xyz, .rgb
  { tag: t.propertyName, color: "var(--gss-selector)" },
  { tag: [t.number, t.bool], color: "var(--gss-number)" },
  { tag: [t.string, t.character], color: "var(--gss-string)" },
  // #version, #define, and what follows them
  { tag: [t.processingInstruction, t.meta, t.special(t.name)], color: "var(--gss-keyword)" },
  { tag: [t.lineComment, t.blockComment], color: "var(--gss-comment)", fontStyle: "italic" },
  { tag: [t.operator, t.arithmeticOperator, t.logicOperator, t.compareOperator, t.definitionOperator, t.updateOperator, t.bitwiseOperator, t.punctuation, t.paren, t.brace, t.squareBracket, t.separator], color: "var(--gss-punct)" },
]);

// Everything the GLSL tab needs to read and color a shader
export const glslLanguage = [cpp(), syntaxHighlighting(glslColors)];
