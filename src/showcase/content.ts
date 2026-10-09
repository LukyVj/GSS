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

// The scenes of the archive, besides the studies (decision 172): captures
// (public/showcase/<slug>.jpg, npm run captures) that open the playground. Each says what
// it is, and the version of GSS it arrived with (its first commit, against the tags).
// The features it uses are read from its code (features.ts). It grows with every scene
// worth sharing.
export type Inspiration = {
  slug: string;
  name: string;
  description: string; // what it is, in a sentence or two
  since: string; // the version of GSS it arrived with: "0.0.6"
  code: string;
};

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
  {
    slug: "logo-3d",
    name: "Logo in 3D",
    description: "The d attribute of an SVG logo pasted into path(): its two braces become tubes around a glossy dot.",
    since: "0.0.1",
    code: logo3d,
  },
  {
    slug: "icons",
    name: "Icon set",
    description: "Five shapes styled as one set. Two variables, an accent and a finish, theme them all, like the tokens of a design system.",
    since: "0.0.1",
    code: icons,
  },
  {
    slug: "spiral",
    name: "Spiral",
    description: "36 beads from one rule: sibling-index() gives each its own angle, height and hue.",
    since: "0.0.1",
    code: spiral,
  },
  {
    slug: "shadertoy",
    name: "Gold ring",
    description: "A gold ring tumbling around an orange core, ready to export as a Shadertoy shader.",
    since: "0.0.1",
    code: shadertoy,
  },
  {
    slug: "hero",
    name: "Hover hero",
    description: "Seven pillars that answer the mouse: a page hero with :hover, compiled at build time.",
    since: "0.0.1",
    code: hero,
  },
  {
    slug: "llm",
    name: "Snowman",
    description: "A snowman an LLM wrote from a one-line prompt, unedited.",
    since: "0.0.1",
    code: llm,
  },
  {
    slug: "first-scene",
    name: "First scene",
    description: "The scene of the first page of the docs: a glass ball that floats up and down.",
    since: "0.0.1",
    code: formatGss(FIRST_SCENE),
  },
  {
    slug: "logo",
    name: "The GSS logo",
    description: "{ ● } drawn in GSS: both braces come from the same SVG, and the dot is a sphere.",
    since: "0.0.1",
    code: logo,
  },
  {
    slug: "orrery",
    name: "L'Orrery",
    description: "A fairground planetarium on a plinth of grass blocks: a sun, five planets, lamps, a mirror pool. Every feature at once.",
    since: "0.0.2",
    code: orrery,
  },
  {
    slug: "macropad",
    name: "Macro pad",
    description: "A product hero in one stylesheet: keys that press, a knob and its level meter, an underglow that breathes.",
    since: "0.0.2",
    code: macropad,
  },
  {
    slug: "tidal",
    name: "Tidal",
    description: "A breathing instrument: petals open and close around a rising pearl, and a marker laps once per breath.",
    since: "0.0.2",
    code: tidal,
  },
  {
    slug: "every-feature",
    name: "Every feature",
    description: "One zone per feature: transforms, operations, animations, materials, shapes, paths and textures.",
    since: "0.0.1",
    code: everything,
  },
  {
    slug: "materials",
    name: "Materials",
    description: "Gold, chrome and metal side by side, from the docs of material.",
    since: "0.0.1",
    code: example(PROPERTIES, "material", 1),
  },
  {
    slug: "grass-block",
    name: "Grass block",
    description: "A block of earth with grass on top: its top face has a texture of its own, with ::top.",
    since: "0.0.1",
    code: example(SELECTORS, "::face(), ::top, ::bottom", 1),
  },
  {
    slug: "hover-group",
    name: "Hover a group",
    description: "Three bars in a group: hover one, and all three turn orange and grow.",
    since: "0.0.1",
    code: example(SELECTORS, ":hover", 1),
  },
  {
    slug: "ripple",
    name: "Ripple pad",
    description: "A grid of 25 cells: the one under the mouse rises, and :has() wakes the rim, the stem and the core.",
    since: "0.0.2",
    code: ripple,
  },
  {
    slug: "proximity",
    name: "Proximity",
    description: "A row of fourteen cells: the one under the mouse grows most, its neighbours less and less.",
    since: "0.0.2",
    code: proximity,
  },
  {
    slug: "watch",
    name: "Mechanical watch",
    description: "A watch as a product shot: a steel case, a dial with its ticks, hands that turn in steps.",
    since: "0.0.2",
    code: watch,
  },
  {
    slug: "orbit",
    name: "Orbit sequencer",
    description: "Sixteen keys around a planet: hover a key and it pops out, its neighbours react and the inner orbit contracts.",
    since: "0.0.2",
    code: orbit,
  },
  {
    slug: "perfume",
    name: "Sillage",
    description: "A perfume configurator: hover a swatch to fill the glass bottle with another fragrance.",
    since: "0.0.2",
    code: perfume,
  },
  {
    slug: "starorbit",
    name: "Star reactor",
    description: "An extruded star in a golden collar, twelve fins and satellites on SVG tracks. Press the star: the whole crown opens.",
    since: "0.0.3",
    code: starorbit,
  },
  {
    slug: "steve1",
    name: "Steve walks",
    description: "A blocky character walking on a strip of grass blocks.",
    since: "0.0.3",
    code: steve1,
  },
  {
    slug: "steve2",
    name: "Steve's island",
    description: "The walk on a wider island, with an oak and flowers, laid out again by @media on a narrow screen.",
    since: "0.0.3",
    code: steve2,
  },
  {
    slug: "steve-house",
    name: "Steve's house",
    description: "A village on an island of grass blocks: a house, trees, a fence and a pond around the walking character.",
    since: "0.0.3",
    code: steveHouse,
  },
  {
    slug: "steve-portal",
    name: "The portal",
    description: "A floating island with a portal and a crystal carved by CSG. Hover the switch, press it: the circuit and the lamps light up.",
    since: "0.0.3",
    code: stevePortal,
  },
  {
    slug: "grass",
    name: "Grass",
    description: "64 tufts of blades, each a prism, blowing in the wind.",
    since: "0.0.4",
    code: grass,
  },
  {
    slug: "teapot",
    name: "Utah teapot",
    description: "A lathe body and lid, a cone spout, a path handle. Hover lifts the lid; a click sends the teapot over a speed bump.",
    since: "0.0.6",
    code: teapot,
  },
  {
    slug: "mistral-four",
    name: "Le Chonk",
    description: "A pixel 4, extruded from a staircase contour. A click tips it over to the left, then onto its back.",
    since: "0.0.6",
    code: mistralFour,
  },
  {
    slug: "product-hunt",
    name: "Product Hunt mark",
    description: "An orange coin with the P of the flat logo pushed out of it, floating under two sweeping lights.",
    since: "0.0.6",
    code: productHunt,
  },
  {
    slug: "sunlit-room",
    name: "Sunlit room",
    description: "A room lit by one shaft of sun, after Maxime Heckel's global illumination study: an orange ball glows on the floor.",
    since: "0.0.6",
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
  capture?: number; // ms of the scene before its poster is taken (npm run captures), 3000 by default
  since: string; // the version of GSS it arrived with, for the archive (decision 172)
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
    since: "0.0.5",
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
    since: "0.0.5",
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
    since: "0.0.5",
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
    since: "0.0.5",
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
    since: "0.0.5",
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
    since: "0.0.5",
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
    since: "0.0.5",
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
    capture: 7000, // "gss." written, the braces closed
    since: "0.0.5",
  },
];
