import type { Rule, Keyframes } from "./ast";
import { PROPERTIES } from "./registry";
import { parseSelector, isSceneSelector, needsHover } from "./resolve";
import { errorAt } from "./errors";

// Throws if a rule uses a property that is not in the registry,
// or a property that does not apply to what the rule targets.
export function validateProperties(rules: Rule[]): void {
  for (const rule of rules) {
    const selector = parseSelector(rule.selector);
    const isScene = isSceneSelector(selector);
    const hover = needsHover(selector);
    if (hover && selector.face !== undefined) {
      throw errorAt(rule.selector, "A face cannot change on :hover yet");
    }

    for (const declaration of rule.declarations) {
      // A custom property (--anything) is valid everywhere, like CSS
      if (declaration.property.startsWith("--")) continue;

      const property = PROPERTIES.find((p) => p.name === declaration.property);

      if (!property) {
        throw errorAt(
          declaration,
          `Unknown property "${declaration.property}"`,
        );
      }

      if (hover && !property.animatable) {
        const animatable = PROPERTIES.filter((p) => p.animatable).map(
          (p) => p.name,
        );
        throw errorAt(
          declaration,
          `"${declaration.property}" cannot change on :hover. Animatable properties: ${animatable.join(", ")}.`,
        );
      }

      if (isScene && property.appliesTo !== "scene") {
        throw errorAt(
          declaration,
          `"${declaration.property}" only applies to objects.`,
        );
      }

      if (!isScene && property.appliesTo === "scene") {
        throw errorAt(
          declaration,
          `"${declaration.property}" only applies to the scene.`,
        );
      }

      // Shape-specific property on an explicit, incompatible tag
      if (
        Array.isArray(property.appliesTo) &&
        selector.tag !== null &&
        !(property.appliesTo as string[]).includes(selector.tag)
      ) {
        throw errorAt(
          declaration,
          `"${property.name}" only applies to ${property.appliesTo.join(", ")}.`,
        );
      }
    }
  }
}

// Throws if a @keyframes frame uses a property that is unknown or cannot be animated
export function validateKeyframes(keyframes: Keyframes[]): void {
  const animatable = PROPERTIES.filter((p) => p.animatable).map((p) => p.name);

  for (const animation of keyframes) {
    for (const frame of animation.frames) {
      for (const declaration of frame.declarations) {
        // A variable can be animated: what uses it moves with it (decision 55)
        if (declaration.property.startsWith("--")) continue;

        const property = PROPERTIES.find(
          (p) => p.name === declaration.property,
        );

        if (!property) {
          throw errorAt(
            declaration,
            `Unknown property "${declaration.property}" in @keyframes ${animation.name}`,
          );
        }

        if (!property.animatable) {
          throw errorAt(
            declaration,
            `"${declaration.property}" cannot be animated (in @keyframes ${animation.name}). Animatable properties: ${animatable.join(", ")}.`,
          );
        }
      }
    }
  }
}
