import logo3d from "../scenes/logo-3d.gss?raw";
import icons from "../scenes/icons.gss?raw";
import spiral from "../scenes/spiral.gss?raw";
import shadertoy from "../scenes/shadertoy.gss?raw";
import hero from "../scenes/hero.gss?raw";
import llm from "../scenes/llm.gss?raw";
import logo from "../scenes/logo.gss?raw";
import orrery from "../scenes/orrery.gss?raw";
import macropad from "../scenes/macropad.gss?raw";
import tidal from "../scenes/todal.gss?raw";
import everything from "../scene.gss?raw";
import ripple from "../scenes/ripple.gss?raw";
import proximity from "../scenes/proximity.gss?raw";
import watch from "../scenes/watch.gss?raw";
import orbit from "../scenes/orbit.gss?raw";
import perfume from "../scenes/perfume.gss?raw";
import starorbit from "../scenes/starorbit.gss?raw";
import steve1 from "../scenes/steve1.gss?raw";
import steve2 from "../scenes/steve2.gss?raw";
import steveHouse from "../scenes/steveHouse.gss?raw";
import stevePortal from "../scenes/stevePortal.gss?raw";
import grass from "../scenes/grass.gss?raw";
import teapot from "../scenes/teapot.gss?raw";
import mistralFour from "../scenes/mistral-four.gss?raw";
import circuit from "../scenes/glass-circuit.gss?raw";
import relic from "../scenes/soft-relic.gss?raw";
import garden from "../scenes/candy-garden.gss?raw";
import bloom from "../scenes/chromatic-bloom.gss?raw";
import burger from "../scenes/zdog-burger.gss?raw";
import character from "../scenes/zdog-character.gss?raw";
import camera from "../scenes/camera-cutaway.gss?raw";
import release from "../scenes/release-005.gss?raw";
import productHunt from "../scenes/product-hunt.gss?raw";
import sunlitRoom from "../scenes/sunlit-room.gss?raw";

import { FIRST_SCENE } from "../docs/guide";
import { formatGss } from "../docs/format";
import { PROPERTIES, SELECTORS } from "../compiler/registry/registry";
export { EMBED_SNIPPETS } from "../embed/snippets";

// What showcase.html shows (decision 63). The scenes are .gss files in src/scenes/:
// gpu.test.ts compiles every one of them, so a demo never breaks in silence.

export type Audience = "designers" | "creative coders" | "developers";

export type UseCase = {
  slug: string;
  audience: Audience;
  title: string;
  pitch: string; // one or two sentences: what it is for, and why GSS
  scene: string; // the GSS of the live scene
  snippet: { lang: "gss" | "html" | "js"; code: string }; // what the reader copies
  features: [label: string, anchor: string][]; // the docs entries it uses
};

export const USE_CASES: UseCase[] = [
  {
    slug: "logo-3d",
    audience: "designers",
    title: "Your SVG logo, in 3D",
    pitch:
      "Paste the d attribute of your logo into path(): the same drawing becomes a tube you can light, turn and animate. No modelling tool, no export.",
    scene: logo3d,
    snippet: {
      lang: "gss",
      code: `#brace-left {\n  d: path("M12.5 4.5C9.5 4.5 9 6 9 8.5v4…");\n  view-box: 0 0 32 32;\n  stroke-width: 2.4;\n}`,
    },
    features: [
      ["path", "shape-path"],
      ["d", "d"],
      ["prism", "shape-prism"],
      ["@keyframes", "at-keyframes"],
    ],
  },
  {
    slug: "icons",
    audience: "designers",
    title: "A 3D icon set, themed like a design system",
    pitch:
      "One stylesheet for the whole set. Change --accent or --finish and every icon follows, like tokens in a design system.",
    scene: icons,
    snippet: {
      lang: "gss",
      code: `scene {\n  --accent: #ff5a36;\n  --finish: jelly(0.55);\n}\n\n.icon {\n  color: var(--accent);\n  material: var(--finish);\n}`,
    },
    features: [
      ["var()", "fn-var"],
      ["material", "material"],
      [":hover", "selector-hover"],
    ],
  },
  {
    slug: "spiral",
    audience: "creative coders",
    title: "Generative loops, without a loop",
    pitch:
      "* 36 makes 36 objects; sibling-index() gives each its own angle, height and hue. The rule is the algorithm.",
    scene: spiral,
    snippet: {
      lang: "gss",
      code: `.bead {\n  --i: sibling-index();\n  translate: calc(-1 * cos(var(--i) * 30deg) * var(--r))\n             calc(var(--i) * 0.09)\n             calc(sin(var(--i) * 30deg) * var(--r));\n  color: hsl(calc(var(--i) * 10) 85% 60%);\n}`,
    },
    features: [
      ["sibling-index()", "fn-sibling-index"],
      ["calc()", "fn-calc"],
      ["sin(), cos()", "fn-trig"],
      ["hsl()", "fn-hsl"],
    ],
  },
  {
    slug: "shadertoy",
    audience: "creative coders",
    title: "Sketch in GSS, publish on Shadertoy",
    pitch:
      "The playground turns any scene into a shader Shadertoy runs as is. Start in CSS, then keep going in GLSL: the GLSL tab shows every line GSS wrote.",
    scene: shadertoy,
    snippet: {
      lang: "gss",
      code: `#ring {\n  material: gold;\n  animation: tumble 7s linear;\n}\n\n@keyframes tumble {\n  to { rotate-x: 1turn; rotate-z: -0.5turn; }\n}`,
    },
    features: [
      ["material", "material"],
      ["animation", "animation"],
      ["@keyframes", "at-keyframes"],
    ],
  },
  {
    slug: "hero",
    audience: "developers",
    title: "An interactive hero, without Three.js",
    pitch:
      "Compile the scene at build time with the Vite plugin: the page ships a 10 kB runtime and one shader. :hover works out of the box.",
    scene: hero,
    snippet: {
      lang: "js",
      code: `import { mount } from "gss-lang/runtime";\nimport hero from "./hero.gss"; // compiled by gss-lang/vite\n\nmount(document.querySelector("canvas"), hero);`,
    },
    features: [
      [":hover", "selector-hover"],
      ["sibling-index()", "fn-sibling-index"],
      ["capsule", "shape-capsule"],
    ],
  },
  {
    slug: "llm",
    audience: "developers",
    title: "3D that an LLM writes well",
    pitch:
      "Every LLM already knows CSS by heart, so it writes GSS without any training; the compiler writes the GLSL. This scene came from a one-line prompt.",
    scene: llm,
    snippet: {
      lang: "html",
      code: `<script type="module" src="https://www.gss-lang.dev/embed.js"></script>\n\n<gss-scene>\n  <script type="text/gss">\n    /* what the model wrote */\n  </script>\n</gss-scene>`,
    },
    features: [
      ["group", "shape-group"],
      ["cone", "shape-cone"],
      ["cylinder", "shape-cylinder"],
    ],
  },
];

// The inspiration grid: captures (public/showcase/<slug>.jpg, npm run captures)
// that open the playground. It grows with every scene worth sharing.
export type Inspiration = { slug: string; title: string; code: string };

const example = (
  list: { name: string; examples: { code: string }[] }[],
  name: string,
  i = 0,
): string => {
  const found = list.find((entry) => entry.name === name)?.examples[i]?.code;
  if (!found) throw new Error(`showcase: no example ${i} for ${name}`);
  return formatGss(found);
};

export const INSPIRATION: Inspiration[] = [
  ...USE_CASES.map(({ slug, title, scene }) => ({ slug, title, code: scene })),
  {
    slug: "first-scene",
    title: "A glass ball that floats",
    code: formatGss(FIRST_SCENE),
  },
  { slug: "logo", title: "The GSS logo, drawn in GSS", code: logo },
  {
    slug: "orrery",
    title: "A fairground planetarium, every feature at once",
    code: orrery,
  },
  { slug: "macropad", title: "A macro pad: keys that press", code: macropad },
  { slug: "tidal", title: "Tidal, a breathing instrument", code: tidal },
  {
    slug: "every-feature",
    title: "Every feature, one zone each",
    code: everything,
  },
  {
    slug: "materials",
    title: "Gold, chrome and metal",
    code: example(PROPERTIES, "material", 1),
  },
  {
    slug: "grass-block",
    title: "A grass block, face by face",
    code: example(SELECTORS, "::face(), ::top, ::bottom", 1),
  },
  {
    slug: "hover-group",
    title: "Hover a group",
    code: example(SELECTORS, ":hover", 1),
  },
  {
    slug: "ripple",
    title: "Ripples, a grid of cells that ripple",
    code: ripple,
  },
  {
    slug: "proximity",
    title: "Proximity falloff (1D steps)",
    code: proximity,
  },
  {
    slug: "watch",
    title: "A watch, with a glass ball and a crown",
    code: watch,
  },
  {
    slug: "orbit",
    title: "An orbiting planet, with a glass ball and a crown",
    code: orbit,
  },
  {
    slug: "perfume",
    title: "A perfume bottle, with a glass ball and a crown",
    code: perfume,
  },
  {
    slug: "starorbit",
    title: "A star orbiting a planet, with a glass ball and a crown",
    code: starorbit,
  },
  {
    slug: "steve1",
    title: "Minecraft Steve animation",
    code: steve1,
  },
  {
    slug: "steve2",
    title: "Minecraft Steve animation with responsive design",
    code: steve2,
  },
  {
    slug: "steve-house",
    title: "Minecraft Steve house animation",
    code: steveHouse,
  },
  {
    slug: "steve-portal",
    title: "Minecraft Steve portal animation",
    code: stevePortal,
  },
  {
    slug: "grass",
    title: "Some grass blades, blowing in the wind",
    code: grass,
  },
  {
    slug: "teapot",
    title: "The Utah teapot: hover lifts the lid, a click hits a speed bump",
    code: teapot,
  },
  {
    slug: "mistral-four",
    title: "Le Chonk: a pixel 4 that falls over when clicked",
    code: mistralFour,
  },
  {
    slug: "product-hunt",
    title: "The Product Hunt mark, a coin under two sweeping lights",
    code: productHunt,
  },
  {
    slug: "sunlit-room",
    title: "A room lit by one shaft of sun, after Maxime Heckel's global illumination study",
    code: sunlitRoom,
  },
];

// The studies (decision 119): longer pieces, shown one at a time in the viewer that
// opens the page (studies.ts). Their words, their list and the first one are prerendered.
export type Study = {
  key: string; // its link: showcase#bloom
  name: string; // in the list of studies
  eyebrow: string;
  title: string; // on two lines
  description: string;
  features: string[]; // what it uses, one chip each
  hint: string; // in the status bar
  scene: string;
  reference?: { href: string; label: string }; // the model it rebuilds
  webgl?: boolean; // mounts on WebGL, for a predictable start
};

export const STUDIES: Study[] = [
  {
    key: "circuit",
    name: "glass circuit",
    eyebrow: "STUDY 01 / MOTION PATHS",
    title: "Glass\nCircuit.",
    description: "A miniature railway in motion.\nA locomotive, two coaches, a tiny station.",
    features: ["offset-path", "offset-rotate", "glass", "animation-delay"],
    hint: "follow the train · drag to orbit",
    scene: circuit,
  },
  {
    key: "relic",
    name: "soft relic",
    eyebrow: "STUDY 02 / SOLID GEOMETRY",
    title: "Soft\nRelic.",
    description: "Seven carved bronze fins.\nA golden star suspended in the aperture.",
    features: ["SVG prisms", "carved aperture", "bronze", "nested motion"],
    hint: "explore the layered silhouette · drag to orbit",
    scene: relic,
  },
  {
    key: "garden",
    name: "candy garden",
    eyebrow: "STUDY 03 / COLOUR & PLAY",
    title: "Candy\nGarden.",
    description: "Striped lollipops, wrapped sweets.\nA miniature confectioner’s garden.",
    features: ["SVG sweets", "conic gradients", "jelly", ":has()"],
    hint: "hover, press, explore · drag to orbit",
    scene: garden,
  },
  {
    key: "bloom",
    name: "chromatic bloom",
    eyebrow: "STUDY 04 / SCROLL",
    title: "Chromatic\nBloom.",
    description: "Twelve metallic petals.\nThe slider unfolds the sculpture.",
    features: ["scroll()", "oklch()", ":hover", ":active"],
    hint: "drag the slider to unfold · hover a petal",
    scene: bloom,
  },
  {
    key: "character",
    name: "high strut · zdog",
    eyebrow: "STUDY 05 / ZDOG RECONSTRUCTION",
    title: "High\nStrut.",
    description: "The original Zdog character.\nSame palette, proportions and articulated pose.",
    features: ["nested groups", "SVG facial contours", "rounded solids"],
    hint: "drag to orbit · hover the face",
    scene: character,
    reference: { href: "https://zzz.dog/modeling#modeling-tutorial", label: "original model: Zdog, by Dave DeSandro ↗" },
    webgl: true,
  },
  {
    key: "burger",
    name: "tasty burger · zdog",
    eyebrow: "STUDY 06 / ZDOG RECONSTRUCTION",
    title: "Tasty\nBurger.",
    description: "Four layers. Five sesame seeds.\nThe slider takes the original construction apart.",
    features: ["hemisphere cut", "rounded volumes", "scroll()"],
    hint: "drag the slider to separate the layers",
    scene: burger,
    reference: { href: "https://zzz.dog/modeling#concepts-stroke-volume", label: "original model: Zdog, by Dave DeSandro ↗" },
    webgl: true,
  },
  {
    key: "camera",
    name: "nikon f · cutaway",
    eyebrow: "STUDY 07 / PRODUCT & CSG",
    title: "Nikon\nStudy.",
    description: "The 1959 Nikon F exterior.\nThe slider opens an illustrative exploded lens.",
    features: ["CSG cavities", "iris blades", "glass", "scroll()"],
    hint: "drag the slider to reveal the optical assembly",
    scene: camera,
    reference: { href: "https://imaging.nikon.com/imaging/information/chronicle/rhnc05f-e/", label: "exterior reference: Nikon ↗" },
    webgl: true,
  },
  {
    key: "release",
    name: "gss 0.0.5 · announcement",
    eyebrow: "STUDY 08 / ANNOUNCEMENT",
    title: "GSS\n0.0.5.",
    description: "A 30-second film, written as a stylesheet.\nThe word types itself, then eight features take the stage.",
    features: ["SVG glyphs", "sibling-index()", "animation-delay", "noise()"],
    hint: "watch the loop · hover the letters · drag to orbit",
    scene: release,
  },
];
