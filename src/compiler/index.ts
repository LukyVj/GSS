import { tokenize } from "./syntax/tokenizer";
import { parse } from "./syntax/parser";
import { expandScene } from "./cascade/expand";
import { resolveStyles, resolveSceneStyles, FACES, type Face } from "./cascade/resolve";
import { activeSlots, generateShader, hoverSlots, sceneTriggers, type Trigger } from "./shader/codegen";
import { validateProperties, validateKeyframes } from "./cascade/validate";
import { readCamera, type CameraSettings } from "./features/camera";
import { resolveMath, type CalcContext } from "./values/calc";
import type { StyledInstance, Styles } from "./cascade/resolve";
import type { Declaration, Keyframes, Stylesheet } from "./syntax/ast";
import type { Token } from "./syntax/tokenizer";
import { ErrorSink, errorAt, rememberSpan, spanOf } from "./syntax/errors";
import { resolveVars, usesVariables, hasVar, type Variables } from "./cascade/vars";
import { mediaQueriesOf, resolveIf } from "./values/conditionals";
import { refuseInColor, resolveCurrentColor } from "./values/current-color";
import { sceneTimelines, type Timeline } from "./features/timeline";
import { PROPERTIES } from "./registry/core";
import {
  type ColorScheme,
  DARK_QUERY,
  resolveColors,
  resolveNamedColors,
  MATERIAL_FUNCTIONS,
} from "./values/colors";
import { sceneTextures } from "./features/textures";
import { readDpr, type Dpr } from "./features/dpr";
import { readView, type View } from "./features/view";
import { readTransition, type Transition } from "./features/transition";
import { buildPasses, FILTER_FUNCTIONS, objectFilters, readSceneSteps, type Pass } from "./features/filter";
import { generateWGSL } from "./shader/wgsl";
import { GRADIENT_FUNCTIONS } from "./shader/gradient";
import {
  propertyFloats,
  propertyToken,
  readPropertyPanel,
  readPropertyRules,
  type PropertyPanel,
  type RegisteredProperty,
} from "./features/properties";

// view: replaces the view of the scene in the shader, like the chips of the playground (decision 131)
export type CompileOptions = { target?: "glsl" | "dual"; view?: View };
export type { Trigger };

// Everything the runtime needs to display a scene
export type CompiledScene = {
  shader: string;
  // The WebGPU target; shader stays GLSL for existing integrations and Shadertoy.
  wgsl?: string;
  camera: CameraSettings;
  dpr: Dpr;
  objects: number; // instances drawn, for the status bar (decision 42)
  textures: string[]; // the image files the runtime loads, once each
  hover: number[][]; // for each slot of uHover[], the ids that, hovered, set it to 1
  // :active (decision 95): for each slot after the hover slots, the ids that, pressed,
  // set it to 1. Absent when no rule uses :active.
  active?: number[][];
  // scroll() and view() (decision 96): what each component of uTimeline follows.
  // Absent when every animation runs on time.
  timelines?: Timeline[];
  // filter: the passes drawn after the scene, when a filter reads its neighbours (decision 83)
  passes?: Pass[];
  // @property (decision 105): the variables the page sets from JS, in the order of
  // uProperties[], with the 4 floats each starts from. Absent when there is none.
  properties?: RegisteredProperty[];
  // @property-panel (decision 128): the playground and Try it show a control per variable,
  // open or folded at the start. Absent without the rule, or with display: none.
  propertyPanel?: PropertyPanel;
  // view (decision 131): the view the code asks for, absent when it is shaded. The shader
  // draws the view of the compile option instead, when there is one.
  view?: "distance";
  // @media: the queries, and the scene for every combination of them. variants[mask]
  // is the scene when the queries whose bit is set in mask match (bit 0: queries[0]).
  // The fields above are variants[0], the scene when none matches.
  media?: { queries: string[]; variants: CompiledScene[] };
  // for each slot of uHover[] (hover, then active), how it glides to 1 (enter) and back to 0 (leave)
  transitions: { enter: Transition | null; leave: Transition | null }[];
  // The states that start an animation (decision 141): the slot, its index in
  // uStart[], and how long the state holds in seconds (null: until the next start).
  // Absent when no state starts one.
  triggers?: Trigger[];
};

// The most @media queries a scene can use: 2^4 = 16 versions of it are compiled
const MAX_QUERIES = 4;

// GSS text → shader + camera settings, and a version per combination of @media
// A compile reports every error it finds, not only the first one (decision 86): every
// error of the text first; once the text reads, every error of the values.
export function compileScene(source: string, options: CompileOptions = {}): CompiledScene {
  const compiled = compileSource(source, options.view);
  if (options.target === "glsl") return compiled;
  const lower = (scene: CompiledScene): CompiledScene => ({
    ...scene,
    wgsl: generateWGSL(scene.shader),
    ...(scene.passes && { passes: scene.passes.map(pass => ({ ...pass, wgsl: generateWGSL(pass.shader) })) }),
  });
  return {
    ...lower(compiled),
    ...(compiled.media && { media: { queries: compiled.media.queries, variants: compiled.media.variants.map(lower) } }),
  };
}

function compileSource(source: string, view?: View): CompiledScene {
  const errors = new ErrorSink();
  const tokens = tokenize(source, errors);
  const stylesheet = parse(tokens, errors);
  // An error in the text: what comes after would mostly report its consequences
  errors.throwIfAny();
  // light-dark() needs a version of the scene per color scheme, like this @media query
  const lightDark = tokens.some(
    (token, i) =>
      token.type === "IDENT" &&
      token.value === "light-dark" &&
      tokens[i + 1]?.type === "PUNCT" &&
      tokens[i + 1].value === "(",
  );
  const queries = [
    ...new Set([
      ...stylesheet.rules.flatMap((rule) => (rule.media ? [rule.media] : [])),
      ...(lightDark ? [DARK_QUERY] : []),
      ...mediaQueriesOf(tokens),
    ]),
  ];
  if (queries.length === 0) return compileStylesheet(stylesheet, new Set(), view);
  if (queries.length > MAX_QUERIES) {
    const extra = stylesheet.rules.find(
      (rule) => rule.media === queries[MAX_QUERIES],
    )!;
    throw errorAt(
      extra.selector,
      `A scene takes at most ${MAX_QUERIES} different @media queries (here: ${queries.length}): GSS prepares a version of the scene for every combination`,
    );
  }
  // Like CSS, a rule inside a matching @media joins the cascade where it is written
  const variants = Array.from({ length: 2 ** queries.length }, (_, mask) =>
    errors.run(() => compileStylesheet(
      {
        ...stylesheet,
        rules: stylesheet.rules.filter(
          (rule) =>
            !rule.media || (mask & (1 << queries.indexOf(rule.media))) !== 0,
        ),
      },
      new Set(queries.filter((_, n) => (mask & (1 << n)) !== 0)),
      view,
    )),
  );
  // The same error in several versions of the scene is reported once
  errors.throwIfAny();
  const compiled = variants as CompiledScene[];
  return { ...compiled[0], media: { queries, variants: compiled } };
}

// One version of the scene: the rules that apply, compiled
function compileStylesheet(
  stylesheet: Stylesheet,
  media: Set<string> = new Set(),
  viewOption?: View,
): CompiledScene {
  activeMedia = media;
  // Every error of this version; a part that fails is left out, and the rest goes on
  const errors = new ErrorSink();
  // Without the wrong rules and declarations: they are reported once, here
  stylesheet = {
    ...stylesheet,
    rules: validateProperties(stylesheet.rules, errors),
    keyframes: validateKeyframes(stylesheet.keyframes, errors),
  };
  const instances = errors.run(() => expandScene(stylesheet.scene)) ?? [];

  // The scene is the root of the variables, like :root in CSS
  const sceneStyles = errors.run(() => resolveSceneStyles(stylesheet.rules)) ?? {};
  // @property (decision 105): each registered variable reads its uniform; the scene gives
  // its start value, or its initial-value does
  const registered = errors.run(() => registeredProperties(stylesheet, sceneStyles)) ?? [];
  const panel = errors.run(() => readPropertyPanel(stylesheet.panels));
  const live: Variables = Object.fromEntries(registered.map((p, i) => [p.name, [propertyToken(p, i)]]));
  const rootVariables = { ...customProperties(sceneStyles), ...live };

  // The copies of @keyframes made for one object, when they use variables (decision 55)
  const copies: Keyframes[] = [];

  // One object or one group: var() replaced, then the math, with its own variables
  function computeNode(
    styles: Styles,
    variables: Variables,
    context: CalcContext,
  ): Styles {
    const computed = computeColors(
      computeMath(
        resolveCurrentColor(computeVars(styles, variables), "object"),
        context,
      ),
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
  const resolved = errors.run(() => resolveStyles(instances, stylesheet.rules)) ?? [];
  const styled = resolved.flatMap((instance) => {
    // An object with an error is reported, and the others are still computed
    const computed = errors.run(() => computeInstance(instance));
    return computed ? [computed] : [];
  });
  function computeInstance(instance: (typeof resolved)[number]) {
    // A registered variable has one value for the whole scene (decision 105)
    for (const styles of [
      instance.styles,
      instance.hoverStyles,
      instance.activeStyles,
      ...instance.groupStyles,
      ...FACES.map((face) => instance.faceStyles[face]),
    ])
      for (const name of Object.keys(live)) if (styles[name]) throw oneValue(name, styles[name]);
    // Level 0 = the scene, 1… = the groups from the outside in, last = the object
    const levels = [
      rootVariables,
      ...instance.groupStyles.map(customProperties),
      customProperties(instance.styles),
    ];
    // The variables seen at level n: every level from 0 to n, the closest one wins
    const seenAt = (n: number): Variables =>
      Object.assign({}, ...levels.slice(0, n + 1));

    // The hover state has its own variables, cube:hover { --c: red; },
    // on top of what the scene and the groups give
    const hoverVariables: Variables = {
      ...seenAt(levels.length - 2),
      ...customProperties(instance.hoverStyles),
    };
    // Pressed: the :active rules on top of the :hover ones, with their variables
    const activeVariables: Variables = {
      ...seenAt(levels.length - 2),
      ...customProperties(instance.activeStyles),
    };

    return {
      ...instance,
      styles: computeNode(instance.styles, seenAt(levels.length - 1), instance),
      hoverStyles: computeNode(instance.hoverStyles, hoverVariables, instance),
      activeStyles: computeNode(instance.activeStyles, activeVariables, instance),
      groupStyles: instance.groupStyles.map((styles, g) =>
        computeNode(styles, seenAt(g + 1), instance.groups[g]),
      ),
      // The faces use the object's variables: cube::top { texture: var(--top); }
      faceStyles: Object.fromEntries(
        FACES.map((face) => [
          face,
          computeNode(
            instance.faceStyles[face],
            seenAt(levels.length - 1),
            instance,
          ),
        ]),
      ) as Record<Face, Styles>,
    };
  }

  const computedScene =
    errors.run(() => {
      const computed = computeColors(
        computeMath(
          resolveCurrentColor(computeVars(sceneStyles, rootVariables), "scene"),
          null,
        ),
      );
      // The scene plays an animation too: its background, and its variables (decision 103)
      checkSceneAnimation(sceneStyles, stylesheet.keyframes);
      const copy = animateVariables(sceneStyles, rootVariables, null, stylesheet.keyframes, copies.length + 1);
      if (!copy) return computed;
      copies.push(copy.keyframes);
      return { ...computed, animation: [copy.name, ...computed["animation"].slice(1)] };
    }) ?? {};
  // @keyframes with variables are only played through their copies
  const shared = computeKeyframes(
    stylesheet.keyframes.filter((k) => !usesVariablesIn(k)),
    errors,
  );
  // What is drawn: the lights of @scene light the objects, but are never drawn (decision 110)
  const drawn = styled.filter((instance) => instance.tag !== "light");
  // filter: the layers of the objects first, then the scene (decisions 83, 84)
  const passes = errors.run(
    () =>
      buildPasses(
        objectFilters(drawn).layers,
        computedScene["filter"] ? readSceneSteps(computedScene["filter"]) : [],
      ).passes,
  );
  const view = errors.run(() => readView(computedScene));
  const shader = checkedShader(styled, computedScene, [...shared, ...copies], errors, registered.length, viewOption ?? view);
  const camera = errors.run(() => readCamera(computedScene));
  const dpr = errors.run(() => readDpr(computedScene));
  // After the cascade and var(): the texture an object really ends up with
  const textures = errors.run(() => sceneTextures(drawn));
  // Like CSS: the transition of the state the object goes to
  // Pressing takes the transition of :active, releasing the one of the hovered state
  const transitions = errors.run(() => [
    ...hoverSlots(styled).map((instance) => ({
      enter: readTransition(instance.hoverStyles["transition"]),
      leave: readTransition(instance.styles["transition"]),
    })),
    ...activeSlots(styled).map((instance) => ({
      enter: readTransition(instance.activeStyles["transition"]),
      leave: readTransition(instance.hoverStyles["transition"]),
    })),
  ]);
  const active = activeSlots(styled).map((instance) => instance.activeTriggers);
  const triggers = errors.run(() => sceneTriggers(styled));
  const timelines = errors.run(() =>
    sceneTimelines([computedScene, ...styled.flatMap((instance) => [...instance.groupStyles, instance.styles])]),
  );
  errors.throwIfAny();
  return {
    ...(passes!.length > 0
      ? {
          passes: passes!.map((pass) =>
            withProperties(pass, registered.length, hoverSlots(styled).length + active.length, timelines!.length > 0, triggers!.length),
          ),
        }
      : {}),
    ...(registered.length > 0 ? { properties: registered } : {}),
    ...(panel ? { propertyPanel: panel } : {}),
    ...(view === "distance" ? { view } : {}),
    shader: shader!,
    camera: camera!,
    dpr: dpr!,
    objects: instances.filter((instance) => instance.tag !== "light").length,
    textures: textures!,
    hover: hoverSlots(styled).map((instance) => instance.hoverTriggers),
    ...(active.length > 0 ? { active } : {}),
    ...(timelines!.length > 0 ? { timelines } : {}),
    transitions: transitions!,
    ...(triggers!.length > 0 ? { triggers } : {}),
  };
}

// The shader of the scene. When it fails, each object is compiled on its own (and the
// scene without objects), so every object with an error is reported, not only the first.
function checkedShader(
  styled: StyledInstance[],
  sceneStyles: Styles,
  keyframes: Keyframes[],
  errors: ErrorSink,
  properties: number,
  view: View = "shaded",
): string | undefined {
  const whole = new ErrorSink();
  const shader = whole.run(() => generateShader(styled, sceneStyles, keyframes, properties, view));
  if (shader !== undefined) return shader;
  const before = errors.size;
  errors.run(() => generateShader([], sceneStyles, keyframes, properties, view));
  for (const instance of styled)
    errors.run(() => generateShader([instance], sceneStyles, keyframes, properties, view));
  // An error that needs several objects together: the one the whole scene gave
  if (errors.size === before) whole.list.forEach((error) => errors.add(error));
  return undefined;
}

// A pass of filter that reads a variable set from JS declares the uniforms of the scene
// before it, in the same order: its WGSL then reads them where the scene writes them, in
// the buffer they share (decision 105). The other passes stay as they were.
function withProperties(pass: Pass, properties: number, slots: number, timeline: boolean, starts: number): Pass {
  if (!pass.shader.includes("uProperties")) return pass;
  const uniforms = [
    ...(starts > 0 ? [`uniform float uStart[${starts}];`] : []),
    ...(slots > 0 ? [`uniform float uHover[${slots}];`] : []),
    ...(timeline ? ["uniform vec4 uTimeline;"] : []),
    `uniform vec4 uProperties[${properties}]; // @property: the variables set from JS`,
  ];
  return { ...pass, shader: pass.shader.replace("uniform sampler2D uInput0;", `${uniforms.join("\n")}\nuniform sampler2D uInput0;`) };
}

// The variables registered with @property (decision 105), with the 4 floats each starts
// from: the value the scene gives it, or its initial-value. A frame cannot set one.
function registeredProperties(stylesheet: Stylesheet, sceneStyles: Styles): RegisteredProperty[] {
  const rules = readPropertyRules(stylesheet.properties);
  for (const animation of stylesheet.keyframes)
    for (const frame of animation.frames)
      for (const d of frame.declarations)
        if (rules.some((rule) => rule.name === d.property)) throw oneValue(d.property, d);
  const variables = customProperties(sceneStyles);
  return rules.map((rule) => {
    const start = sceneStyles[rule.name];
    const value = start ? resolveIf(resolveVars(start, variables), variables, activeMedia) : rule.initial;
    const computed = colorsOf(rule.syntax === "color" ? "color" : "", resolveMath(value, null));
    const what = start ? `${rule.name} on the scene` : `the initial-value of ${rule.name}`;
    return { name: rule.name, syntax: rule.syntax, initial: propertyFloats(rule.syntax, computed, what) };
  });
}

function oneValue(name: string, at: object): Error {
  return errorAt(at, `${name} is registered with @property: it has one value for the whole scene, set on scene or from JS`);
}

// The properties a registered variable can go in, for now (decision 105): those the
// shader already computes at every frame
export const LIVE_PROPERTIES = [
  "translate",
  "filter",
  "material",
  "blend",
  "floor",
  "ambient",
  "light",
  "rotate-x",
  "rotate-y",
  "rotate-z",
  "scale",
  "transform-origin",
  "color",
  "offset-distance",
  "offset-rotate",
  "camera-target",
  "size",
  "radius",
  "thickness",
  "height",
  "corner-radius",
  "stroke-width",
  "depth",
  "texture-size",
  "background",
  "fog",
  "intensity",
  "mask-image",
  "opacity",
];

function refuseLive(property: string, value: Token[]): void {
  const token = value.find((t) => t.type === "EXPR");
  if (!token) return;
  if (!LIVE_PROPERTIES.includes(property))
    throw errorAt(
      value,
      `${token.value} is set from JS, and ${property} is read when the scene compiles. A variable set from JS can go in ${LIVE_PROPERTIES.slice(0, -1).join(", ")} and ${LIVE_PROPERTIES.at(-1)}`,
    );
}

// Once the math and the colors are computed: the math around a registered variable is
// written in GLSL (calc.ts); any other function around it does not read it yet
// The functions that read a registered variable themselves: gradients, materials
const LIVE_FUNCTIONS = [...GRADIENT_FUNCTIONS, ...MATERIAL_FUNCTIONS, ...FILTER_FUNCTIONS];

function refuseLiveCalls(value: Token[]): Token[] {
  const token = value.find((t) => t.type === "EXPR");
  const call = value.findIndex(
    (t, i) =>
      t.type === "IDENT" &&
      !LIVE_FUNCTIONS.includes(t.value) &&
      value[i + 1]?.type === "PUNCT" &&
      value[i + 1].value === "(",
  );
  if (token && call >= 0)
    throw errorAt(value, `${token.value} is set from JS: it cannot go inside ${(value[call] as { value: string }).value}() yet`);
  return value;
}

// Does a @keyframes block set a variable, or read one?
function usesVariablesIn(animation: Keyframes): boolean {
  return animation.frames.some((frame) =>
    frame.declarations.some(
      (d) => d.property.startsWith("--") || hasVar(d.value),
    ),
  );
}

// On the scene, an animation changes the background, the fog, the sun and variables,
// nothing else: the other properties of a frame belong to objects (decisions 103, 108, 110)
function checkSceneAnimation(styles: Styles, keyframes: Keyframes[]): void {
  const name = styles["animation"]?.[0];
  if (name?.type !== "IDENT") return;
  const found = keyframes.findLast((k) => k.name === name.value);
  for (const frame of found?.frames ?? [])
    for (const declaration of frame.declarations)
      if (!["background", "fog", "light"].includes(declaration.property) && !declaration.property.startsWith("--"))
        throw errorAt(
          declaration,
          `On the scene, an animation only changes background, fog, light and variables: ${declaration.property} is a property of objects (in @keyframes ${found!.name})`,
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
    const compute = (property: string, value: Token[]) => {
      const resolved = resolveIf(resolveVars(value, frameVariables), frameVariables, activeMedia);
      refuseLive(property, resolved);
      refuseInColor(property, resolved);
      return refuseLiveCalls(colorsOf(property, resolveMath(resolved, context, property)));
    };

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
    computed[property] = resolveMath(value, context, property);
  return computed;
}

// @keyframes are shared by every object that plays them: no sibling-index() in there.
// A @keyframes with an error is reported and left out.
function computeKeyframes(keyframes: Keyframes[], errors: ErrorSink): Keyframes[] {
  return keyframes.flatMap((animation) => errors.run(() => [computeAnimation(animation)]) ?? []);
}

function computeAnimation(animation: Keyframes): Keyframes {
  return {
    ...animation,
    frames: animation.frames.map((frame) => ({
      ...frame,
      declarations: frame.declarations.map((declaration) => {
        refuseInColor(declaration.property, declaration.value);
        const value = colorsOf(
          declaration.property,
          resolveMath(
            resolveIf(declaration.value, {}, activeMedia),
            null,
            declaration.property,
          ),
        );
        if (value === declaration.value) return declaration; // nothing computed: same object
        const computed = { ...declaration, value };
        const span = spanOf(declaration);
        if (span) rememberSpan(computed, span); // errors keep pointing at the declaration
        return computed;
      }),
    })),
  };
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
    computed[property] = resolveIf(resolveVars(value, variables), variables, activeMedia);
    refuseLive(property, computed[property]);
  }
  return computed;
}

// One value, with rgb(), hsl() and the named colors turned into #rrggbb (decision 58).
// The property is needed: material: gold is a material, color: gold is a color.
function colorsOf(property: string, value: Token[]): Token[] {
  const scheme: ColorScheme = activeMedia.has(DARK_QUERY) ? "dark" : "light";
  // The color of an object, the layers of background and mask-image can be transparent,
  // nothing else (decisions 112, 113, 117)
  const alpha = property === "color" || property === "background" || property === "mask-image";
  return resolveNamedColors(property, resolveColors(value, scheme, alpha));
}
// The queries true in the version being compiled: read by light-dark() (decision 79)
// and the media() of if() (decision 81)
let activeMedia = new Set<string>();

// Every value of a set of styles, through colorsOf
function computeColors(styles: Styles): Styles {
  const computed: Styles = {};
  for (const [property, value] of Object.entries(styles))
    computed[property] = refuseLiveCalls(colorsOf(property, value));
  return computed;
}

// GSS text → shader only
export function compileGSS(source: string, target: "glsl" | "wgsl" = "glsl"): string {
  const scene = compileScene(source, { target: target === "glsl" ? "glsl" : "dual" });
  return target === "wgsl" ? scene.wgsl! : scene.shader;
}
