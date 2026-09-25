import type { Token } from "./tokenizer";
import type { Stylesheet, SceneElement, Rule, Declaration } from "./ast";

export function parse(tokens: Token[]): Stylesheet {
  let pos = 0; // notre position dans la liste de tokens

  // Regarde le token actuel, sans avancer
  const peek = (): Token | undefined => tokens[pos];

  // Prend le token actuel et avance
  const next = (): Token => {
    const token = tokens[pos];
    if (!token) throw new Error("Fin du fichier inattendue");
    pos++;
    return token;
  };

  const isPunct = (token: Token | undefined, value: string): boolean =>
    token?.type === "PUNCT" && token.value === value;

  // Exige une ponctuation précise, sinon erreur
  const expectPunct = (value: string): void => {
    const token = next();
    if (!isPunct(token, value)) {
      throw new Error(`"${value}" attendu, mais trouvé "${token.value}"`);
    }
  };

  // cube.corner * 4;
  function parseSceneElement(): SceneElement {
    const tagToken = next();
    if (tagToken.type !== "IDENT") {
      throw new Error(
        `Nom d'objet attendu dans @scene, mais trouvé "${tagToken.value}"`,
      );
    }
    const element: SceneElement = {
      tag: tagToken.value,
      id: null,
      classes: [],
      count: 1,
    };

    // Autant de #id et de .classe qu'il y en a
    while (true) {
      const token = peek();
      if (token?.type === "HASH") {
        next();
        element.id = token.value;
      } else if (isPunct(token, ".")) {
        next();
        const className = next();
        if (className.type !== "IDENT")
          throw new Error('Nom de classe attendu après "."');
        element.classes.push(className.value);
      } else {
        break;
      }
    }

    // Le multiplicateur optionnel : * 4
    if (isPunct(peek(), "*")) {
      next();
      const count = next();
      if (
        count.type !== "NUMBER" ||
        !Number.isInteger(count.value) ||
        count.value < 1
      ) {
        throw new Error('Un nombre entier positif est attendu après "*"');
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
      if (!peek()) throw new Error('@scene n\'est jamais fermé : "}" manquant');
      elements.push(parseSceneElement());
    }
    next(); // on consomme le "}"
    return elements;
  }

  // radius: 1 0.28;
  function parseDeclaration(): Declaration {
    const property = next();
    if (property.type !== "IDENT") {
      throw new Error(
        `Nom de propriété attendu, mais trouvé "${property.value}"`,
      );
    }
    expectPunct(":");
    const value: Token[] = [];
    while (peek() && !isPunct(peek(), ";") && !isPunct(peek(), "}")) {
      value.push(next());
    }
    if (value.length === 0)
      throw new Error(`La propriété "${property.value}" n'a pas de valeur`);
    if (isPunct(peek(), ";")) next(); // le ";" est optionnel avant "}", comme en CSS
    return { property: property.value, value };
  }

  // torus#hero { ... }
  function parseRule(): Rule {
    const selector: Token[] = [];
    while (peek() && !isPunct(peek(), "{")) {
      selector.push(next());
    }
    expectPunct("{");
    const declarations: Declaration[] = [];
    while (!isPunct(peek(), "}")) {
      if (!peek()) throw new Error('Règle jamais fermée : "}" manquant');
      declarations.push(parseDeclaration());
    }
    next();
    return { selector, declarations };
  }

  // Le fichier entier : une suite de @scene et de règles
  const stylesheet: Stylesheet = { scene: [], rules: [] };

  while (peek()) {
    const token = peek()!;
    if (token.type === "AT_KEYWORD") {
      next();
      if (token.value === "scene") {
        stylesheet.scene.push(...parseScene());
      } else {
        throw new Error(`@${token.value} n'est pas encore supporté`);
      }
    } else {
      stylesheet.rules.push(parseRule());
    }
  }

  return stylesheet;
}
