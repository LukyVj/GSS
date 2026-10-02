// Animated values: @keyframes and :hover written as GLSL expressions of iTime and uHover[]
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { type Easing, stepsShape } from "../../values/easing";
import { readAnimation, type AnimationSpec } from "../../features/animation";
import { timelineCode, type Timeline } from "../../features/timeline";
import { glslFloat, round, type Hover } from "./glsl";
import { liveRead } from "./properties";

// The objects that can be hovered, in scene order: each one gets a slot in uHover[]
export function hoverSlots(instances: StyledInstance[]): StyledInstance[] {
  return instances.filter((instance) => instance.hoverTriggers.length > 0);
}

// The objects that can be pressed (:active): their slots come after the hover slots
export function activeSlots(instances: StyledInstance[]): StyledInstance[] {
  return instances.filter((instance) => instance.activeTriggers.length > 0);
}

// A property at rest, or mixed with its hovered value when :hover changes it,
// then with its pressed value when :active changes it further
export function hoverValue(
  styles: Styles,
  keyframes: Keyframes[],
  property: string,
  read: (value: Token[] | undefined) => string,
  hover?: Hover,
): string {
  const rest = animatedValue(styles, keyframes, property, read);
  let value = rest;
  let target = rest; // the value of the state below this layer
  for (const layer of hover ?? []) {
    const next = animatedValue(layer.styles, keyframes, property, read);
    if (next !== target) value = `mix(${value}, ${next}, uHover[${layer.slot}])`;
    target = next; // a layer that changes nothing more is left out
  }
  return value;
}

// The timelines of the scene being generated: scroll() and view() (decision 96)
let timelines: Timeline[] = [];
export function useTimelines(list: Timeline[]): void {
  timelines = list;
}

const DIRECTION_NUMBERS = {
  normal: 0,
  reverse: 1,
  alternate: 2,
  "alternate-reverse": 3,
};
// Infinity in GLSL: more iterations than any scene will ever play
const FOREVER = 1e9;

// How the shader plays an animation: the progress (0 to 1) in the current iteration,
// and when the animation shows at all (null: always). Without a delay, a count or a
// direction other than alternate, the expressions are the ones GSS always wrote.
function playback(spec: AnimationSpec): {
  progress: string;
  active: string | null;
} {
  const { duration, delay, iterations, direction, fill } = spec;
  // scroll(), view(): the progress of the timeline is the whole animation, like CSS.
  // The duration and the delay do not count; infinite (the GSS default) plays once.
  if (spec.timeline) {
    const at = timelineCode(spec.timeline, timelines);
    const n = iterations === Infinity ? 1 : iterations;
    if (n === 1 && direction === "normal") return { progress: at, active: null };
    if (n === 1 && direction === "reverse") return { progress: `(1.0 - ${at})`, active: null };
    return {
      progress: `playhead(${at} * ${glslFloat(n)}, 1.0, ${glslFloat(n)}, ${DIRECTION_NUMBERS[direction]})`,
      active: null,
    };
  }
  const plain = delay === 0 && iterations === Infinity;
  const time = `iTime / ${glslFloat(duration)}`;
  if (plain && direction === "normal")
    return { progress: `fract(${time})`, active: null }; // 0 → 1, 0 → 1 …
  if (plain && direction === "alternate")
    return { progress: `(1.0 - abs(mod(${time}, 2.0) - 1.0))`, active: null }; // 0 → 1 → 0 …

  const t =
    delay === 0
      ? "iTime"
      : delay > 0
        ? `iTime - ${glslFloat(delay)}`
        : `iTime + ${glslFloat(-delay)}`;
  const n = iterations === Infinity ? FOREVER : iterations;
  const progress = `playhead(${t}, ${glslFloat(duration)}, ${glslFloat(n)}, ${DIRECTION_NUMBERS[direction]})`;

  // Like CSS: outside the animation, the object's own value, unless the fill mode
  // holds the first frame (backwards) during the delay or the last one (forwards) after
  const conditions: string[] = [];
  const holdsBefore = delay <= 0 || fill === "backwards" || fill === "both";
  const holdsAfter =
    iterations === Infinity || fill === "forwards" || fill === "both";
  if (!holdsBefore) conditions.push(`iTime >= ${glslFloat(delay)}`);
  if (!holdsAfter)
    conditions.push(`iTime < ${glslFloat(round(delay + iterations * duration))}`);
  return {
    progress,
    active: conditions.length > 0 ? conditions.join(" && ") : null,
  };
}

// An easing in GLSL. No easing, or a straight line: the progress itself.
export function easingCode(easing: Easing | null, progress: string): string {
  if (!easing) return progress;
  if (easing.type === "cubic-bezier") {
    const { x1, y1, x2, y2 } = easing;
    // ease-in-out stays a smoothstep, close to the CSS curve and much cheaper:
    // the scenes written before cubic-bezier() keep their exact motion
    if (x1 === 0.42 && y1 === 0 && x2 === 0.58 && y2 === 1)
      return `smoothstep(0.0, 1.0, ${progress})`;
    const handles = [x1, y1, x2, y2].map(glslFloat).join(", ");
    return `cubicBezier(${progress}, vec4(${handles}))`;
  }
  // steps(): the progress snapped to its jumps
  if (easing.type === "steps") {
    const { jumps, offset } = stepsShape(easing);
    const n = glslFloat(easing.count);
    const floor = offset ? `floor(${progress} * ${n}) + 1.0` : `floor(${progress} * ${n})`;
    return `(min(${floor}, ${glslFloat(jumps)}) / ${glslFloat(jumps)})`;
  }
  // linear(): the first output, plus what each segment adds once it has started
  const { points } = easing;
  const straight =
    points.length === 2 &&
    points[0].input === 0 &&
    points[0].output === 0 &&
    points[1].input === 1 &&
    points[1].output === 1;
  if (straight) return progress;
  let code = glslFloat(points[0].output);
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const rise = to.output - from.output;
    if (rise === 0) continue; // a flat segment adds nothing
    const along =
      to.input === from.input
        ? `step(${glslFloat(from.input)}, ${progress})` // a jump
        : `clamp((${progress} - ${glslFloat(from.input)}) / ${glslFloat(to.input - from.input)}, 0.0, 1.0)`;
    code += ` + ${glslFloat(rise)} * ${along}`;
  }
  return `(${code})`;
}

// from → 0, to → 1, 50% → 0.5
function readOffset(token: Token, name: string): number {
  if (token.type === "IDENT" && token.value === "from") return 0;
  if (token.type === "IDENT" && token.value === "to") return 1;
  if (token.type === "PERCENTAGE" && token.value >= 0 && token.value <= 100) {
    return token.value / 100;
  }
  throw errorAt(
    token,
    `@keyframes ${name}: expected from, to or a percentage between 0% and 100%`,
  );
}

// A property's value: fixed, or changing over time with the animation.
// "read" turns the GSS value into GLSL (readTranslate, readScale, readColor…)
export function animatedValue(
  styles: Styles,
  keyframes: Keyframes[],
  property: string,
  read: (value: Token[] | undefined) => string,
): string {
  read = liveRead(property, read); // a variable set from JS (decision 105)
  const own = read(styles[property]);
  const animation = readAnimation(styles);
  if (!animation) return own;

  const { name } = animation;
  // Like in CSS, if two @keyframes have the same name, the last one wins
  const found = keyframes.findLast((k) => k.name === name.value);
  if (!found) throw errorAt(name, `No @keyframes named "${name.value}"`);

  // Every moment where the animation sets this property
  const byOffset = new Map<number, string>();
  for (const frame of found.frames) {
    const declaration = frame.declarations.find((d) => d.property === property);
    if (!declaration) continue; // this frame animates something else
    for (const token of frame.offsets) {
      // Same offset twice: the last one wins, like in CSS
      byOffset.set(readOffset(token, found.name), read(declaration.value));
    }
  }
  if (byOffset.size === 0) return own; // this animation does not touch this property

  // Like in CSS, a missing 0% or 100% uses the object's own value
  if (!byOffset.has(0)) byOffset.set(0, own);
  if (!byOffset.has(1)) byOffset.set(1, own);
  const stops = [...byOffset]
    .map(([offset, value]) => ({ offset, value }))
    .sort((a, b) => a.offset - b.offset);

  // Chain of mix: each segment takes over when the previous one is done
  const { progress, active } = playback(animation);
  let result = stops[0].value;
  for (let i = 1; i < stops.length; i++) {
    const start = stops[i - 1].offset;
    const length = round(stops[i].offset - start);
    const local = `clamp((${progress} - ${glslFloat(start)}) / ${glslFloat(length)}, 0.0, 1.0)`;
    let weight = easingCode(animation.easing, local);
    // Before its segment starts, local is 0: an easing that is not 0 there (steps() with
    // jump-start, linear(0.5, 1)…) must wait for its segment, or it covers the ones before
    if (i > 1 && animation.easing && !startsAtZero(animation.easing))
      weight = `${weight} * step(${glslFloat(start)}, ${progress})`;
    result = `mix(${result}, ${stops[i].value}, ${weight})`;
  }
  return active ? `((${active}) ? ${result} : ${own})` : result;
}

// An easing whose progress is 0 at the start of its segment
export function startsAtZero(easing: Easing): boolean {
  if (easing.type === "steps") return stepsShape(easing).offset === 0;
  if (easing.type === "linear") return easing.points[0].output === 0;
  return true; // a cubic-bezier() always starts at (0, 0)
}
