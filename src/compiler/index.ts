import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { expandScene } from "./expand";
import { resolveStyles } from "./resolve";
import { generateShader } from "./codegen";

// Texte CSL → shader GLSL
export function compileCSL(source: string): string {
  const stylesheet = parse(tokenize(source));
  const instances = expandScene(stylesheet.scene);
  const styled = resolveStyles(instances, stylesheet.rules);
  return generateShader(styled);
}
