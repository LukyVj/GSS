import type { Token } from "./tokenizer";
import type {
  Stylesheet,
  SceneElement,
  Rule,
  Declaration,
  Keyframes,
  Keyframe,
} from "./ast";
import { errorAt, rememberSpan, spanAcross, spanOf } from "./errors";

export function parse(tokens: Token[]): Stylesheet {
  let pos = 0; // our position in the list of tokens

  // Looks at the current token, without advancing
  const peek = (): Token | undefined => tokens[pos];

  // Takes the current token and advances
  const next = (): Token => {
    const token = tokens[pos];
    if (!token)
      throw errorAt(tokens[tokens.length - 1], "Unexpected end of file");
    pos++;
    return token;
  };

  const isPunct = (token: Token | undefined, value: string): boolean =>
    token?.type === "PUNCT" && token.value === value;

  // Expects a precise punctuation, otherwise error
  const expectPunct = (value: string): void => {
    const token = next();
    if (!isPunct(token, value)) {
      throw errorAt(token, `"${value}" expected, but found "${token.value}"`);
    }
  };

  // cube.corner * 4;
  function parseSceneElement(): SceneElement {
    const tagToken = next();
    if (tagToken.type !== "IDENT") {
      throw errorAt(
        tagToken,
        `Object name expected in @scene, but found "${tagToken.value}"`,
      );
    }
    const element: SceneElement = {
      tag: tagToken.value,
      id: null,
      classes: [],
      count: 1,
    };

    // As many #id and .classes as there are
    while (true) {
      const token = peek();
      if (token?.type === "HASH") {
        next();
        if (element.id !== null)
          throw errorAt(
            token,
            `An object has only one id, it already is "#${element.id}"`,
          );
        element.id = token.value;
      } else if (isPunct(token, ".")) {
        next();
        const className = next();
        if (className.type !== "IDENT")
          throw errorAt(className, 'Class name expected after "."');
        element.classes.push(className.value);
      } else {
        break;
      }
    }

    // The optional multiplier: * 4
    if (isPunct(peek(), "*")) {
      next();
      const count = next();
      if (
        count.type !== "NUMBER" ||
        !Number.isInteger(count.value) ||
        count.value < 1
      ) {
        throw errorAt(count, 'A positive integer is expected after "*"');
      }
      element.count = count.value;
    }

    // A group contains other elements: group#letters { … }
    if (isPunct(peek(), "{")) {
      if (element.tag !== "group") {
        throw errorAt(
          tagToken,
          `Only a group can contain objects, not "${element.tag}"`,
        );
      }
      element.children = parseScene(
        element.id ? `group#${element.id}` : "group",
      );
      return element; // no ";" after the "}" of a group
    }

    // The ";" is optional: a new element or a "}" is enough
    if (isPunct(peek(), ";")) next();

    return element;
  }

  // @scene { ... }
  function parseScene(owner: string): SceneElement[] {
    const open = peek();
    expectPunct("{");
    const elements: SceneElement[] = [];
    while (!isPunct(peek(), "}")) {
      if (!peek()) throw errorAt(open, `${owner} never closed: "}" missing`);
      elements.push(parseSceneElement());
    }
    next();
    return elements;
  }

  // radius: 1 0.28;
  function parseDeclaration(): Declaration {
    const property = next();
    if (property.type !== "IDENT") {
      throw errorAt(
        property,
        `Property name expected, but found "${property.value}"`,
      );
    }
    expectPunct(":");
    const value: Token[] = [];
    while (peek() && !isPunct(peek(), ";") && !isPunct(peek(), "}")) {
      value.push(next());
    }

    // "!important" at the end: we take it out of the value and remember it
    const bang = value[value.length - 2];
    const word = value[value.length - 1];
    const important =
      isPunct(bang, "!") &&
      word?.type === "IDENT" &&
      word.value === "important";
    if (important) value.splice(value.length - 2, 2);
    else if (value.some((token) => isPunct(token, "!")))
      throw errorAt(value, '"!" must be followed by "important"');

    if (value.length === 0)
      throw errorAt(property, `The property "${property.value}" has no value`);
    if (isPunct(peek(), ";")) next(); // the ";" is optional before "}", like in CSS
    const declaration: Declaration = important
      ? { property: property.value, value, important: true }
      : { property: property.value, value };

    // From the name to the last value: where errors about this declaration point
    const span = spanAcross([property, ...value]);
    if (span) rememberSpan(declaration, span);
    return declaration;
  }

  // { radius: 1; color: #fff; } : shared by rules and keyframes
  function parseDeclarationBlock(): Declaration[] {
    const open = peek();
    expectPunct("{");
    const declarations: Declaration[] = [];
    while (!isPunct(peek(), "}")) {
      if (!peek()) throw errorAt(open, 'Block never closed: "}" missing');
      declarations.push(parseDeclaration());
    }
    next(); // we consume the "}"
    return declarations;
  }

  // #a, #b { ... }: one rule per selector, sharing the same declarations, like CSS
  function parseRules(): Rule[] {
    const selectors: Token[][] = [[]]; // the last one is the selector being read
    let depth = 0; // inside :has( … ), a comma belongs to the selector
    while (peek() && !isPunct(peek(), "{")) {
      const token = next();
      if (isPunct(token, "(")) depth++;
      if (isPunct(token, ")")) depth--;
      if (depth === 0 && isPunct(token, ",")) {
        if (selectors[selectors.length - 1].length === 0)
          throw errorAt(token, 'Selector expected before ","');
        selectors.push([]); // a new, empty selector starts
      } else {
        selectors[selectors.length - 1].push(token); // the token goes into the current selector
      }
    }
    if (selectors[selectors.length - 1].length === 0)
      throw errorAt(peek(), 'Selector expected before "{"');

    const declarations = parseDeclarationBlock();
    return selectors.map((selector) => ({ selector, declarations }));
  }

  // @keyframes float { from { ... } 50% { ... } to { ... } }
  function parseKeyframes(): Keyframes {
    const name = next();
    if (name.type !== "IDENT") {
      throw errorAt(
        name,
        `Animation name expected after @keyframes, but found "${name.value}"`,
      );
    }
    const open = peek();
    expectPunct("{");
    const frames: Keyframe[] = [];
    while (!isPunct(peek(), "}")) {
      if (!peek()) throw errorAt(open, '@keyframes never closed: "}" missing');

      // The offsets before "{": from, to, 50%, or 0%, 100%
      const offsets: Token[] = [];
      while (peek() && !isPunct(peek(), "{")) {
        const token = next();
        if (!isPunct(token, ",")) offsets.push(token); // we skip the commas
      }
      frames.push({ offsets, declarations: parseDeclarationBlock() });
    }
    next(); // we consume the "}"
    return { name: name.value, frames };
  }

  // @media (max-width: 600px) { rules }: each rule remembers its query, like CSS
  function parseMedia(at: Token): Rule[] {
    const prelude: Token[] = [];
    while (peek() && !isPunct(peek(), "{")) prelude.push(next());
    if (prelude.length === 0)
      throw errorAt(
        at,
        "@media needs a query, like: @media (max-width: 600px) { scene { dpr: 1; } }",
      );
    const open = next(); // the "{"
    const media = textOf(prelude);
    const rules: Rule[] = [];
    while (!isPunct(peek(), "}")) {
      const token = peek();
      if (!token) throw errorAt(open, '@media never closed: "}" missing');
      if (token.type === "AT_KEYWORD")
        throw errorAt(
          token,
          "@media holds rules only, for now: write @scene and @keyframes outside it",
        );
      for (const rule of parseRules()) {
        rule.media = media;
        rules.push(rule);
      }
    }
    next(); // the "}"
    return rules;
  }

  // The whole file: a sequence of @scene and rules
  const stylesheet: Stylesheet = { scene: [], rules: [], keyframes: [] };

  while (peek()) {
    const token = peek()!;
    if (token.type === "AT_KEYWORD") {
      next();
      if (token.value === "scene") {
        stylesheet.scene.push(...parseScene("@scene"));
      } else if (token.value === "keyframes") {
        stylesheet.keyframes.push(parseKeyframes());
      } else if (token.value === "media") {
        stylesheet.rules.push(...parseMedia(token));
      } else {
        throw errorAt(token, `@${token.value} isn't supported yet`);
      }
    } else {
      stylesheet.rules.push(...parseRules());
    }
  }

  return stylesheet;
}

// Tokens back to text, with a space where the source had one: the query of a
// @media, which the browser reads (matchMedia)
function textOf(tokens: Token[]): string {
  return tokens
    .map((token, i) => {
      const before = tokens[i - 1];
      const a = before && spanOf(before);
      const b = spanOf(token);
      const space = a !== undefined && b !== undefined && a.end < b.start;
      return (space ? " " : "") + tokenText(token);
    })
    .join("");
}

function tokenText(token: Token): string {
  if (token.type === "HASH") return `#${token.value}`;
  if (token.type === "AT_KEYWORD") return `@${token.value}`;
  if (token.type === "DIMENSION") return `${token.value}${token.unit}`;
  if (token.type === "PERCENTAGE") return `${token.value}%`;
  if (token.type === "STRING") return JSON.stringify(token.value);
  return String(token.value);
}
