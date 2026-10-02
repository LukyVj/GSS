import type { Token } from "./tokenizer";
import type {
  Stylesheet,
  SceneElement,
  Rule,
  Declaration,
  Keyframes,
  Keyframe,
} from "./ast";
import { ErrorSink, errorAt, errorsOf, rememberSpan, spanAcross, spanOf } from "./errors";
import { isAmpersand, nestSelector } from "./nesting";

// Reading goes on after an error (decision 86): the error is kept, the parser skips to
// the end of the declaration, the element or the rule, and reads the rest. errors:
// where the errors go; without it, parse() throws them at the end.
export function parse(tokens: Token[], errors?: ErrorSink): Stylesheet {
  let pos = 0; // our position in the list of tokens
  const sink = errors ?? new ErrorSink();

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

  // ----- Recovery -----
  // Thrown once the end of the file is reached in an error: nothing is left to read
  const STOP = Symbol("end of file");

  // Reads one part; on an error, keeps it, skips the rest of the part and returns undefined
  function attempt<T>(read: () => T, skip: () => void): T | undefined {
    const from = pos;
    try {
      return read();
    } catch (caught) {
      if (caught === STOP) throw caught;
      for (const error of errorsOf(caught)) sink.add(error);
      if (!peek()) throw STOP;
      const last = tokens[pos - 1];
      // The error took the ";" that ends the part: the part is over, nothing to skip
      if (pos > from && isPunct(last, ";")) return undefined;
      // It took the "}" of the block around: the block must still see it
      if (pos - 1 > from && isPunct(last, "}")) pos--;
      if (pos === from) pos++; // always move on, or the same error comes back
      skip();
      return undefined;
    }
  }

  // After a broken declaration: up to its ";" (taken) or the "}" of its block (left)
  function skipDeclaration(): void {
    let depth = 0;
    while (peek()) {
      const token = peek();
      if (depth === 0 && (isPunct(token, ";") || isPunct(token, "}"))) break;
      if (isPunct(token, "(") || isPunct(token, "{")) depth++;
      if (isPunct(token, ")") || isPunct(token, "}")) depth--;
      pos++;
    }
    if (isPunct(peek(), ";")) pos++;
  }

  // After a broken element or rule: up to its ";", or the end of its block { … }.
  // inBlock: the "}" of the block around it ends the skip, and is left to that block.
  function skipStatement(inBlock: boolean): void {
    let depth = 0;
    while (peek()) {
      const token = peek()!;
      if (depth === 0 && isPunct(token, ";")) {
        pos++;
        return;
      }
      if (isPunct(token, "}")) {
        if (depth === 0) {
          if (!inBlock) pos++; // a stray "}" at the top
          return;
        }
        pos++;
        if (--depth === 0) return; // the block of the broken rule is over
        continue;
      }
      if (isPunct(token, "{")) depth++;
      pos++;
    }
  }

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
      const element = attempt(parseSceneElement, () => skipStatement(true));
      if (element) elements.push(element);
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
    // A ";" between parentheses belongs to the value: if(media(…): 1; else: 2)
    let depth = 0;
    while (
      peek() &&
      (depth > 0 || (!isPunct(peek(), ";") && !isPunct(peek(), "}")))
    ) {
      if (isPunct(peek(), "(")) depth++;
      if (isPunct(peek(), ")")) depth--;
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
      const declaration = attempt(parseDeclaration, skipDeclaration);
      if (declaration) declarations.push(declaration);
    }
    next(); // we consume the "}"
    return declarations;
  }

  // #a, #b { ... }: one rule per selector, sharing the same declarations, like CSS.
  // Inside a rule (parents), each selector is nested in each selector of the parent.
  function parseRules(parents?: Token[][], media?: string): Rule[] {
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
    const ampersand = parents ? undefined : selectors.flat().find(isAmpersand);
    if (ampersand)
      throw errorAt(
        ampersand,
        "& stands for the selector of the rule around it: write it inside a rule, like: cube { &:hover { color: white; } }",
      );

    const full = parents
      ? parents.flatMap((parent) => selectors.map((selector) => nestSelector(parent, selector)))
      : selectors;
    return parseRuleBlock(full, media);
  }

  // { color: red; &:hover { … } @media (…) { … } }: the declarations of a rule, and the
  // rules nested in it (nesting, like CSS). Everything is unfolded into flat rules, in the
  // order of the text: the declarations after a nested rule come after it in the cascade.
  function parseRuleBlock(selectors: Token[][], media?: string): Rule[] {
    const open = peek();
    expectPunct("{");
    const rules: Rule[] = [];
    let declarations: Declaration[] = [];
    let nested = false; // a block with no nested rule gives one rule per selector, even empty
    const flush = () => {
      if (declarations.length > 0 || !nested)
        for (const selector of selectors)
          rules.push(media ? { selector, declarations, media } : { selector, declarations });
      declarations = [];
    };
    while (!isPunct(peek(), "}")) {
      const token = peek();
      if (!token) throw errorAt(open, 'Block never closed: "}" missing');
      if (token.type === "AT_KEYWORD" || startsRule()) {
        if (declarations.length > 0) flush();
        nested = true;
        const read = attempt(
          () => (token.type === "AT_KEYWORD" ? parseNestedAt(selectors, media) : parseRules(selectors, media)),
          () => skipStatement(true),
        );
        rules.push(...(read ?? []));
      } else {
        const declaration = attempt(parseDeclaration, skipDeclaration);
        if (declaration) declarations.push(declaration);
      }
    }
    next(); // we consume the "}"
    flush();
    return rules;
  }

  // Does a rule start here, and not a declaration? A "{" comes before the next ";" or "}"
  function startsRule(): boolean {
    let depth = 0;
    for (let i = pos; i < tokens.length; i++) {
      const token = tokens[i];
      if (isPunct(token, "(")) depth++;
      if (isPunct(token, ")")) depth--;
      if (depth > 0) continue;
      if (isPunct(token, "{")) return true;
      if (isPunct(token, ";") || isPunct(token, "}")) return false;
    }
    return false;
  }

  // @media inside a rule: its declarations and rules go to the selectors of the rule
  function parseNestedAt(selectors: Token[][], outer?: string): Rule[] {
    const at = next();
    if (at.type === "AT_KEYWORD" && ["scene", "keyframes", "property"].includes(at.value as string))
      throw errorAt(at, `@${at.value} goes outside the rules`);
    if (at.type !== "AT_KEYWORD" || at.value !== "media")
      throw errorAt(at, `@${at.value} isn't supported yet`);
    const query = readMediaQuery(at);
    if (outer && (outer.includes(",") || query.includes(",")))
      throw errorAt(
        at,
        "@media inside @media cannot join a list of queries: write the rule in a @media of its own",
      );
    return parseRuleBlock(selectors, outer ? `${outer} and ${query}` : query);
  }

  // The query of a @media, as text: (max-width: 600px)
  function readMediaQuery(at: Token): string {
    const prelude: Token[] = [];
    while (peek() && !isPunct(peek(), "{")) prelude.push(next());
    if (prelude.length === 0)
      throw errorAt(
        at,
        "@media needs a query, like: @media (max-width: 600px) { scene { dpr: 1; } }",
      );
    return textOf(prelude);
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
    const media = readMediaQuery(at);
    const open = next(); // the "{"
    const rules: Rule[] = [];
    while (!isPunct(peek(), "}")) {
      const token = peek();
      if (!token) throw errorAt(open, '@media never closed: "}" missing');
      const read = attempt(() => {
        if (token.type === "AT_KEYWORD")
          throw errorAt(
            token,
            "@media holds rules only, for now: write @scene and @keyframes outside it",
          );
        return parseRules(undefined, media);
      }, () => skipStatement(true));
      rules.push(...(read ?? []));
    }
    next(); // the "}"
    return rules;
  }

  // The whole file: a sequence of @scene and rules
  const stylesheet: Stylesheet = { scene: [], rules: [], keyframes: [], properties: [] };

  // One @scene, @keyframes, @media or rule
  function parseStatement(): void {
    const token = peek()!;
    if (isPunct(token, "}")) {
      // A "}" that closes nothing: reported, and the next rule is read as usual
      sink.add(errorAt(next(), '"}" closes no block'));
      return;
    }
    if (token.type === "AT_KEYWORD") {
      next();
      if (token.value === "scene") {
        stylesheet.scene.push(...parseScene("@scene"));
      } else if (token.value === "keyframes") {
        stylesheet.keyframes.push(parseKeyframes());
      } else if (token.value === "media") {
        stylesheet.rules.push(...parseMedia(token));
      } else if (token.value === "property") {
        // @property --speed { syntax: "<number>"; … }: read in features/properties.ts
        const name = next();
        stylesheet.properties.push({ name, descriptors: parseDeclarationBlock() });
      } else {
        throw errorAt(token, `@${token.value} isn't supported yet`);
      }
    } else {
      stylesheet.rules.push(...parseRules());
    }
  }

  try {
    while (peek()) attempt(parseStatement, () => skipStatement(false));
  } catch (caught) {
    if (caught !== STOP) throw caught;
  }

  if (!errors) sink.throwIfAny(); // no sink given: the errors are thrown, all at once
  return stylesheet;
}

// Tokens back to text, with a space where the source had one: the query of a
// @media, which the browser reads (matchMedia)
export function textOf(tokens: Token[]): string {
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
