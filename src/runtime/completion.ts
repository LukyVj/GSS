// Autocompletion in the editor: when a property name is being typed, the names of the
// properties the rule can take, from the registry (decision 89). Pure functions here;
// editor.ts plugs them into CodeMirror.
import { scan, type Token } from "../compiler/syntax/tokenizer";
import { parseSelector, isSceneSelector, needsPointer } from "../compiler/cascade/resolve";
import { nestSelector } from "../compiler/syntax/nesting";
import { PROPERTIES, SHAPE_DOCS, type PropertyDef } from "../compiler/registry/registry";

// The blocks a position can be in: the structure of @scene (and its groups), a
// @keyframes and its frames, a @media, a rule, or a block GSS does not know
type Block =
  | { kind: "scene" | "keyframes" | "frame" | "media" | "unknown" }
  | { kind: "rule"; selector: Token[] };

// The property names to offer at pos, and where the typed part starts; null where a
// property name is not expected (a value, a selector, @scene, outside any rule)
export function propertySuggestions(
  code: string,
  pos: number,
): { from: number; properties: PropertyDef[] } | null {
  const blocks: Block[] = [];
  let statement: { token: Token; start: number; end: number }[] = []; // since the last { } or ;
  for (const { token, start, end } of scan(code.slice(0, pos), { recover: true })) {
    if (token.type === "COMMENT") continue;
    if (token.type === "INVALID") {
      statement.push({ token: { type: "PUNCT", value: token.value }, start, end });
      continue;
    }
    if (token.type === "PUNCT" && token.value === "{") {
      blocks.push(blockOf(statement.map((s) => s.token), blocks[blocks.length - 1]));
      statement = [];
    } else if (token.type === "PUNCT" && token.value === "}") {
      blocks.pop();
      statement = [];
    } else if (token.type === "PUNCT" && token.value === ";") {
      statement = [];
    } else if (token.type === "GLSL") {
      // The block of a @paint: GLSL, no property here; closed, the next rule starts after it
      const closed = end - start - 1 > token.value.length;
      if (!closed) return null;
      statement = [];
    } else {
      statement.push({ token, start, end });
    }
  }

  const block = blocks[blocks.length - 1];
  if (block?.kind !== "rule" && block?.kind !== "frame") return null;
  // Nothing typed yet, or one name being typed, right up to the cursor
  if (statement.length > 1) return null;
  const typed = statement[0];
  if (typed && (typed.token.type !== "IDENT" || typed.end !== pos)) return null;
  // A custom property: any name
  if (typed?.token.type === "IDENT" && typed.token.value.startsWith("--")) return null;
  return {
    from: typed ? typed.start : pos,
    properties:
      block.kind === "rule" ? forSelector(block.selector) : PROPERTIES.filter((p) => p.animatable),
  };
}

// The block a { opens, from what comes before it and the block around it
function blockOf(prelude: Token[], parent: Block | undefined): Block {
  if (parent?.kind === "scene") return { kind: "scene" }; // a group inside @scene
  if (parent?.kind === "keyframes") return { kind: "frame" };
  const [first] = prelude;
  if (parent?.kind === "rule") {
    // Nesting: a rule inside a rule, or a @media that keeps the selector of the rule
    if (first?.type === "AT_KEYWORD") return first.value === "media" ? parent : { kind: "unknown" };
    return first ? { kind: "rule", selector: nestSelector(parent.selector, prelude) } : { kind: "unknown" };
  }
  if (parent && parent.kind !== "media") return { kind: "unknown" };
  if (first?.type === "AT_KEYWORD") {
    if (first.value === "scene") return { kind: "scene" };
    if (first.value === "keyframes") return { kind: "keyframes" };
    if (first.value === "media") return { kind: "media" };
    return { kind: "unknown" };
  }
  return { kind: "rule", selector: prelude };
}

// The properties a rule can take, like validate.ts checks them
function forSelector(tokens: Token[]): PropertyDef[] {
  const objects = (p: PropertyDef) => p.appliesTo !== "scene";
  let selector;
  try {
    selector = parseSelector(tokens);
  } catch {
    return PROPERTIES.filter(objects); // a selector being written: every object property
  }
  if (isSceneSelector(selector))
    return PROPERTIES.filter((p) => p.appliesTo === "scene" || p.appliesTo === "everywhere");
  if (selector.face !== undefined) return PROPERTIES.filter((p) => p.name === "texture");
  if (needsPointer(selector))
    return PROPERTIES.filter((p) => p.animatable || p.name === "transition");
  // A group and a light take only a few properties
  const node = SHAPE_DOCS.find((shape) => shape.name === selector.tag && shape.takes);
  if (node) return PROPERTIES.filter((p) => node.takes!.includes(p.name));
  const shape = SHAPE_DOCS.some((s) => s.name === selector.tag && s.name !== "group")
    ? selector.tag
    : null; // no tag (a class, an id, *): any shape
  return PROPERTIES.filter(
    (p) =>
      objects(p) &&
      (!Array.isArray(p.appliesTo) || shape === null || (p.appliesTo as string[]).includes(shape)),
  );
}
