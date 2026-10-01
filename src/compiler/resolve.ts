import type { Rule } from "./ast";
import { errorAt, spanOf } from "./errors";
import { closingParen } from "./calc";
import type { Token } from "./tokenizer";
import type { SceneInstance } from "./expand";

// The properties of an instance after the cascade: { translate: [...], color: [...] }
export type Styles = Record<string, Token[]>;

// An instance + its final styles
export type StyledInstance = SceneInstance & {
  styles: Styles;
  groupStyles: Styles[];
  faceStyles: Record<Face, Styles>; // what cube::face(front), cube::top… set
  hoverTriggers: number[]; // the objects that, hovered, put this one in its hover state
  hoverStyles: Styles;
};

// A simple selector: cube, .corner, #hero, or a combination like cube#left.corner
export type SimpleSelector = {
  tag: string | null;
  id: string | null;
  classes: string[];
  // The descendant combinator: in "#letters #S #left", the selector is #left and
  // its ancestors are [#letters, #S], from the outermost to the innermost
  ancestors?: SimpleSelector[];
  face?: Face;
  hover?: boolean; // cube:hover, #g:hover
  has?: SimpleSelector[]; // #g:has(sphere, cube:hover): something inside matches one of them
};

// The faces a pseudo-element can style, in the object's space: cube::face(front).
// top is +y, bottom -y, front +z, back -z, right +x, left -x (decision 59)
export type Face = "top" | "bottom" | "front" | "back" | "left" | "right";
export const FACES: Face[] = [
  "top",
  "bottom",
  "front",
  "back",
  "left",
  "right",
];
// ::top is ::face(top): the faces a Minecraft-style block changes most
const SHORTCUTS: Face[] = ["top", "bottom"];

// The objects that must be hovered for this selector to match this instance
function triggersOf(
  selector: SimpleSelector,
  instance: SceneInstance,
  instances: SceneInstance[],
): number[] {
  let triggers = instances; // everything, then each :hover narrows it down
  if (selector.hover) {
    triggers = triggers.filter((other) => other === instance); // only the object itself
  }
  for (const ancestor of selector.ancestors ?? []) {
    if (!ancestor.hover) continue;
    // the groups of this object that match "#g"
    const groups = instance.groups.filter((group) =>
      matchesCompound(ancestor, group),
    );
    // the objects inside one of these groups
    triggers = triggers.filter((other) =>
      other.groups.some((group) => groups.includes(group)),
    );
  }
  return triggers.map((other) => other.index);
}

// How a face is written, for the messages: ::top, ::face(front)
export function faceSelector(face: Face): string {
  return SHORTCUTS.includes(face) ? `::${face}` : `::face(${face})`;
}

const FACES_HELP =
  "a face is ::face(top), ::face(bottom), ::face(front), ::face(back), ::face(left) or ::face(right); ::top and ::bottom are shortcuts";

// Was there a space (or a comment) between these two tokens in the source?
function spaceBetween(before: Token, after: Token): boolean {
  const a = spanOf(before);
  const b = spanOf(after);
  return a !== undefined && b !== undefined && a.end < b.start;
}

function tokenToText(token: Token): string {
  if (token.type === "HASH") return `#${token.value}`;
  if (token.type === "AT_KEYWORD") return `@${token.value}`;
  if (token.type === "DIMENSION") return `${token.value}${token.unit}`;
  if (token.type === "PERCENTAGE") return `${token.value}%`;
  if (token.type === "STRING") return JSON.stringify(token.value);
  return String(token.value);
}

// "sphere, #a cube:hover" → [sphere] and [#a cube:hover]; a comma inside ( ) stays
function splitAtCommas(tokens: Token[]): Token[][] {
  if (tokens.length === 0) return [];
  const parts: Token[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (token.type === "PUNCT" && token.value === "(") depth++;
    if (token.type === "PUNCT" && token.value === ")") depth--;
    if (depth === 0 && token.type === "PUNCT" && token.value === ",")
      parts.push([]);
    else parts[parts.length - 1].push(token);
  }
  return parts;
}

// "#letters #S #left" → #left, with the ancestors #letters and #S.
// The tokenizer skips spaces, so we find them back with the positions of the tokens.
export function parseSelector(tokens: Token[]): SimpleSelector {
  const compounds: Token[][] = [[]];
  let depth = 0; // inside :has( … ), a space belongs to the selector in it
  tokens.forEach((token, i) => {
    if (depth === 0 && i > 0 && spaceBetween(tokens[i - 1], token))
      compounds.push([]);
    compounds[compounds.length - 1].push(token);
    if (token.type === "PUNCT" && token.value === "(") depth++;
    if (token.type === "PUNCT" && token.value === ")") depth--;
  });
  const selectors = compounds.map(parseCompound);
  const selector = selectors[selectors.length - 1];
  if (selectors.length > 1) selector.ancestors = selectors.slice(0, -1);
  if (selector.ancestors?.some((ancestor) => ancestor.face !== undefined)) {
    throw errorAt(
      tokens,
      "A face goes at the end of the selector, on the object: cube.grass::top, not #g::top cube",
    );
  }
  return selector;
}

// One compound selector, with no space inside: cube#left.corner
function parseCompound(tokens: Token[]): SimpleSelector {
  const selector: SimpleSelector = { tag: null, id: null, classes: [] };
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    const next = tokens[i + 1];

    if (i === 0 && token.type === "PUNCT" && token.value === "*") {
      i++; // * targets every object: the selector keeps tag, id and classes empty
    } else if (i === 0 && token.type === "IDENT") {
      selector.tag = token.value;
      i++;
    } else if (token.type === "HASH") {
      if (selector.id !== null) {
        throw errorAt(
          token,
          `An object has only one id: "#${selector.id}#${token.value}" can never match. For a descendant, add a space: "#${selector.id} #${token.value}"`,
        );
      }
      selector.id = token.value;
      i++;
    } else if (
      token.type === "PUNCT" &&
      token.value === "." &&
      next?.type === "IDENT"
    ) {
      selector.classes.push(next.value);
      i += 2;
    } else if (
      token.type === "PUNCT" &&
      token.value === ":" &&
      next?.type === "PUNCT" &&
      next.value === ":"
    ) {
      // ::face(front), like ::part(name) in CSS, or a shortcut: ::top, ::bottom
      const name = tokens[i + 2];
      const open = tokens[i + 3];
      let face: string | undefined;
      let length: number; // how many tokens the pseudo-element takes
      if (
        name?.type === "IDENT" &&
        name.value === "face" &&
        open?.type === "PUNCT" &&
        open.value === "("
      ) {
        const inside = tokens[i + 4];
        const close = tokens[i + 5];
        if (
          inside?.type === "IDENT" &&
          close?.type === "PUNCT" &&
          close.value === ")"
        )
          face = inside.value;
        length = 6;
      } else {
        if (name?.type === "IDENT") face = name.value;
        length = 3;
      }
      const known =
        face !== undefined &&
        (length === 6 ? FACES : SHORTCUTS).includes(face as Face);
      if (!known) {
        throw errorAt(tokens, `Unknown pseudo-element: ${FACES_HELP}`);
      }
      // Like CSS, a pseudo-element closes the selector: nothing after it
      if (i + length !== tokens.length) {
        const written = faceSelector(face as Face);
        throw errorAt(
          tokens,
          `${written} goes at the end of the selector, like: cube.grass${written}`,
        );
      }
      selector.face = face as Face;
      i += length;
    } else if (token.type === "PUNCT" && token.value === ":") {
      // :hover, a pseudo-class: like a class, it can go anywhere after the tag
      if (next?.type === "IDENT" && next.value === "hover") {
        selector.hover = true;
        i += 2;
      } else if (next?.type === "IDENT" && next.value === "has") {
        // :has(…), like CSS: the selectors between the parentheses, split at the commas
        if (selector.has)
          throw errorAt(
            tokens,
            "A part of a selector takes one :has(), with a list inside if needed: #g:has(sphere, cube)",
          );
        const close = closingParen(tokens, i + 2);
        const parts = splitAtCommas(tokens.slice(i + 3, close));
        if (parts.length === 0)
          throw errorAt(
            tokens,
            ":has() needs a selector, like: #g:has(sphere:hover) cube",
          );
        selector.has = parts.map((part) => parseSelector(part));
        const nested = (inner: SimpleSelector) =>
          inner.has !== undefined ||
          (inner.ancestors ?? []).some((a) => a.has !== undefined);
        if (selector.has.some(nested))
          throw errorAt(tokens, "A :has() cannot hold another :has()");
        i = close + 1;
      } else {
        const name = next?.type === "IDENT" ? `:${next.value}` : ":";
        throw errorAt(
          tokens,
          `Unknown pseudo-class "${name}": GSS knows :hover and :has()`,
        );
      }
    } else {
      const text = tokens.map(tokenToText).join("");
      throw errorAt(tokens, `Selector not supported: "${text}"`);
    }
  }

  // An object holds nothing: :has() matches a group, written group or #g / .g
  if (selector.has && selector.tag !== null && selector.tag !== "group")
    throw errorAt(
      tokens,
      ":has() goes on a group: an object holds nothing, like: #g:has(sphere:hover) cube",
    );

  return selector;
}

// Does this selector target this instance?
export function matches(
  selector: SimpleSelector,
  instance: SceneInstance,
): boolean {
  if (!matchesCompound(selector, instance)) return false;

  // The ancestors, read from right to left like a browser does: each one must be
  // one of the instance's groups, further out than the previous one
  const ancestors = selector.ancestors ?? [];
  let g = instance.groups.length - 1; // the innermost group first
  for (let a = ancestors.length - 1; a >= 0; a--) {
    while (g >= 0 && !matchesCompound(ancestors[a], instance.groups[g])) g--;
    if (g < 0) return false; // no group left for this ancestor
    g--; // the next ancestor must be further out
  }
  return true;
}

// The instance itself, without looking at its groups
function matchesCompound(
  selector: SimpleSelector,
  instance: SceneInstance,
): boolean {
  if (selector.tag !== null && selector.tag !== instance.tag) return false;
  if (selector.id !== null && selector.id !== instance.id) return false;
  return selector.classes.every((className) =>
    instance.classes.includes(className),
  );
}

// ⬇️ TA MISSION : return a number as big as the selector is specific
export function specificity(selector: SimpleSelector): number {
  const own =
    (selector.id ? 10_000 : 0) +
    selector.classes.length * 100 +
    (selector.tag ? 1 : 0) +
    (selector.face ? 1 : 0) +
    (selector.hover ? 100 : 0) + // a pseudo-class counts like a class, like CSS
    // :has() weighs like its most specific selector, like CSS
    Math.max(0, ...(selector.has ?? []).map((inner) => specificity(inner)));
  // like CSS, the ancestors add up: "#letters cube" beats "cube" and "#letters"
  const ancestors = selector.ancestors ?? [];
  return ancestors.reduce((sum, ancestor) => sum + specificity(ancestor), own);
}

// Does this selector need a hovered object? cube:hover, #g:hover cube,
// or #g:has(sphere:hover) cube
export function needsHover(selector: SimpleSelector): boolean {
  return [selector, ...(selector.ancestors ?? [])].some(
    (part) =>
      part.hover === true || (part.has ?? []).some((inner) => needsHover(inner)),
  );
}

export function resolveStyles(
  instances: SceneInstance[],
  rules: Rule[],
): StyledInstance[] {
  // We sort the rules from the least specific to the most specific.
  // At equal specificity, the file order decides: the last one wins.
  const sortedRules = rules
    .map((rule, order) => ({
      rule,
      selector: parseSelector(rule.selector),
      order,
    }))
    .sort(
      (a, b) =>
        specificity(a.selector) - specificity(b.selector) || a.order - b.order,
    );
  // The cascade for one instance (an object or a group), or for one face of an object
  function cascade(
    instance: SceneInstance,
    face?: Face,
    hovered = false,
  ): Styles {
    const styles: Styles = {};
    for (const important of [false, true]) {
      for (const { rule, selector } of sortedRules) {
        if (!matches(selector, instance)) continue;
        if (needsHover(selector) && !hovered) continue;
        if (selector.face !== face) continue; // a face rule styles its face, the other rules the object
        for (const declaration of rule.declarations) {
          if (
            selector.face !== undefined &&
            declaration.property !== "texture"
          ) {
            throw errorAt(
              declaration,
              `${faceSelector(selector.face)} only takes texture, like: cube${faceSelector(selector.face)} { texture: url("${selector.face}.png"); }`,
            );
          }
          if ((declaration.important ?? false) !== important) continue;
          styles[declaration.property] = declaration.value; // the next rule overwrites the previous one
        }
      }
    }
    return styles;
  }

  // Every group of the scene, once: a Set keeps each group only once
  const groups = [...new Set(instances.flatMap((instance) => instance.groups))];
  for (const { rule, selector } of sortedRules) {
    if (!needsHover(selector)) continue;
    const stylesGroups = groups.some((group) => matches(selector, group));
    const stylesObjects = instances.some((instance) =>
      matches(selector, instance),
    );
    if (stylesGroups && !stylesObjects) {
      throw errorAt(
        rule.selector,
        "A :hover rule cannot style a group yet: style its objects, like #g:hover cube",
      );
    }
  }

  return instances.map((instance) => ({
    ...instance,
    styles: cascade(instance),
    groupStyles: instance.groups.map((group) => cascade(group)),
    faceStyles: Object.fromEntries(
      FACES.map((face) => [face, cascade(instance, face)]),
    ) as Record<Face, Styles>,
    hoverTriggers: [
      ...new Set(
        sortedRules
          .filter(
            ({ selector }) =>
              needsHover(selector) && matches(selector, instance),
          )
          .flatMap(({ selector }) => triggersOf(selector, instance, instances)),
      ),
    ].sort((a, b) => a - b),
    hoverStyles: cascade(instance, undefined, true),
  }));
}

export function isSceneSelector(selector: SimpleSelector): boolean {
  return (
    selector.tag === "scene" &&
    selector.id === null &&
    selector.classes.length === 0 &&
    selector.ancestors === undefined
  );
}

// The styles of the scene itself: scene { floor: ...; background: ...; }
export function resolveSceneStyles(rules: Rule[]): Styles {
  const styles: Styles = {};
  for (const rule of rules) {
    const selector = parseSelector(rule.selector);
    if (isSceneSelector(selector)) {
      for (const declaration of rule.declarations) {
        styles[declaration.property] = declaration.value;
      }
    }
  }
  return styles;
}
