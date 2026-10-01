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
      code: `.bead {\n  --i: sibling-index();\n  translate: calc(cos(var(--i) * 30deg) * var(--r))\n             calc(var(--i) * 0.09)\n             calc(sin(var(--i) * 30deg) * var(--r));\n  color: hsl(calc(var(--i) * 10) 85% 60%);\n}`,
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
      code: `#ring {\n  material: gold;\n  animation: tumble 7s linear;\n}\n\n@keyframes tumble {\n  to { rotate-x: 1turn; rotate-z: 0.5turn; }\n}`,
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
  list: { name: string; examples: string[] }[],
  name: string,
  i = 0,
): string => {
  const found = list.find((entry) => entry.name === name)?.examples[i];
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
];
