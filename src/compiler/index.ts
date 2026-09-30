import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { expandScene } from "./expand";
import { resolveStyles, resolveSceneStyles } from "./resolve";
import { generateShader } from "./codegen";
import { validateProperties, validateKeyframes } from "./validate";
import { readCamera, type CameraSettings } from "./camera";
import { resolveMath, type CalcContext } from "./calc";
import type { Styles } from "./resolve";
import type { Declaration, Keyframes } from "./ast";
import type { Token } from "./tokenizer";
import { errorAt, rememberSpan, spanOf } from "./errors";
import { resolveVars, usesVariables, hasVar, type Variables } from "./vars";
import { PROPERTIES } from "./registry";
import { resolveColors, resolveNamedColors } from "./colors";
import { sceneTextures } from "./textures";

// Everything the runtime needs to display a scene
export type CompiledScene = {
  shader: string;
  camera: CameraSettings;
  objects: number; // instances drawn, for the status bar (decision 42)
  textures: string[]; // the image files the runtime loads, once each
};

// GSS text → shader + camera settings
export function compileScene(source: string): CompiledScene {
  const stylesheet = parse(tokenize(source));
  validateProperties(stylesheet.rules);
  validateKeyframes(stylesheet.keyframes);
  const instances = expandScene(stylesheet.scene);

  // The scene is the root of the variables, like :root in CSS
  const sceneStyles = resolveSceneStyles(stylesheet.rules);
  const rootVariables = customProperties(sceneStyles);

  // The copies of @keyframes made for one object, when they use variables (decision 55)
  const copies: Keyframes[] = [];

  // One object or one group: var() replaced, then the math, with its own variables
  function computeNode(
    styles: Styles,
    variables: Variables,
    context: CalcContext,
  ): Styles {
    const computed = computeColors(
      computeMath(computeVars(styles, variables), context),
    );
    const copy = animateVariables(
      styles,
      variables,
      context,
      stylesheet.keyframes,
      copies.length + 1,
    );
    if (!copy) return computed;
    copies.push(copy.keyframes);
    // The object plays its own copy: the rest of the animation (2s, alternate…) stays
    return {
      ...computed,
      animation: [copy.name, ...computed["animation"].slice(1)],
    };
  }

  // The cascade picks the values, then var() is replaced, then the math is computed
  // for each object (decisions 52 and 55)
  const styled = resolveStyles(instances, stylesheet.rules).map((instance) => {
    // Level 0 = the scene, 1… = the groups from the outside in, last = the object
    const levels = [
      rootVariables,
      ...instance.groupStyles.map(customProperties),
      customProperties(instance.styles),
    ];
    // The variables seen at level n: every level from 0 to n, the closest one wins
    const seenAt = (n: number): Variables =>
      Object.assign({}, ...levels.slice(0, n + 1));

    return {
      ...instance,
      styles: computeNode(instance.styles, seenAt(levels.length - 1), instance),
      groupStyles: instance.groupStyles.map((styles, g) =>
        computeNode(styles, seenAt(g + 1), instance.groups[g]),
      ),
    };
  });

  const computedScene = computeColors(
    computeMath(computeVars(sceneStyles, rootVariables), null),
  );
  // @keyframes with variables are only played through their copies
  const shared = computeKeyframes(
    stylesheet.keyframes.filter((k) => !usesVariablesIn(k)),
  );
  return {
    shader: generateShader(styled, computedScene, [...shared, ...copies]),
    camera: readCamera(computedScene),
    objects: instances.length,
    // After the cascade and var(): the texture an object really ends up with
    textures: sceneTextures(styled),
  };
}

// Does a @keyframes block set a variable, or read one?
function usesVariablesIn(animation: Keyframes): boolean {
  return animation.frames.some((frame) =>
    frame.declarations.some(
      (d) => d.property.startsWith("--") || hasVar(d.value),
    ),
  );
}

// A @keyframes that sets or reads variables cannot be shared: its values depend on
// the object that plays it. This makes a copy for one object, where
// - var() in the frames reads the object's variables (and the math its sibling-index()),
// - a frame that sets --x also sets every property of the object that uses --x.
// The copy is a plain @keyframes: codegen does not know variables exist (decision 55).
function animateVariables(
  styles: Styles,
  variables: Variables,
  context: CalcContext,
  keyframes: Keyframes[],
  number: number,
): { name: Token; keyframes: Keyframes } | null {
  const animation = styles["animation"];
  const name = animation?.[0];
  if (name?.type !== "IDENT") return null;
  // Like in CSS, if two @keyframes have the same name, the last one wins
  const found = keyframes.findLast((k) => k.name === name.value);
  if (!found || !usesVariablesIn(found)) return null;

  const animatable = PROPERTIES.filter((p) => p.animatable).map((p) => p.name);

  const frames = found.frames.map((frame) => {
    const own = frame.declarations.filter((d) => !d.property.startsWith("--"));
    const set = frame.declarations.filter((d) => d.property.startsWith("--"));
    // At this moment of the animation, the variables of the frame win
    const frameVariables: Variables = { ...variables };
    for (const d of set) frameVariables[d.property] = d.value;
    const compute = (property: string, value: Token[]) =>
      colorsOf(
        property,
        resolveMath(resolveVars(value, frameVariables), context),
      );

    // The properties the frame writes itself
    const declarations: Declaration[] = own.map((d) =>
      keepSpan({ ...d, value: compute(d.property, d.value) }, d),
    );

    // The properties of the object that use a variable the frame sets
    const names = new Set(set.map((d) => d.property));
    for (const [property, value] of Object.entries(styles)) {
      if (property.startsWith("--") || own.some((d) => d.property === property))
        continue;
      if (!usesVariables(value, names, variables)) continue;
      if (!animatable.includes(property)) {
        throw errorAt(
          value,
          `${property} cannot be animated, but it uses ${[...names].join(", ")}, which @keyframes ${found.name} animates. Animatable properties: ${animatable.join(", ")}.`,
        );
      }
      declarations.push({ property, value: compute(property, value) });
    }
    return { ...frame, declarations };
  });

  // A name no one can write: the copy never meets a @keyframes of the file
  const copyName = `${found.name} (copy ${number})`;
  const token: Token = { type: "IDENT", value: copyName };
  const span = spanOf(name);
  if (span) rememberSpan(token, span); // an error about it underlines the real name
  return { name: token, keyframes: { name: copyName, frames } };
}

// A computed declaration keeps the position of the one it comes from
function keepSpan(computed: Declaration, from: Declaration): Declaration {
  const span = spanOf(from);
  if (span) rememberSpan(computed, span);
  return computed;
}

// Every value of a set of styles, with calc(), sin(), sibling-index()… computed
function computeMath(styles: Styles, context: CalcContext): Styles {
  const computed: Styles = {};
  for (const [property, value] of Object.entries(styles))
    computed[property] = resolveMath(value, context);
  return computed;
}

// @keyframes are shared by every object that plays them: no sibling-index() in there
function computeKeyframes(keyframes: Keyframes[]): Keyframes[] {
  return keyframes.map((animation) => ({
    ...animation,
    frames: animation.frames.map((frame) => ({
      ...frame,
      declarations: frame.declarations.map((declaration) => {
        const value = colorsOf(
          declaration.property,
          resolveMath(declaration.value, null),
        );
        if (value === declaration.value) return declaration; // nothing computed: same object
        const computed = { ...declaration, value };
        const span = spanOf(declaration);
        if (span) rememberSpan(computed, span); // errors keep pointing at the declaration
        return computed;
      }),
    })),
  }));
}

// The custom properties of a set of styles: { "--size": [2] }
function customProperties(styles: Styles): Variables {
  const variables: Variables = {};
  for (const [property, value] of Object.entries(styles)) {
    if (property.startsWith("--")) variables[property] = value;
  }
  return variables;
}

// Every var() replaced; the custom properties themselves are dropped
function computeVars(styles: Styles, variables: Variables): Styles {
  const computed: Styles = {};
  for (const [property, value] of Object.entries(styles)) {
    if (property.startsWith("--")) continue;
    computed[property] = resolveVars(value, variables);
  }
  return computed;
}

// One value, with rgb(), hsl() and the named colors turned into #rrggbb (decision 58).
// The property is needed: material: gold is a material, color: gold is a color.
function colorsOf(property: string, value: Token[]): Token[] {
  return resolveNamedColors(property, resolveColors(value));
}

// Every value of a set of styles, through colorsOf
function computeColors(styles: Styles): Styles {
  const computed: Styles = {};
  for (const [property, value] of Object.entries(styles))
    computed[property] = colorsOf(property, value);
  return computed;
}

// GSS text → shader only
export function compileGSS(source: string): string {
  return compileScene(source).shader;
}
