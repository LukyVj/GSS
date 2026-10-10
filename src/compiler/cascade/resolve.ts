import type { Rule } from "../syntax/ast";
import { errorAt } from "../syntax/errors";
import { ANIMATION_LONGHANDS } from "../features/animation";
import { spaceBetween } from "../syntax/nesting";
import { closingParen } from "../values/calc";
import type { Token } from "../syntax/tokenizer";
import { sceneNodes, type SceneInstance } from "./expand";

type Combinator = " " | ">" | "+" | "~";

// The properties of an instance after the cascade: { translate: [...], color: [...] }
export type Styles = Record<string, Token[]>;

// An instance + its final styles
export type StyledInstance = SceneInstance & {
  styles: Styles;
  groupStyles: Styles[];
  faceStyles: Record<Face, Styles>; // what cube::face(front), cube::top… set
  hoverTriggers: number[]; // the objects that, hovered, put this one in its hover state
  hoverStyles: Styles;
  activeTriggers: number[]; // the objects that, pressed, put this one in its active state
  activeStyles: Styles; // pressed: the :active rules on top of the :hover ones
  // Whether the :hover rules, then the :active ones, write an animation of their own:
  // the state starts it (decision 141)
  starts: { hover: boolean; active: boolean };
};

// The states the pointer gives: :hover (under the pointer) and :active (pressed)
type PointerState = "hover" | "active";

// A simple selector: cube, .corner, #hero, or a combination like cube#left.corner
export type SimpleSelector = {
  tag: string | null;
  id: string | null;
  classes: string[];
  // The preceding compounds, from left to right (historically called ancestors).
  // combinators[i] joins ancestors[i] to the next compound; absent means spaces.
  ancestors?: SimpleSelector[];
  combinators?: Combinator[];
  relative?: Combinator; // a leading combinator, only inside :has()
  face?: Face;
  hover?: boolean; // cube:hover, #g:hover
  active?: boolean; // cube:active, #g:active: pressed (decision 95)
  has?: SimpleSelector[]; // #g:has(sphere, cube:hover): something inside matches one of them
  structural?: Structural[]; // :nth-child(odd), :first-of-type…: all of them must match
  not?: SimpleSelector[][]; // :not(.a, cube):not(#b): no selector of any list may match
};

// :nth-child(An+B of S) and its family, read at compile time (decision 92).
// The position counts from 1 among the siblings, the copies of a * n one by one,
// like sibling-index(): of the same shape for *-of-type, from the end for nth-last-*.
export type Structural = {
  ofType: boolean;
  last: boolean;
  a: number;
  b: number;
  of?: SimpleSelector[]; // :nth-child(2 of .red): only the siblings that match count
  only?: boolean; // :only-child, :only-of-type: the one sibling that counts
};

const NTH: Record<string, Pick<Structural, "ofType" | "last">> = {
  "nth-child": { ofType: false, last: false },
  "nth-last-child": { ofType: false, last: true },
  "nth-of-type": { ofType: true, last: false },
  "nth-last-of-type": { ofType: true, last: true },
};
// The shortcuts, like CSS: :first-child is :nth-child(1), :only-child is first and last
const at1 = (ofType: boolean, last: boolean, only = false): Structural => ({
  ofType,
  last,
  a: 0,
  b: 1,
  ...(only ? { only } : {}),
});
const SHORTHANDS: Record<string, Structural> = {
  "first-child": at1(false, false),
  "last-child": at1(false, true),
  "only-child": at1(false, false, true),
  "first-of-type": at1(true, false),
  "last-of-type": at1(true, true),
  "only-of-type": at1(true, false, true),
};
const PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":has()",
  ":not()",
  ...Object.keys(NTH).map((name) => `:${name}()`),
  ...Object.keys(SHORTHANDS).map((name) => `:${name}`),
];

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

// A hover trigger must satisfy every part of one complete matching path.
// Alternative paths are a union; multiple :hover conditions on a path intersect.
function triggersOf(
  selector: SimpleSelector,
  node: SceneInstance,
  scene: SceneInstance[],
  anchor?: SceneInstance,
  state: PointerState = "hover",
): SceneInstance[] {
  const parts = [...(selector.ancestors ?? []), selector];
  const found = new Set<SceneInstance>();
  for (const path of matchingPaths(selector, node, scene, anchor)) {
    let triggers = scene;
    parts.forEach((part, i) => {
      const matched = path[i];
      if (part[state]) {
        const allowed = hoveredBy(matched, scene);
        triggers = triggers.filter((other) => allowed.includes(other));
      }
      if (part.has?.some((inner) => needs(inner, state))) {
        const allowed = hasTriggers(part.has, matched, scene, state);
        if (allowed !== null)
          triggers = triggers.filter((other) => allowed.includes(other));
      }
    });
    triggers.forEach((other) => found.add(other));
  }
  return [...found];
}

// Hovering (or pressing) a group means hovering one of its drawable objects (a light
// inside it is never drawn, decision 110).
function hoveredBy(
  node: SceneInstance,
  scene: SceneInstance[],
): SceneInstance[] {
  return node.tag === "group"
    ? scene.filter((object) => object.groups.includes(node) && object.tag !== "light")
    : [node];
}

// null: one alternative matches without the mouse, so it imposes no constraint.
function hasTriggers(
  list: SimpleSelector[],
  anchor: SceneInstance,
  scene: SceneInstance[],
  state: PointerState,
): SceneInstance[] | null {
  const found: SceneInstance[] = [];
  for (const inner of list) {
    for (const node of sceneNodes(scene)) {
      if (!matches(inner, node, scene, anchor)) continue;
      if (!needs(inner, state)) return null;
      found.push(...triggersOf(inner, node, scene, anchor, state));
    }
  }
  return found;
}

// How a face is written, for the messages: ::top, ::face(front)
export function faceSelector(face: Face): string {
  return SHORTCUTS.includes(face) ? `::${face}` : `::face(${face})`;
}

const FACES_HELP =
  "a face is ::face(top), ::face(bottom), ::face(front), ::face(back), ::face(left) or ::face(right); ::top and ::bottom are shortcuts";

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

// An+B, like CSS: odd, even, 3, n, -n+3, 2n + 1. The spaces only go around the sign of B.
function parseAnB(tokens: Token[], where: Token[], name: string): [number, number] {
  const text = tokens
    .map(
      (token, i) =>
        (i > 0 && spaceBetween(tokens[i - 1], token) ? " " : "") +
        tokenToText(token),
    )
    .join("")
    .toLowerCase();
  if (text === "odd") return [2, 1];
  if (text === "even") return [2, 0];
  if (/^[+-]?\d+$/.test(text)) return [0, parseInt(text, 10)];
  const formula = /^([+-]?)(\d*)n(?:\s*([+-])\s*(\d+))?$/.exec(text);
  if (!formula)
    throw errorAt(
      where,
      `:${name}() takes An+B, like :${name}(2n+1), :${name}(odd), :${name}(even) or :${name}(3)`,
    );
  const [, sign, digits, bSign, bDigits] = formula;
  const a = (sign === "-" ? -1 : 1) * (digits === "" ? 1 : parseInt(digits, 10));
  const b = bDigits === undefined ? 0 : (bSign === "-" ? -1 : 1) * parseInt(bDigits, 10);
  return [a, b];
}

// "#letters #S #left" → #left, with the ancestors #letters and #S.
// The tokenizer skips spaces, so we find them back with the positions of the tokens.
export function parseSelector(
  tokens: Token[],
  relative = false,
): SimpleSelector {
  const compounds: Token[][] = [[]];
  const combinators: Combinator[] = [];
  let leading: Combinator | undefined;
  let depth = 0;
  tokens.forEach((token, i) => {
    const current = compounds[compounds.length - 1];
    const explicit =
      depth === 0 &&
      token.type === "PUNCT" &&
      [">", "+", "~"].includes(token.value);
    if (explicit) {
      const combinator = token.value as Combinator;
      if (current.length === 0) {
        if (i === 0 && relative) leading = combinator;
        else
          throw errorAt(
            token,
            "A combinator needs a selector on both sides (a leading combinator is only allowed in :has())",
          );
      } else {
        combinators.push(combinator);
        compounds.push([]);
      }
      return;
    }
    if (
      depth === 0 &&
      current.length > 0 &&
      i > 0 &&
      spaceBetween(tokens[i - 1], token)
    ) {
      combinators.push(" ");
      compounds.push([]);
    }
    compounds[compounds.length - 1].push(token);
    if (token.type === "PUNCT" && token.value === "(") depth++;
    if (token.type === "PUNCT" && token.value === ")") depth--;
  });
  if (compounds.some((part) => part.length === 0))
    throw errorAt(tokens, "A selector is required after a combinator or comma");
  const selectors = compounds.map(parseCompound);
  const selector = selectors[selectors.length - 1];
  if (selectors.length > 1) {
    selector.ancestors = selectors.slice(0, -1);
    selector.combinators = combinators;
  }
  if (leading) selector.relative = leading;
  if (selector.ancestors?.some((part) => part.face !== undefined)) {
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
      } else if (next?.type === "IDENT" && next.value === "active") {
        selector.active = true;
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
        selector.has = parts.map((part) => parseSelector(part, true));
        const holdsHas = (part: SimpleSelector): boolean =>
          part.has !== undefined ||
          (part.not ?? []).some((list) => list.some(nested));
        const nested = (inner: SimpleSelector): boolean =>
          [inner, ...(inner.ancestors ?? [])].some(holdsHas);
        if (selector.has.some(nested))
          throw errorAt(tokens, "A :has() cannot hold another :has()");
        i = close + 1;
      } else if (next?.type === "IDENT" && next.value === "not") {
        // :not(…), like CSS: a list of selectors, none of which may match (decision 93)
        const close = closingParen(tokens, i + 2);
        const parts = splitAtCommas(tokens.slice(i + 3, close));
        if (parts.length === 0)
          throw errorAt(tokens, ":not() needs a selector, like: cube:not(.red)");
        const list = parts.map((part) => parseSelector(part));
        if (list.some(needsPointer))
          throw errorAt(
            tokens,
            ":not() cannot hold :hover or :active yet: write the rule for the hovered state, and its opposite without :hover",
          );
        if (list.some((inner) => inner.face !== undefined))
          throw errorAt(
            tokens,
            ":not() takes selectors of objects, not a face: cube:not(.grass)::top",
          );
        selector.not = [...(selector.not ?? []), list];
        i = close + 1;
      } else if (next?.type === "IDENT" && next.value in NTH) {
        // :nth-child(An+B [of S]), like CSS
        const name = next.value;
        const open = tokens[i + 2];
        if (open?.type !== "PUNCT" || open.value !== "(")
          throw errorAt(tokens, `:${name}() needs An+B, like :${name}(odd)`);
        const close = closingParen(tokens, i + 2);
        const inside = tokens.slice(i + 3, close);
        const at = inside.findIndex(
          (token) => token.type === "IDENT" && token.value === "of",
        );
        const formula = at === -1 ? inside : inside.slice(0, at);
        const [a, b] = parseAnB(formula, tokens, name);
        const structural: Structural = { ...NTH[name], a, b };
        if (at !== -1) {
          if (structural.ofType)
            throw errorAt(
              tokens,
              `:${name}() counts the siblings of the same shape: it takes no "of", only :nth-child() and :nth-last-child() do`,
            );
          const parts = splitAtCommas(inside.slice(at + 1));
          if (parts.length === 0)
            throw errorAt(
              tokens,
              `"of" needs a selector, like :${name}(2 of .red)`,
            );
          structural.of = parts.map((part) => parseSelector(part));
          if (structural.of.some(needsPointer))
            throw errorAt(
              tokens,
              `:${name}(… of S) cannot hold :hover or :active yet: the order of the objects is read once, when the scene is compiled`,
            );
        }
        selector.structural = [...(selector.structural ?? []), structural];
        i = close + 1;
      } else if (next?.type === "IDENT" && next.value in SHORTHANDS) {
        const open = tokens[i + 2];
        if (open?.type === "PUNCT" && open.value === "(")
          throw errorAt(
            tokens,
            `:${next.value} takes no argument; for a position, use :nth-child(3)`,
          );
        selector.structural = [
          ...(selector.structural ?? []),
          SHORTHANDS[next.value],
        ];
        i += 2;
      } else {
        const name = next?.type === "IDENT" ? `:${next.value}` : ":";
        throw errorAt(
          tokens,
          `Unknown pseudo-class "${name}": GSS knows ${PSEUDO_CLASSES.slice(0, -1).join(", ")} and ${PSEUDO_CLASSES[PSEUDO_CLASSES.length - 1]}`,
        );
      }
    } else {
      const text = tokens.map(tokenToText).join("");
      throw errorAt(tokens, `Selector not supported: "${text}"`);
    }
  }

  // An object holds nothing, but can look for following siblings with :has().
  if (
    selector.has &&
    selector.tag !== null &&
    selector.tag !== "group" &&
    !selector.has.some(
      (inner) => inner.relative === "+" || inner.relative === "~",
    )
  )
    throw errorAt(
      tokens,
      ":has() goes on a group for descendants: an object holds nothing. Use #g:has(sphere:hover) cube, or cube:has(+ sphere) for a sibling.",
    );

  return selector;
}

// Read every chain from right to left. Backtracking matters for mixed chains:
// an earlier ancestor/sibling can succeed even when the nearest one fails.
function* matchingPaths(
  selector: SimpleSelector,
  node: SceneInstance,
  scene: SceneInstance[],
  anchor?: SceneInstance,
): Generator<SceneInstance[]> {
  const parts = [...(selector.ancestors ?? []), selector];
  function* visit(
    at: number,
    current: SceneInstance,
  ): Generator<SceneInstance[]> {
    if (!matchesCompound(parts[at], current, scene)) return;
    if (at === 0) {
      if (!anchor || related(anchor, current, selector.relative ?? " "))
        yield [current];
      return;
    }
    const combinator = selector.combinators?.[at - 1] ?? " ";
    const candidates =
      combinator === " " || combinator === ">"
        ? current.groups.slice().reverse()
        : sceneNodes(scene);
    for (const previous of candidates) {
      if (!related(previous, current, combinator)) continue;
      for (const path of visit(at - 1, previous)) yield [...path, current];
    }
  }
  yield* visit(parts.length - 1, node);
}

function related(
  left: SceneInstance,
  right: SceneInstance,
  combinator: Combinator,
): boolean {
  if (combinator === " ") return right.groups.includes(left);
  const parent = (node: SceneInstance) => node.groups[node.groups.length - 1];
  if (combinator === ">") return parent(right) === left;
  if (parent(left) !== parent(right)) return false;
  return combinator === "+"
    ? left.siblingIndex + 1 === right.siblingIndex
    : left.siblingIndex < right.siblingIndex;
}

export function matches(
  selector: SimpleSelector,
  instance: SceneInstance,
  scene: SceneInstance[],
  anchor?: SceneInstance,
): boolean {
  return !matchingPaths(selector, instance, scene, anchor).next().done;
}

// The instance itself, without looking at its groups
function matchesCompound(
  selector: SimpleSelector,
  instance: SceneInstance,
  scene: SceneInstance[],
): boolean {
  if (selector.tag !== null && selector.tag !== instance.tag) return false;
  if (selector.id !== null && selector.id !== instance.id) return false;
  if (
    !selector.classes.every((className) => instance.classes.includes(className))
  )
    return false;
  if (
    selector.structural &&
    !selector.structural.every((s) => matchesPosition(s, instance, scene))
  )
    return false;
  if (
    selector.not?.some((list) =>
      list.some((inner) => matches(inner, instance, scene)),
    )
  )
    return false;
  if (!selector.has) return true;
  return selector.has.some((inner) =>
    sceneNodes(scene).some((node) => matches(inner, node, scene, instance)),
  );
}

// Is the instance at a position An+B among its siblings (the ones that count)?
function matchesPosition(
  structural: Structural,
  instance: SceneInstance,
  scene: SceneInstance[],
): boolean {
  const { of } = structural;
  if (of && !of.some((inner) => matches(inner, instance, scene))) return false;
  const parent = instance.groups[instance.groups.length - 1];
  const counted = sceneNodes(scene)
    .filter(
      (node) =>
        node.groups[node.groups.length - 1] === parent &&
        (!structural.ofType || node.tag === instance.tag) &&
        (!of || of.some((inner) => matches(inner, node, scene))),
    )
    .sort((x, y) => x.siblingIndex - y.siblingIndex);
  const at = counted.indexOf(instance);
  if (structural.only) return counted.length === 1;
  const position = structural.last ? counted.length - at : at + 1;
  const { a, b } = structural;
  if (a === 0) return position === b;
  const n = (position - b) / a;
  return n >= 0 && Number.isInteger(n);
}

// ⬇️ TA MISSION : return a number as big as the selector is specific
export function specificity(selector: SimpleSelector): number {
  const own =
    (selector.id ? 10_000 : 0) +
    selector.classes.length * 100 +
    (selector.tag ? 1 : 0) +
    (selector.face ? 1 : 0) +
    (selector.hover ? 100 : 0) + // a pseudo-class counts like a class, like CSS
    (selector.active ? 100 : 0) +
    // each :not() weighs like its most specific selector, like CSS
    (selector.not ?? []).reduce(
      (sum, list) =>
        sum + Math.max(0, ...list.map((inner) => specificity(inner))),
      0,
    ) +
    // :nth-child(… of S) adds its most specific selector, like CSS
    (selector.structural ?? []).reduce(
      (sum, s) =>
        sum + 100 + Math.max(0, ...(s.of ?? []).map((inner) => specificity(inner))),
      0,
    ) +
    // :has() weighs like its most specific selector, like CSS
    Math.max(0, ...(selector.has ?? []).map((inner) => specificity(inner)));
  // Like CSS, preceding compounds add up: "#letters cube" beats "cube" and "#letters"
  const ancestors = selector.ancestors ?? [];
  return ancestors.reduce((sum, ancestor) => sum + specificity(ancestor), own);
}

// Does this selector need a hovered object? cube:hover, #g:hover cube,
// or #g:has(sphere:hover) cube
export function needsHover(selector: SimpleSelector): boolean {
  return needs(selector, "hover");
}

// Does it need a pressed object? cube:active, #g:active cube, #g:has(sphere:active) cube
export function needsActive(selector: SimpleSelector): boolean {
  return needs(selector, "active");
}

// Does it depend on the pointer at all: :hover or :active?
export function needsPointer(selector: SimpleSelector): boolean {
  return needsHover(selector) || needsActive(selector);
}

function needs(selector: SimpleSelector, state: PointerState): boolean {
  return [selector, ...(selector.ancestors ?? [])].some(
    (part) =>
      part[state] === true ||
      (part.has ?? []).some((inner) => needs(inner, state)),
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
  // The cascade for one instance (an object or a group), or for one face of an object.
  // state: at rest, hovered, or pressed (the :hover rules still apply when pressed)
  function cascade(
    instance: SceneInstance,
    face?: Face,
    state: "rest" | PointerState = "rest",
  ): Styles {
    const styles: Styles = {};
    for (const important of [false, true]) {
      for (const { rule, selector } of sortedRules) {
        if (!matches(selector, instance, instances)) continue;
        if (needsHover(selector) && state === "rest") continue;
        if (needsActive(selector) && state !== "active") continue;
        if (selector.face !== face) continue; // a face rule styles its face, the other rules the object
        for (const declaration of rule.declarations) {
          if (
            selector.face !== undefined &&
            declaration.property !== "texture" &&
            declaration.property !== "content"
          ) {
            throw errorAt(
              declaration,
              `${faceSelector(selector.face)} only takes texture and content, like: cube${faceSelector(selector.face)} { texture: url("${selector.face}.png"); }`,
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
    if (!needsPointer(selector)) continue;
    const stylesGroups = groups.some((group) =>
      matches(selector, group, instances),
    );
    const stylesObjects = instances.some((instance) =>
      matches(selector, instance, instances),
    );
    if (stylesGroups && !stylesObjects) {
      const name = needsHover(selector) ? ":hover" : ":active";
      throw errorAt(
        rule.selector,
        `A ${name} rule cannot style a group yet: style its objects, like #g${name} cube`,
      );
    }
  }

  return instances.map((instance) => {
    const styles = cascade(instance);
    const hoverStyles = cascade(instance, undefined, "hover");
    const activeStyles = cascade(instance, undefined, "active");
    // A state writes its own animation when one of its rules sets it: the declaration
    // is then another one than the state below (the same rule gives the same value)
    const writes = (above: Styles, below: Styles) =>
      ["animation", ...ANIMATION_LONGHANDS].some((property) => above[property] !== below[property]);
    return {
    ...instance,
    styles,
    groupStyles: instance.groups.map((group) => cascade(group)),
    faceStyles: Object.fromEntries(
      FACES.map((face) => [face, cascade(instance, face)]),
    ) as Record<Face, Styles>,
    hoverTriggers: [
      ...new Set(
        sortedRules
          .filter(
            ({ selector }) =>
              needsHover(selector) &&
              !needsActive(selector) && // cube:hover:active waits for the press
              matches(selector, instance, instances),
          )
          .flatMap(({ rule, selector }) => drawn(rule, triggersOf(selector, instance, instances)))
          .map((other) => other.index),
      ),
    ].sort((a, b) => a - b),
    hoverStyles,
    activeTriggers: [
      ...new Set(
        sortedRules
          .filter(
            ({ selector }) =>
              needsActive(selector) && matches(selector, instance, instances),
          )
          .flatMap(({ rule, selector }) =>
            drawn(rule, triggersOf(selector, instance, instances, undefined, "active")),
          )
          .map((other) => other.index),
      ),
    ].sort((a, b) => a - b),
    activeStyles,
    starts: { hover: writes(hoverStyles, styles), active: writes(activeStyles, hoverStyles) },
    };
  });
}

// The objects a rule waits for: a light is never drawn, so it can be neither hovered nor
// pressed (decision 110)
function drawn(rule: Rule, triggers: SceneInstance[]): SceneInstance[] {
  if (triggers.some((other) => other.tag === "light"))
    throw errorAt(
      rule.selector,
      "A light is never drawn: it cannot be hovered or pressed. Hover an object instead, like #lamp:hover light",
    );
  return triggers;
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
