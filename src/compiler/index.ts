import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { expandScene } from "./expand";
import { resolveStyles, resolveSceneStyles } from "./resolve";
import { generateShader } from "./codegen";
import { validateProperties, validateKeyframes } from "./validate";
import { readCamera, type CameraSettings } from "./camera";
import { resolveMath, type CalcContext } from "./calc";
import type { Styles } from "./resolve";
import type { Keyframes } from "./ast";
import { rememberSpan, spanOf } from "./errors";
import { resolveVars, type Variables } from "./vars";

// Everything the runtime needs to display a scene
export type CompiledScene = {
  shader: string;
  camera: CameraSettings;
  objects: number; // instances drawn, for the status bar (decision 42)
};

// GSS text → shader + camera settings
// GSS text → shader + camera settings
export function compileScene(source: string): CompiledScene {
  const stylesheet = parse(tokenize(source));
  validateProperties(stylesheet.rules);
  validateKeyframes(stylesheet.keyframes);
  const instances = expandScene(stylesheet.scene);

  // The scene is the root of the variables, like :root in CSS
  const sceneStyles = resolveSceneStyles(stylesheet.rules);
  const rootVariables = customProperties(sceneStyles);

  // The cascade picks the values, then var() is replaced, then the math is computed
  // for each object (decision 52)
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
      styles: computeMath(
        computeVars(instance.styles, seenAt(levels.length - 1)),
        instance,
      ),
      groupStyles: instance.groupStyles.map((styles, g) =>
        computeMath(computeVars(styles, seenAt(g + 1)), instance.groups[g]),
      ),
    };
  });

  const computedScene = computeMath(
    computeVars(sceneStyles, rootVariables),
    null,
  );
  const keyframes = computeKeyframes(stylesheet.keyframes);
  return {
    shader: generateShader(styled, computedScene, keyframes),
    camera: readCamera(computedScene),
    objects: instances.length,
  };
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
        const value = resolveMath(declaration.value, null);
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

// GSS text → shader only
export function compileGSS(source: string): string {
  return compileScene(source).shader;
}
