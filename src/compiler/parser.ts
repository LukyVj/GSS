import type { Token } from "./tokenizer";
import type {
  Stylesheet,
  SceneElement,
  Rule,
  Declaration,
  Keyframes,
  Keyframe,
} from "./ast";

export function parse(tokens: Token[]): Stylesheet {
  let pos = 0; // our position in the list of tokens

  // Looks at the current token, without advancing
  const peek = (): Token | undefined => tokens[pos];

  // Takes the current token and advances
  const next = (): Token => {
    const token = tokens[pos];
    if (!token) throw new Error("Unexpected end of file");
    pos++;
    return token;
  };

  const isPunct = (token: Token | undefined, value: string): boolean =>
    token?.type === "PUNCT" && token.value === value;

  // Expects a precise punctuation, otherwise error
  const expectPunct = (value: string): void => {
    const token = next();
    if (!isPunct(token, value)) {
      throw new Error(`"${value}" expected, but found "${token.value}"`);
    }
  };

  // cube.corner * 4;
  function parseSceneElement(): SceneElement {
    const tagToken = next();
    if (tagToken.type !== "IDENT") {
      throw new Error(
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
        element.id = token.value;
      } else if (isPunct(token, ".")) {
        next();
        const className = next();
        if (className.type !== "IDENT")
          throw new Error('Class name expected after "."');
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
        throw new Error('A positive integer is expected after "*"');
      }
      element.count = count.value;
    }

    expectPunct(";");
    return element;
  }

  // @scene { ... }
  function parseScene(): SceneElement[] {
    expectPunct("{");
    const elements: SceneElement[] = [];
    while (!isPunct(peek(), "}")) {
      if (!peek()) throw new Error('@scene never closed: "}" missing');
      elements.push(parseSceneElement());
    }
    next(); // we consume the "}"
    return elements;
  }

  // radius: 1 0.28;
  function parseDeclaration(): Declaration {
    const property = next();
    if (property.type !== "IDENT") {
      throw new Error(`Property name expected, but found "${property.value}"`);
    }
    expectPunct(":");
    const value: Token[] = [];
    while (peek() && !isPunct(peek(), ";") && !isPunct(peek(), "}")) {
      value.push(next());
    }
    if (value.length === 0)
      throw new Error(`The property "${property.value}" has no value`);
    if (isPunct(peek(), ";")) next(); // the ";" is optional before "}", like in CSS
    return { property: property.value, value };
  }

  // { radius: 1; color: #fff; } : shared by rules and keyframes
  function parseDeclarationBlock(): Declaration[] {
    expectPunct("{");
    const declarations: Declaration[] = [];
    while (!isPunct(peek(), "}")) {
      if (!peek()) throw new Error('Block never closed: "}" missing');
      declarations.push(parseDeclaration());
    }
    next(); // we consume the "}"
    return declarations;
  }

  // torus#hero { ... }
  function parseRule(): Rule {
    const selector: Token[] = [];
    while (peek() && !isPunct(peek(), "{")) {
      selector.push(next());
    }
    return { selector, declarations: parseDeclarationBlock() };
  }

  // @keyframes float { from { ... } 50% { ... } to { ... } }
  function parseKeyframes(): Keyframes {
    const name = next();
    if (name.type !== "IDENT") {
      throw new Error(
        `Animation name expected after @keyframes, but found "${name.value}"`,
      );
    }
    expectPunct("{");
    const frames: Keyframe[] = [];
    while (!isPunct(peek(), "}")) {
      if (!peek()) throw new Error('@keyframes never closed: "}" missing');

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

  // The whole file: a sequence of @scene and rules
  const stylesheet: Stylesheet = { scene: [], rules: [], keyframes: [] };

  while (peek()) {
    const token = peek()!;
    if (token.type === "AT_KEYWORD") {
      next();
      if (token.value === "scene") {
        stylesheet.scene.push(...parseScene());
      } else if (token.value === "keyframes") {
        stylesheet.keyframes.push(parseKeyframes());
      } else {
        throw new Error(`@${token.value} isn't supported yet`);
      }
    } else {
      stylesheet.rules.push(parseRule());
    }
  }

  return stylesheet;
}
