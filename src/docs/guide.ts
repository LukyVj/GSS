import { VERSION, CDN_URL } from "../version";
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
];

export const INSTALLATION: GuideEntry[] = [
  {
    anchor: "embedding",
    label: "Embedding a scene",
    paragraphs: [
      `Current package: <code>gss-lang@${VERSION}</code>. Choose npm, the Vite plugin, or the versioned CDN script below.`,
      'A GSS scene can live on any page, three ways. <b>A tag</b>, with no build step: load <code>embed.js</code> once, then write <code>&lt;gss-scene src="logo.gss"&gt;</code>, or put the code in a <code>&lt;script type="text/gss"&gt;</code> inside it. <b>A function</b>: <code>mount(canvas, source)</code> from the <code>gss-lang</code> package compiles in the page. <b>A build step</b>: with the Vite plugin, <code>import logo from "./logo.gss"</code> compiles at build time, and <code>mount</code> from <code>gss-lang/runtime</code> draws it without shipping the compiler.',
      ...EMBED_SNIPPETS.flatMap((way) => [
        `<b>${escapeHtml(way.title)}</b> (${escapeHtml(way.who)})`,
        `<pre><code class="gss">${highlightCode(way.lang, way.code)}</code></pre>`,
      ]),
      'An embedded scene behaves like the playground: drag turns the camera, the wheel zooms, <code>:hover</code> works. <code>controls="none"</code> (or <code>controls: false</code>) keeps only <code>:hover</code>, so the page scrolls over the scene. It starts when it comes into view, sleeps when it leaves it, and stands still under <code>prefers-reduced-motion</code>. Images are read next to the <code>.gss</code> file, like <code>url()</code> in a stylesheet. GSS has no transparency yet: give the scene the <code>background</code> of your page. See them all live on the <a href="./showcase.html">showcase</a>.',
      'From a script, the <code>scene</code> property of <code>&lt;gss-scene&gt;</code> gives the scene, to <code>pause()</code>, <code>play()</code> or <a href="#set-variables">set its variables</a>, once the element fires <code>load</code>.',
    ],
  },
];

INSTALLATION.push(
  {
    anchor: "install-package",
    label: "Package (npm)",
    paragraphs: [
      `Install <code>gss-lang@${VERSION}</code> in your application. The package includes the compiler, renderer and TypeScript declarations.`,
      `<pre><code class="sh">npm install gss-lang@${VERSION}</code></pre>`,
      `<pre><code class="js">${highlightCode("js", EMBED_SNIPPETS[1].code)}</code></pre>`,
      "Pass an existing canvas element to <code>mount</code>. Use <code>scene.update(source)</code> to replace the scene and <code>scene.destroy()</code> when removing it.",
      'A variable the scene registers with <code>@property</code> is set from the page without compiling again, like a CSS custom property: <code>scene.setProperty("--lift", "2")</code>. See <a href="#set-variables">Set variables from JavaScript</a>.',
    ],
  },
  {
    anchor: "install-vite",
    label: "Vite plugin",
    paragraphs: [
      "The Vite plugin is included in the same package. It compiles .gss imports at build time so the browser only loads the renderer and compiled scene.",
      `<pre><code class="sh">npm install gss-lang@${VERSION}\nnpm install --save-dev vite</code></pre>`,
      `<pre><code class="js">${highlightCode("js", EMBED_SNIPPETS[2].code)}</code></pre>`,
      'For TypeScript, add <code>"gss-lang/client"</code> to <code>compilerOptions.types</code> in tsconfig.json. Use <code>gss-lang/runtime</code> to draw the compiled scene.',
    ],
  },
  {
    anchor: "install-cdn",
    label: "CDN (no build step)",
    paragraphs: [
      `Load the standalone browser module for <code>v${VERSION}</code> from jsDelivr. The version is pinned so updates do not change your scene unexpectedly. No npm install or bundler is needed.`,
      `<pre><code class="html">${highlightCode("html", EMBED_SNIPPETS[0].code)}</code></pre>`,
      `The script registers <code>&lt;gss-scene&gt;</code>. Its URL is <a href="${CDN_URL}">${CDN_URL}</a>. Use a .gss URL in <code>src</code>, or write inline GSS as shown above. Serve the page over HTTP(S).`,
      'To drive the scene from a script, see <a href="#set-variables">Set variables from JavaScript</a>.',
    ],
  },
);

// The live demo of "Set variables from JavaScript": the page shows this code and runs it
// (src/docs/variables-demo.ts). Also checked by the tests: it compiles and registers --lift.
const LIFT_SCENE = [
  '@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; }',
  "@scene { sphere; }",
  "sphere {",
  "  translate: 0 var(--lift) 0;",
  "  radius: 0.5;",
  "  color: oklch(70% 0.17 calc(var(--lift) * 80));",
  "}",
];
const indent = (lines: string[], by: string) => lines.map((line) => by + line).join("\n");
const LIFT_SLIDER = { min: "0.5", max: "1.6", step: "0.01", value: "1" };

const LIFT_HTML = `<gss-scene id="ball" controls="none">
  <script type="text/gss">
${indent(LIFT_SCENE, "    ")}
  </script>
</gss-scene>
<input id="lift" type="range" min="${LIFT_SLIDER.min}" max="${LIFT_SLIDER.max}" step="${LIFT_SLIDER.step}" value="${LIFT_SLIDER.value}">`;

const LIFT_JS = `const ball = document.querySelector("#ball");
const lift = document.querySelector("#lift");

// ball.scene is null until the element fires "load"
const apply = () => ball.scene?.setProperty("--lift", lift.value);
ball.addEventListener("load", apply);
lift.addEventListener("input", apply);`;

const MOUNT_JS = `import { mount, mountAsync } from "gss-lang";

const scene = mount(canvas, source);
scene.setProperty("--lift", "1.5");
scene.getPropertyValue("--lift"); // "1.5"
scene.removeProperty("--lift"); // back to its start value

// mountAsync() gives the same scene, once its backend is ready
const other = await mountAsync(canvas2, source, { backend: "webgpu" });
other.setProperty("--lift", 2);`;

// A table of the docs (dl), kept out of "On this page", which lists an entry's own table
const table = (rows: [string, string][]) =>
  `<div class="guide-table"><dl>${rows.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join("")}</dl></div>`;

INSTALLATION.push({
  anchor: "set-variables",
  label: "Set variables from JavaScript",
  paragraphs: [
    'A variable the scene registers with <a href="#at-property"><code>@property</code></a> is set by the page at any moment, without compiling the scene again, the way <code>element.style.setProperty()</code> sets a CSS custom property. Drive a scene from a slider, the scroll or your data. Move the slider:',
    `<div class="variables-demo">` +
      `<gss-scene controls="none"><script type="text/gss">\n${LIFT_SCENE.join("\n")}\n</script></gss-scene>` +
      `<label><code>--lift</code><input type="range" min="${LIFT_SLIDER.min}" max="${LIFT_SLIDER.max}" step="${LIFT_SLIDER.step}" value="${LIFT_SLIDER.value}" data-property="--lift"><output>${LIFT_SLIDER.value}</output></label>` +
      `</div>`,
    "The demo is this code. The scene registers <code>--lift</code> and reads it in <code>translate</code> and in its color; the page sets it when the slider moves:",
    `<pre><code class="html">${highlightCode("html", LIFT_HTML)}</code></pre>`,
    `<pre><code class="js">${highlightCode("js", LIFT_JS)}</code></pre>`,
    "<b>Three methods</b>, named like those of <code>element.style</code>:",
    table([
      ["setProperty()", 'Sets the variable: <code>scene.setProperty("--lift", "1.5")</code>. The value is a string written like CSS (below); a <code>"&lt;number&gt;"</code> also takes a number.'],
      ["getPropertyValue()", 'Reads it back, written like a computed CSS value: <code>"90deg"</code>, <code>"#ff5a36"</code>. <code>""</code> for a variable the scene does not register.'],
      ["removeProperty()", "Returns to the start value: the one <code>scene { --lift: 2; }</code> gives, or else <code>initial-value</code>."],
    ]),
    "Unlike CSS, which ignores a value it cannot read, <code>setProperty()</code> throws an error for a value that does not match the syntax of the variable, and for a variable the scene does not register: only a registered variable can change while the scene runs. A variable that is not registered (<code>--size: 2</code>) is computed once, when the scene compiles.",
    "<b>The values</b>, by the syntax of the variable:",
    table([
      ['"&lt;number&gt;"', '<code>"2"</code>, <code>"-0.5"</code>, or the number <code>2</code>'],
      ['"&lt;angle&gt;"', '<code>"90deg"</code>, <code>"1.57rad"</code>, <code>"100grad"</code>, <code>"0.25turn"</code>'],
      ['"&lt;percentage&gt;"', '<code>"50%"</code>'],
      ['"&lt;color&gt;"', 'any CSS color: <code>"#ff5a36"</code>, <code>"tomato"</code>, <code>"hsl(10 100% 60%)"</code>, <code>"oklch(70% 0.15 40)"</code>, <code>"color-mix(in oklab, red, blue)"</code>'],
      ['"&lt;length&gt;"', '<code>"4px"</code>, in px only: the radius of <code>blur()</code> and <code>bloom()</code>'],
    ]),
    'The new value is drawn at the next frame, wherever the variable goes: the transforms, the colors, the sizes of the shapes, materials, lights, fog, filters…, alone or inside <code>calc()</code> and the color functions. <a href="#at-property"><code>@property</code></a> lists them all, and what a variable cannot change: what the scene builds when it compiles, like the copies of <code>* n</code>. A value out of its range is kept in it: a size never goes below 0.',
    "<b>From <code>mount()</code></b>: it returns the scene at once, and <code>mountAsync()</code> a promise of it. <code>mount()</code> from <code>gss-lang/runtime</code>, for a scene compiled by the Vite plugin, gives the same methods.",
    `<pre><code class="js">${highlightCode("js", MOUNT_JS)}</code></pre>`,
    "A value set stays when <code>scene.update(source)</code> gives another scene, as long as the new scene registers the variable with the same syntax.",
    '<b>From <code>&lt;gss-scene&gt;</code></b>: its <code>scene</code> property gives the scene, with the same methods. It is <code>null</code> until the element fires <code>"load"</code>, since the scene only starts when it comes near the screen. Set your values when it loads, as the demo does: <code>"load"</code> fires again each time the element starts a new scene (a new <code>src</code>, <code>controls</code> or <code>backend</code>, or the element moved in the page), and a new scene starts from its start values.',
  ],
});
