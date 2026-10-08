import { PROPERTIES as ALL_PROPERTIES, SHAPE_DOCS, type PropertyDef } from "./registry.ts";

// What the compiler reads from the registry, and nothing else (decision 147). The registry
// stays the one place a feature is written; the npm package (vite.lib.config.ts) replaces
// this file with coreModule(), so the compiler a page downloads holds no docs or examples.
// The types keep the compiler from reading anything else.
export type PropertyFacts = Pick<PropertyDef, "name" | "appliesTo" | "animatable">;

export const PROPERTIES: readonly PropertyFacts[] = ALL_PROPERTIES;

// A light of @scene takes only a few properties (decision 110)
export const LIGHT_TAKES: readonly string[] = SHAPE_DOCS.find((shape) => shape.name === "light")!.takes!;

export function coreFacts(): { PROPERTIES: PropertyFacts[]; LIGHT_TAKES: string[] } {
  return {
    PROPERTIES: PROPERTIES.map(({ name, appliesTo, animatable }) =>
      animatable === undefined ? { name, appliesTo } : { name, appliesTo, animatable },
    ),
    LIGHT_TAKES: [...LIGHT_TAKES],
  };
}

// This file, as the npm package ships it
export function coreModule(): string {
  const facts = coreFacts();
  return [
    `export const PROPERTIES = ${JSON.stringify(facts.PROPERTIES)};`,
    `export const LIGHT_TAKES = ${JSON.stringify(facts.LIGHT_TAKES)};`,
  ].join("\n");
}
