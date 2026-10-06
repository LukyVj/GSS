import type { Declaration, Keyframe, Rule, Keyframes } from "../syntax/ast";
import { PROPERTIES, LIGHT_TAKES } from "../registry/core";
import { parseSelector, isSceneSelector, needsHover, needsPointer } from "./resolve";
import { ErrorSink, errorAt } from "../syntax/errors";
import { ANIMATION_LONGHANDS } from "../features/animation";

// Throws if a rule uses a property that is not in the registry,
// or a property that does not apply to what the rule targets.
// errors: keeps every error instead (decision 86), and returns the rules without what
// is wrong: a rule whose selector is wrong, a declaration that is wrong.
export function validateProperties(rules: Rule[], errors?: ErrorSink): Rule[] {
  const sink = errors ?? new ErrorSink();
  const valid: Rule[] = [];
  for (const rule of rules) {
    const declarations = sink.run(() => {
      const selector = parseSelector(rule.selector);
      if (needsPointer(selector) && selector.face !== undefined) {
        const state = needsHover(selector) ? ":hover" : ":active";
        throw errorAt(rule.selector, `A face cannot change on ${state} yet`);
      }
      return rule.declarations.filter(
        (declaration) => sink.run(() => checkDeclaration(rule, declaration)) !== undefined,
      );
    });
    if (declarations) valid.push({ ...rule, declarations });
  }
  if (!errors) sink.throwIfAny();
  return valid;
}

// animation and its longhands: a state can start an animation (decision 141)
const startsAnimation = (name: string) => name === "animation" || ANIMATION_LONGHANDS.includes(name);

// Returns true, or throws the error of the declaration
function checkDeclaration(rule: Rule, declaration: Declaration): true {
  // A custom property (--anything) is valid everywhere, like CSS
  if (declaration.property.startsWith("--")) return true;

  const selector = parseSelector(rule.selector);
  const isScene = isSceneSelector(selector);
  const hover = needsPointer(selector);
  const state = needsHover(selector) ? ":hover" : ":active";
  const property = PROPERTIES.find((p) => p.name === declaration.property);

  if (!property) {
    throw errorAt(declaration, `Unknown property "${declaration.property}"`);
  }

  // transition is not animated, but :hover can set it, like CSS; an animation
  // in a :hover or :active rule starts when the state does (decision 141)
  if (hover && !property.animatable && property.name !== "transition" && !startsAnimation(property.name)) {
    const animatable = PROPERTIES.filter((p) => p.animatable).map((p) => p.name);
    throw errorAt(
      declaration,
      `"${declaration.property}" cannot change on ${state}. Animatable properties: ${animatable.join(", ")}.`,
    );
  }

  if (isScene && property.appliesTo !== "scene" && property.appliesTo !== "everywhere") {
    throw errorAt(declaration, `"${declaration.property}" only applies to objects.`);
  }

  if (!isScene && property.appliesTo === "scene") {
    throw errorAt(declaration, `"${declaration.property}" only applies to the scene.`);
  }

  // A light of @scene takes only a few properties (decision 110)
  if (selector.tag === "light" && !LIGHT_TAKES.includes(property.name) && !Array.isArray(property.appliesTo)) {
    throw errorAt(
      declaration,
      `"${property.name}" does not apply to a light. A light takes: ${LIGHT_TAKES.join(", ")}.`,
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
  return true;
}

// Throws if a @keyframes frame uses a property that is unknown or cannot be animated.
// errors: keeps every error instead, and returns the frames without the wrong declarations.
export function validateKeyframes(keyframes: Keyframes[], errors?: ErrorSink): Keyframes[] {
  const sink = errors ?? new ErrorSink();
  const valid = keyframes.map((animation) => ({
    ...animation,
    frames: animation.frames.map(
      (frame): Keyframe => ({
        ...frame,
        declarations: frame.declarations.filter(
          (declaration) => sink.run(() => checkFrame(animation, declaration)) !== undefined,
        ),
      }),
    ),
  }));
  if (!errors) sink.throwIfAny();
  return valid;
}

// Returns true, or throws the error of the declaration
function checkFrame(animation: Keyframes, declaration: Declaration): true {
  // A variable can be animated: what uses it moves with it (decision 55)
  if (declaration.property.startsWith("--")) return true;

  const property = PROPERTIES.find((p) => p.name === declaration.property);
  if (!property) {
    throw errorAt(
      declaration,
      `Unknown property "${declaration.property}" in @keyframes ${animation.name}`,
    );
  }

  if (!property.animatable) {
    const animatable = PROPERTIES.filter((p) => p.animatable).map((p) => p.name);
    throw errorAt(
      declaration,
      `"${declaration.property}" cannot be animated (in @keyframes ${animation.name}). Animatable properties: ${animatable.join(", ")}.`,
    );
  }
  return true;
}
