import type { Rule } from "./ast";
import { PROPERTIES } from "./registry";
import { parseSelector, isSceneSelector } from "./resolve";

// Throws if a rule uses a property that is not in the registry,
// or a property that does not apply to what the rule targets.
export function validateProperties(rules: Rule[]): void {
  for (const rule of rules) {
    const selector = parseSelector(rule.selector);
    const isScene = isSceneSelector(selector);

    for (const declaration of rule.declarations) {
      const property = PROPERTIES.find((p) => p.name === declaration.property);

      if (!property) {
        throw new Error(`Unknown property "${declaration.property}"`);
      }

      if (isScene && property.appliesTo !== "scene") {
        throw new Error(`"${declaration.property}" only applies to objects.`);
      }

      if (!isScene && property.appliesTo === "scene") {
        throw new Error(`"${declaration.property}" only applies to the scene.`);
      }

      // Shape-specific property on an explicit, incompatible tag
      if (
        Array.isArray(property.appliesTo) &&
        selector.tag !== null &&
        !(property.appliesTo as string[]).includes(selector.tag)
      ) {
        throw new Error(
          `"${property.name}" only applies to ${property.appliesTo.join(", ")}.`,
        );
      }
    }
  }
}
