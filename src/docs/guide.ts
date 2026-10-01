import { EMBED_SNIPPETS } from "../embed/snippets";
import { escapeHtml } from "./escape";
import { highlightCode } from "./highlight-code";

// The "Getting started" section of the docs: written by hand, unlike the reference,
// which is generated from the registry. The paragraphs are trusted HTML.

export type GuideEntry = {
  anchor: string; // the id of the entry, and the target of its link in the table of contents
  label: string;
  paragraphs: string[];
  example?: string; // shown with a "Try it" button, like the reference examples
  after?: string[]; // paragraphs under the example
};

// Also checked by the tests: it must compile, on the CPU and on the GPU
export const FIRST_SCENE =
  "@scene { sphere#ball; } " +
  "#ball { translate: 0 1 0; color: #ff5a36; material: glass(1.5, frosted 0.3); animation: float 2s ease-in-out alternate; } " +
  "@keyframes float { from { translate: 0 1 0; } to { translate: 0 1.5 0; } }";

export const GETTING_STARTED: GuideEntry[] = [
  {
    anchor: "why-gss",
    label: "Why GSS",
    paragraphs: [
      "Front-end developers already know how to describe what things look like: selectors, properties, the cascade, <code>@keyframes</code>. But the moment they want to go 3D and become creative developers, they hit GLSL, the language of the GPU. It is powerful, but it is written in distance functions, vectors and math, and it has little in common with the way they think about design.",
      "GSS bridges that gap. If you can write CSS, you can already read GSS.",
      "GSS is not meant to replace GLSL. It is a way in: a familiar syntax to start creating in 3D today, and a readable path toward the shader underneath, for those who want to go further.",
    ],
  },
  {
    anchor: "first-scene",
    label: "Your first scene",
    paragraphs: [
      "A glass ball that floats above the floor. Press <em>Try it</em> to edit it live.",
    ],
    example: FIRST_SCENE,
    after: [
      "Shapes are declared in <code>@scene</code>, then styled with the same rules as a web page: specificity, classes and ids, units like <code>deg</code> and <code>s</code>, <code>@keyframes</code>. The compiler turns all of it into a single GLSL shader that runs on the GPU.",
      "Every property and at-rule is described below, each with examples you can try.",
    ],
  },
  {
    anchor: "embedding",
    label: "Embedding a scene",
    paragraphs: [
      'A GSS scene can live on any page, three ways. <b>A tag</b>, with no build step: load <code>embed.js</code> once, then write <code>&lt;gss-scene src="logo.gss"&gt;</code>, or put the code in a <code>&lt;script type="text/gss"&gt;</code> inside it. <b>A function</b>: <code>mount(canvas, source)</code> from the <code>gss-lang</code> package compiles in the page. <b>A build step</b>: with the Vite plugin, <code>import logo from "./logo.gss"</code> compiles at build time, and <code>mount</code> from <code>gss-lang/runtime</code> draws it without shipping the compiler (about 10 kB).',
      ...EMBED_SNIPPETS.flatMap((way) => [
        `<b>${escapeHtml(way.title)}</b> (${escapeHtml(way.who)})`,
        `<pre><code class="gss">${highlightCode(way.lang, way.code)}</code></pre>`,
      ]),
      'An embedded scene behaves like the playground: drag turns the camera, the wheel zooms, <code>:hover</code> works. <code>controls="none"</code> (or <code>controls: false</code>) keeps only <code>:hover</code>, so the page scrolls over the scene. It starts when it comes into view, sleeps when it leaves it, and stands still under <code>prefers-reduced-motion</code>. Images are read next to the <code>.gss</code> file, like <code>url()</code> in a stylesheet. GSS has no transparency yet: give the scene the <code>background</code> of your page. See them all live on the <a href="./showcase.html">showcase</a>.',
    ],
  },
];
