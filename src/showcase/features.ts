import { tokenize } from "../compiler/syntax/tokenizer";
import { parse } from "../compiler/syntax/parser";
import type { Declaration, SceneElement, Stylesheet } from "../compiler/syntax/ast";
import type { Token } from "../compiler/syntax/tokenizer";

// What a scene of the archive uses (decision 172): read from its code at build time, so a
// scene never claims a feature it does not have, and a new scene needs no list. Only the
// features worth a chip: the shapes, colors and transforms every scene has are left out.

export type Feature = { label: string; anchor: string }; // anchor: its page of the docs

// What the code holds, gathered once
type Usage = {
  shapes: Set<string>; // the tags of @scene
  properties: Set<string>; // every declaration, in rules and keyframes
  functions: Set<string>; // noise, scroll, var… (an IDENT before "(")
  images: boolean; // a texture: url(…), not paint() or element(), which have their own chip
  words: Set<string>; // the keywords of the values: glass, gold…
  pseudos: Set<string>; // hover, has, face… (after ":" or "::" in a selector)
  sheet: Stylesheet;
};

type Notable = Feature & { uses: (usage: Usage) => boolean };

const shape = (...names: string[]) => (u: Usage) => names.some((name) => u.shapes.has(name));
const property = (...names: string[]) => (u: Usage) => names.some((name) => u.properties.has(name));
const fn = (...names: string[]) => (u: Usage) => names.some((name) => u.functions.has(name));
const pseudo = (...names: string[]) => (u: Usage) => names.some((name) => u.pseudos.has(name));
// A material, written as a keyword or as a function
const material = (...names: string[]) => (u: Usage) => names.some((name) => u.words.has(name) || u.functions.has(name));

// From the most telling to the most common: a card shows the first ones
export const NOTABLE: Notable[] = [
  { label: "@paint", anchor: "at-paint", uses: (u) => u.sheet.paints.length > 0 },
  { label: "element()", anchor: "fn-element", uses: fn("element") },
  { label: "light", anchor: "shape-light", uses: shape("light") },
  { label: "@property-panel", anchor: "at-property-panel", uses: (u) => u.sheet.panels.length > 0 },
  { label: "scroll()", anchor: "animation-timeline", uses: fn("scroll") },
  { label: "view()", anchor: "animation-timeline", uses: fn("view") },
  { label: "offset-path", anchor: "offset-path", uses: property("offset-path") },
  { label: "lathe", anchor: "shape-lathe", uses: shape("lathe") },
  { label: "path", anchor: "shape-path", uses: shape("path") },
  { label: "prism", anchor: "shape-prism", uses: shape("prism") },
  { label: "pyramid", anchor: "shape-pyramid", uses: shape("pyramid") },
  { label: "octahedron", anchor: "shape-octahedron", uses: shape("octahedron") },
  { label: "tube", anchor: "shape-tube", uses: shape("tube") },
  { label: "outline", anchor: "outline", uses: property("outline", "outline-width", "outline-style", "outline-color") },
  { label: ":active", anchor: "selector-active", uses: pseudo("active") },
  { label: ":hover", anchor: "selector-hover", uses: pseudo("hover") },
  { label: ":has()", anchor: "selector-has", uses: pseudo("has") },
  { label: "glass", anchor: "material", uses: material("glass", "ice") },
  { label: "jelly", anchor: "material", uses: material("jelly") },
  { label: "metal", anchor: "material", uses: material("metal", "gold", "chrome", "copper", "silver", "brass", "aluminum") },
  { label: "emissive", anchor: "material", uses: material("emissive") },
  { label: "iridescent", anchor: "material", uses: material("iridescent") },
  { label: "operation", anchor: "operation", uses: property("operation") },
  { label: "blend", anchor: "blend", uses: property("blend") },
  { label: "noise()", anchor: "fn-noise", uses: fn("noise") },
  { label: "displace()", anchor: "fn-displace", uses: fn("displace") },
  { label: "checker()", anchor: "fn-checker", uses: fn("checker") },
  { label: "stripes()", anchor: "fn-stripes", uses: fn("stripes") },
  {
    label: "gradients",
    anchor: "fn-gradients",
    uses: fn("linear-gradient", "radial-gradient", "conic-gradient", "repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient"),
  },
  { label: "texture", anchor: "texture", uses: (u) => u.images },
  { label: "::face()", anchor: "selector-face", uses: pseudo("face", "top", "bottom") },
  { label: "filter", anchor: "filter", uses: property("filter") },
  { label: "fog", anchor: "fog", uses: property("fog") },
  { label: "shadows", anchor: "shadows", uses: property("shadows") },
  { label: "mask-image", anchor: "mask-image", uses: property("mask-image") },
  { label: "opacity", anchor: "opacity", uses: property("opacity") },
  { label: "visibility", anchor: "visibility", uses: property("visibility") },
  { label: "cursor", anchor: "cursor", uses: property("cursor") },
  { label: "@property", anchor: "at-property", uses: (u) => u.sheet.properties.length > 0 },
  { label: "@media", anchor: "at-media", uses: (u) => u.sheet.rules.some((rule) => rule.media !== undefined) },
  { label: "sibling-index()", anchor: "fn-sibling-index", uses: fn("sibling-index", "sibling-count") },
  { label: "random()", anchor: "fn-random", uses: fn("random") },
  { label: ":nth-child()", anchor: "selector-nth-child", uses: pseudo("nth-child", "nth-last-child") },
  { label: "transition", anchor: "transition", uses: property("transition") },
  { label: "@keyframes", anchor: "at-keyframes", uses: (u) => u.sheet.keyframes.length > 0 },
  { label: "linear()", anchor: "fn-linear", uses: fn("linear") },
  { label: "steps()", anchor: "fn-steps", uses: fn("steps") },
  { label: "oklch()", anchor: "fn-oklab-oklch", uses: fn("oklch", "oklab") },
  { label: "color-mix()", anchor: "fn-color-mix", uses: fn("color-mix") },
  { label: "var()", anchor: "fn-var", uses: fn("var") },
];

export function featuresOf(code: string): Feature[] {
  const sheet = parse(tokenize(code));
  const usage: Usage = {
    shapes: new Set(),
    properties: new Set(),
    functions: new Set(),
    images: false,
    words: new Set(),
    pseudos: new Set(),
    sheet,
  };
  const walk = (elements: SceneElement[]) => {
    for (const element of elements) {
      usage.shapes.add(element.tag);
      walk(element.children ?? []);
    }
  };
  walk(sheet.scene);
  const values = (tokens: Token[]) =>
    tokens.forEach((token, i) => {
      if (token.type !== "IDENT") return;
      const next = tokens[i + 1];
      if (next?.type === "PUNCT" && next.value === "(") usage.functions.add(token.value);
      else usage.words.add(token.value);
    });
  const declarations = (list: Declaration[]) =>
    list.forEach((declaration) => {
      usage.properties.add(declaration.property);
      values(declaration.value);
      if (declaration.property === "texture" && declaration.value.some((token) => token.type === "IDENT" && token.value === "url")) {
        usage.images = true;
      }
    });
  for (const rule of sheet.rules) {
    declarations(rule.declarations);
    rule.selector.forEach((token, i) => {
      const before = rule.selector[i - 1];
      if (token.type === "IDENT" && before?.type === "PUNCT" && before.value === ":") usage.pseudos.add(token.value);
    });
  }
  for (const keyframes of sheet.keyframes) for (const frame of keyframes.frames) declarations(frame.declarations);
  return NOTABLE.filter((feature) => feature.uses(usage)).map(({ label, anchor }) => ({ label, anchor }));
}
