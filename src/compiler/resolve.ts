import type { Rule } from "./ast";
import { errorAt, spanOf } from "./errors";
import type { Token } from "./tokenizer";
import type { SceneInstance } from "./expand";

// The properties of an instance after the cascade: { translate: [...], color: [...] }
export type Styles = Record<string, Token[]>;

// An instance + its final styles
export type StyledInstance = SceneInstance & {
  styles: Styles;
  groupStyles: Styles[];
  faceStyles: Record<Face, Styles>; // what cube::top and cube::bottom set
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
};

// The faces a pseudo-element can style: cube::top, cube::bottom
export type Face = "top" | "bottom";
const FACES: Face[] = ["top", "bottom"];

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

// "#letters #S #left" → #left, with the ancestors #letters and #S.
// The tokenizer skips spaces, so we find them back with the positions of the tokens.
export function parseSelector(tokens: Token[]): SimpleSelector {
  const compounds: Token[][] = [[]];
  tokens.forEach((token, i) => {
    if (i > 0 && spaceBetween(tokens[i - 1], token)) compounds.push([]);
    compounds[compounds.length - 1].push(token);
  });
  const selectors = compounds.map(parseCompound);
  const selector = selectors[selectors.length - 1];
  if (selectors.length > 1) selector.ancestors = selectors.slice(0, -1);
  if (selector.ancestors?.some((ancestor) => ancestor.face !== undefined)) {
    throw errorAt(
      tokens,
      "::top and ::bottom go at the end of the selector, on the object",
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
      const name = tokens[i + 2];
      if (name?.type !== "IDENT" || !FACES.includes(name.value as Face)) {
        throw errorAt(
          tokens,
          "Unknown pseudo-element: a face is ::top or ::bottom",
        );
      }
      // Like CSS, a pseudo-element closes the selector: nothing after it
      if (i + 3 !== tokens.length) {
        throw errorAt(
          tokens,
          `::${name.value} goes at the end of the selector, like: cube.grass::${name.value}`,
        );
      }
      selector.face = name.value as Face;
      i += 3;
    } else {
      const text = tokens.map(tokenToText).join("");
      throw errorAt(tokens, `Selector not supported: "${text}"`);
    }
  }

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
    (selector.face ? 1 : 0);
  // like CSS, the ancestors add up: "#letters cube" beats "cube" and "#letters"
  const ancestors = selector.ancestors ?? [];
  return ancestors.reduce((sum, ancestor) => sum + specificity(ancestor), own);
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
  function cascade(instance: SceneInstance, face?: Face): Styles {
    const styles: Styles = {};
    for (const important of [false, true]) {
      for (const { rule, selector } of sortedRules) {
        if (!matches(selector, instance)) continue;
        if (selector.face !== face) continue; // a face rule styles its face, the other rules the object
        for (const declaration of rule.declarations) {
          if (
            selector.face !== undefined &&
            declaration.property !== "texture"
          ) {
            throw errorAt(
              declaration,
              `::${selector.face} only takes texture, like: cube::${selector.face} { texture: url("top.png"); }`,
            );
          }
          if ((declaration.important ?? false) !== important) continue;
          styles[declaration.property] = declaration.value; // the next rule overwrites the previous one
        }
      }
    }
    return styles;
  }

  return instances.map((instance) => ({
    ...instance,
    styles: cascade(instance),
    groupStyles: instance.groups.map((group) => cascade(group)),
    faceStyles: {
      top: cascade(instance, "top"),
      bottom: cascade(instance, "bottom"),
    },
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
