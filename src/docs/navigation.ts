// Editorial structure only: content remains in the registry. Lower order comes
// first; entries with no override sort alphabetically. Anchors remain stable.
export type NavEntry = { anchor: string; label: string; html: string; order?: number };
export type NavGroup = {
  id: string;
  title: string;
  category: string;
  order: number;
  anchors: string[];
};
export const ENTRY_ORDER: Record<string, number> = {
  "why-gss": -20,
  "first-scene": -10,
  embedding: -40,
  "install-package": -30,
  "install-vite": -20,
  "install-cdn": -10,
  "set-variables": 0,
  "editor-support": 10,
  "selector-type": -60,
  "selector-class": -50,
  "selector-id": -40,
  "selector-universal": -30,
  "selector-list": -20,
  "selector-descendant": -10,
  "selector-child": -9,
  "selector-adjacent": -8,
  "selector-sibling": -7,
  "selector-nesting": -6,
  "selector-hover": -60,
  "selector-active": -50,
  "selector-has": -40,
  "selector-not": -30,
  "selector-nth-child": -20,
  "selector-nth-of-type": -19,
  "selector-first-child": -18,
  "selector-face": -10,
  color: -10,
  "fn-rgb": -60,
  "fn-hsl": -59,
  "fn-hwb": -58,
  "fn-lab-lch": -57,
  "fn-oklab-oklch": -56,
  "fn-color": -55,
  "fn-color-mix": -50,
  "fn-light-dark": -40,
  "fn-contrast-color": -39,
  "fn-gradients": -10,
  animation: -10,
  "fn-calc": -10,
  // Lighting: the sun, the point lights, how much light they give, then what fills the rest
  light: -60,
  "shape-light": -50,
  intensity: -40,
  ambient: -30,
  shadows: -20,
  fog: -10,
};
export const DOC_GROUPS: NavGroup[] = [
  { id: "getting-started", title: "Getting started", category: "Start here", order: 0, anchors: ["why-gss", "first-scene"] },
  { id: "installation", title: "Installation", category: "Start here", order: 1, anchors: ["embedding", "install-package", "install-vite", "install-cdn", "set-variables", "editor-support"] },
  { id: "at-rules", title: "At-rules", category: "Language", order: 10, anchors: ["at-scene", "at-media", "at-keyframes", "at-property", "at-property-panel"] },
  { id: "selectors", title: "Selectors", category: "Language", order: 11, anchors: ["selector-type", "selector-class", "selector-id", "selector-universal", "selector-list", "selector-nesting", "selector-important"] },
  { id: "combinators", title: "Combinators", category: "Language", order: 12, anchors: ["selector-descendant", "selector-child", "selector-adjacent", "selector-sibling"] },
  { id: "pseudo-classes", title: "Pseudo-classes", category: "Language", order: 13, anchors: ["selector-hover", "selector-active", "selector-has", "selector-not", "selector-nth-child", "selector-nth-of-type", "selector-first-child", "selector-face"] },
  { id: "variables-conditions", title: "Variables and conditions", category: "Language", order: 14, anchors: ["fn-var", "fn-if"] },
  { id: "values", title: "Math", category: "Language", order: 15, anchors: ["fn-calc", "fn-trig", "fn-inverse-trig", "fn-min-max-clamp", "fn-abs-sqrt-pow", "fn-stepped", "fn-exponential", "fn-progress", "fn-random", "fn-sibling-index", "fn-sibling-count"] },
  { id: "shapes", title: "Shapes and groups", category: "Structure", order: 20, anchors: ["shape-cube", "shape-sphere", "shape-torus", "shape-cylinder", "shape-cone", "shape-capsule", "shape-plane", "shape-path", "shape-prism", "shape-lathe", "shape-group"] },
  { id: "object-properties", title: "Geometry", category: "Structure", order: 21, anchors: ["size", "radius", "height", "depth", "thickness", "corner-radius", "d", "view-box", "stroke-width"] },
  { id: "combinations", title: "Combinations", category: "Structure", order: 22, anchors: ["operation", "blend"] },
  { id: "colors", title: "Colors", category: "Appearance", order: 30, anchors: ["color", "background", "background-blend-mode", "floor"] },
  { id: "color-functions", title: "Color functions", category: "Appearance", order: 31, anchors: ["fn-rgb", "fn-hsl", "fn-hwb", "fn-lab-lch", "fn-oklab-oklch", "fn-color", "fn-color-mix", "fn-light-dark", "fn-contrast-color", "fn-currentcolor"] },
  { id: "gradients", title: "Gradients and noise", category: "Appearance", order: 32, anchors: ["fn-gradients", "fn-noise", "fn-displace"] },
  { id: "materials", title: "Materials", category: "Appearance", order: 33, anchors: ["material"] },
  { id: "textures", title: "Textures", category: "Appearance", order: 34, anchors: ["texture", "fn-element", "texture-size", "image-rendering"] },
  { id: "filters", title: "Filters", category: "Appearance", order: 35, anchors: ["filter"] },
  { id: "masks", title: "Opacity and masks", category: "Appearance", order: 36, anchors: ["opacity", "mask-image", "mask-mode"] },
  { id: "transforms", title: "Transforms", category: "Motion", order: 40, anchors: ["translate", "rotate-x", "rotate-y", "rotate-z", "scale", "transform-origin", "offset-path", "offset-distance", "offset-rotate"] },
  { id: "animations", title: "Animation and transitions", category: "Motion", order: 41, anchors: ["animation", "animation-duration", "animation-delay", "animation-iteration-count", "animation-direction", "animation-fill-mode", "animation-timing-function", "animation-timeline", "transition"] },
  { id: "easings", title: "Easings", category: "Motion", order: 42, anchors: ["fn-cubic-bezier", "fn-linear", "fn-steps"] },
  { id: "camera", title: "Camera", category: "Scene", order: 50, anchors: ["camera-target", "camera-distance", "camera-angle", "camera-spin"] },
  { id: "scene-properties", title: "Lighting and fog", category: "Scene", order: 51, anchors: ["light", "shape-light", "intensity", "ambient", "fog", "shadows"] },
  { id: "rendering", title: "Rendering", category: "Scene", order: 52, anchors: ["dpr", "shape-rendering", "view"] },
];

// Two entries share a name (the sun is the light property, a point light is an element of
// @scene): the contents and the title of each page say which one it is
export const QUALIFIERS: Record<string, string> = { light: "sun", "shape-light": "point" };
export const qualified = (anchor: string, label: string) =>
  QUALIFIERS[anchor] ? `${label} (${QUALIFIERS[anchor]})` : label;

export function sortEntries(entries: NavEntry[]): NavEntry[] {
  return [...entries].sort((a, b) =>
    (a.order ?? ENTRY_ORDER[a.anchor] ?? 0) - (b.order ?? ENTRY_ORDER[b.anchor] ?? 0) ||
    a.label.localeCompare(b.label, "en", { sensitivity: "base", numeric: true }),
  );
}

export function groupEntries(entries: NavEntry[]) {
  const assigned = new Set<string>();
  const groups = [...DOC_GROUPS].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const sections = groups.map((group) => {
    const selected = entries.filter((entry) => group.anchors.includes(entry.anchor));
    selected.forEach((entry) => assigned.add(entry.anchor));
    return { ...group, entries: sortEntries(selected) };
  }).filter((group) => group.entries.length);
  // A new registry entry remains reachable before it receives an editorial group.
  const remaining = entries.filter((entry) => !assigned.has(entry.anchor));
  if (remaining.length) sections.push({ id: "other-reference", title: "Other reference", category: "Reference", order: 100, anchors: [], entries: sortEntries(remaining) });
  return sections;
}
