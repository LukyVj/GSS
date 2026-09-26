import type { Rule } from "./ast";
import type { Token } from "./tokenizer";
import type { SceneInstance } from "./expand";

// Les propriétés d'une instance après la cascade : { translate: [...], color: [...] }
export type Styles = Record<string, Token[]>;

// Une instance + ses styles finaux
export type StyledInstance = SceneInstance & { styles: Styles };

// Un sélecteur simple : cube, .corner, #hero, ou une combinaison comme cube#left.corner
export type SimpleSelector = {
  tag: string | null;
  id: string | null;
  classes: string[];
};

function tokenToText(token: Token): string {
  if (token.type === "HASH") return `#${token.value}`;
  if (token.type === "AT_KEYWORD") return `@${token.value}`;
  if (token.type === "DIMENSION") return `${token.value}${token.unit}`;
  return String(token.value);
}

// Transforme les tokens d'un sélecteur en objet { tag, id, classes }
export function parseSelector(tokens: Token[]): SimpleSelector {
  const selector: SimpleSelector = { tag: null, id: null, classes: [] };
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    const next = tokens[i + 1];

    if (i === 0 && token.type === "IDENT") {
      selector.tag = token.value;
      i++;
    } else if (token.type === "HASH") {
      selector.id = token.value;
      i++;
    } else if (
      token.type === "PUNCT" &&
      token.value === "." &&
      next?.type === "IDENT"
    ) {
      selector.classes.push(next.value);
      i += 2;
    } else {
      const text = tokens.map(tokenToText).join("");
      throw new Error(`Sélecteur pas encore supporté : "${text}"`);
    }
  }

  return selector;
}

// Est-ce que ce sélecteur cible cette instance ?
export function matches(
  selector: SimpleSelector,
  instance: SceneInstance,
): boolean {
  if (selector.tag !== null && selector.tag !== instance.tag) return false;
  if (selector.id !== null && selector.id !== instance.id) return false;
  return selector.classes.every((className) =>
    instance.classes.includes(className),
  );
}

// ⬇️ TA MISSION : renvoyer un nombre d'autant plus grand que le sélecteur est spécifique
export function specificity(selector: SimpleSelector): number {
  return (
    (selector.id ? 10_000 : 0) +
    selector.classes.length * 100 +
    (selector.tag ? 1 : 0)
  );
}

export function resolveStyles(
  instances: SceneInstance[],
  rules: Rule[],
): StyledInstance[] {
  // On trie les règles de la moins spécifique à la plus spécifique.
  // À spécificité égale, l'ordre du fichier décide : la dernière gagne.
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

  return instances.map((instance) => {
    const styles: Styles = {};
    for (const { rule, selector } of sortedRules) {
      if (!matches(selector, instance)) continue;
      for (const declaration of rule.declarations) {
        styles[declaration.property] = declaration.value; // la règle suivante écrase la précédente
      }
    }
    return { ...instance, styles };
  });
}

export function isSceneSelector(selector: SimpleSelector): boolean {
  return (
    selector.tag === "scene" &&
    selector.id === null &&
    selector.classes.length === 0
  );
}

// Les styles de la scène elle-même : scene { floor: ...; background: ...; }
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
