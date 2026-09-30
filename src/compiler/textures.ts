import type { Token } from "./tokenizer";
import type { Styles } from "./resolve";
import { readFunction } from "./values";
import { errorAt } from "./errors";

const EXAMPLE = 'texture: url("dirt.png");';

// texture: url("dirt.png") → "dirt.png"
export function readTexture(value: Token[]): string {
  const call = readFunction(value);
  const [arg] = call?.args ?? [];
  if (
    call?.name !== "url" ||
    call.args.length !== 1 ||
    arg.length !== 1 ||
    arg[0].type !== "STRING"
  ) {
    throw errorAt(value, `texture expects url("…"), like: ${EXAMPLE}`);
  }
  return arg[0].value;
}

// Every image of the scene, once each, in the order of the objects
export function sceneTextures(instances: { styles: Styles }[]): string[] {
  const files = new Set<string>(); // keeps the first order, ignores duplicates
  for (const instance of instances) {
    const value = instance.styles["texture"];
    if (value) files.add(readTexture(value));
  }
  return [...files];
}
