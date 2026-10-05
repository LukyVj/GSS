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
  since?: string; // the version that added the page, like the entries of the registry
};

// Also checked by the tests: it must compile, on the CPU and on the GPU
export const FIRST_SCENE =
  "@scene { sphere#ball; } " +
  "#ball { translate: 0 1 0; color: #ff5a36; material: glass(1.5, frosted 0.3); animation: float 2s ease-in-out alternate; } " +
  "@keyframes float { from { translate: 0 1 0; } to { translate: 0 1.5 0; } }";

// A table of the docs (dl), kept out of "On this page", which lists an entry's own table
const table = (rows: [string, string][]) =>
  `<div class="guide-table"><dl>${rows.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join("")}</dl></div>`;

export const GETTING_STARTED: GuideEntry[] = [
  {
    anchor: "why-gss",
    label: "Why GSS",
    paragraphs: [
      "Front-end developers already describe how things look with selectors, properties, the cascade and <code>@keyframes</code>. To go 3D, they meet GLSL, the language of the GPU: powerful, but written in distance functions, vectors and math, far from the way they think about design.",
      "GSS bridges that gap. If you can write CSS, you can already read GSS:",
      table([
        ["Selectors", "<code>sphere</code>, <code>.glass</code>, <code>#ball</code>, <code>:hover</code>, <code>:has()</code>, the cascade and <code>!important</code>"],
        ["Properties", "<code>color</code>, <code>translate</code>, <code>opacity</code>, <code>filter</code>, in <code>deg</code>, <code>s</code> and <code>%</code>"],
        ["Motion", "<code>@keyframes</code>, <code>animation</code>, <code>transition</code>, <code>cubic-bezier()</code>"],
        ["Values", "<code>calc()</code>, <code>var()</code>, <code>@property</code>, <code>oklch()</code>, <code>color-mix()</code>"],
        ["Media queries", "<code>@media</code>, <code>prefers-color-scheme</code>, <code>light-dark()</code>"],
      ]),
      "GSS does not replace GLSL. It is a way in: a familiar syntax to start creating in 3D today, and a readable path toward the shader underneath, for those who want to go further.",
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
      "Shapes are declared in <code>@scene</code>, then styled with the rules of a web page: selectors, specificity, units like <code>deg</code> and <code>s</code>, <code>@keyframes</code>. The compiler turns the whole stylesheet into one shader that runs on the GPU.",
      'Next, put the scene on a page with <a href="#embedding">Embedding a scene</a>, or read the reference: each page describes one at-rule, selector, property or function, with examples to try.',
    ],
  },
];

export const INSTALLATION: GuideEntry[] = [
  {
    anchor: "embedding",
    label: "Embedding a scene",
    paragraphs: [
      `A GSS scene runs on any web page, in three ways. All three use the package <code>gss-lang@${VERSION}</code>.`,
      table([
        ['<a href="#install-cdn">A tag</a>', "No build step: load <code>embed.js</code> once, then write <code>&lt;gss-scene&gt;</code>."],
        ['<a href="#install-package">A function</a>', "<code>mount(canvas, source)</code> from <code>gss-lang</code> compiles the scene in the page."],
        ['<a href="#install-vite">A build step</a>', "The Vite plugin compiles <code>.gss</code> files at build time; <code>mount()</code> from <code>gss-lang/runtime</code> draws them without the compiler."],
      ]),
      ...EMBED_SNIPPETS.flatMap((way) => [
        `<h4>${escapeHtml(way.title)}</h4>`,
        `<p class="guide-meta">${escapeHtml(way.who)}</p>`,
        `<pre><code class="gss">${highlightCode(way.lang, way.code)}</code></pre>`,
      ]),
      "<h4>In the page</h4>",
      "An embedded scene behaves like the playground: a drag turns the camera, the wheel zooms, <code>:hover</code> works. With <code>controls=\"none\"</code> (or <code>controls: false</code>), only <code>:hover</code> stays, and the page scrolls over the scene. The scene starts when it comes into view, sleeps when it leaves it, and stands still under <code>prefers-reduced-motion</code>. A scene that does not move draws nothing between two changes (the mouse, a variable, an image that arrives): the GPU rests.",
      'Images are read next to the <code>.gss</code> file, like <code>url()</code> in a stylesheet. The canvas is opaque: give the scene the <code>background</code> of your page. The <a href="./showcase.html">showcase</a> shows them all live.',
      "<h4>From a script</h4>",
      'Once <code>&lt;gss-scene&gt;</code> fires <code>load</code>, its <code>scene</code> property gives the scene, to <code>pause()</code> it, <code>play()</code> it or <a href="#set-variables">set its variables</a>.',
    ],
  },
];

INSTALLATION.push(
  {
    anchor: "install-package",
    label: "Package (npm)",
    paragraphs: [
      `Install <code>gss-lang@${VERSION}</code> in your application. The package holds the compiler, the renderer and the TypeScript declarations.`,
      `<pre><code class="sh">npm install gss-lang@${VERSION}</code></pre>`,
      `<pre><code class="js">${highlightCode("js", EMBED_SNIPPETS[1].code)}</code></pre>`,
      "<code>mount()</code> takes a canvas that is already in the page, and returns the scene: <code>scene.update(source)</code> replaces it, <code>scene.destroy()</code> removes it.",
      'A variable the scene registers with <code>@property</code> can be set from the page without compiling again, like a CSS custom property: <code>scene.setProperty("--lift", "2")</code>. See <a href="#set-variables">Set variables from JavaScript</a>.',
    ],
  },
  {
    anchor: "install-vite",
    label: "Vite plugin",
    paragraphs: [
      "The Vite plugin comes with the package. It compiles the <code>.gss</code> imports at build time, so the browser loads only the renderer and the compiled scene.",
      `<pre><code class="sh">npm install gss-lang@${VERSION}\nnpm install --save-dev vite</code></pre>`,
      `<pre><code class="js">${highlightCode("js", EMBED_SNIPPETS[2].code)}</code></pre>`,
      'With TypeScript, add <code>"gss-lang/client"</code> to <code>compilerOptions.types</code> in <code>tsconfig.json</code>: a <code>.gss</code> import then has a type. Draw the compiled scene with <code>mount()</code> from <code>gss-lang/runtime</code>.',
    ],
  },
  {
    anchor: "install-cdn",
    label: "CDN (no build step)",
    paragraphs: [
      `Load the standalone browser module of <code>v${VERSION}</code> from jsDelivr: no install, no bundler. The version is pinned, so an update never changes your scene unexpectedly.`,
      `<pre><code class="html">${highlightCode("html", EMBED_SNIPPETS[0].code)}</code></pre>`,
      `The script defines <code>&lt;gss-scene&gt;</code>. Point its <code>src</code> to a <code>.gss</code> file, or write the GSS inline, as above. Serve the page over HTTP(S). The module: <a href="${CDN_URL}">${CDN_URL}</a>.`,
      'To drive the scene from a script, see <a href="#set-variables">Set variables from JavaScript</a>.',
      '<code>poster="cover.jpg"</code> shows an image until the scene draws, like the poster of a <code>&lt;video&gt;</code>. On a computer without a graphics card, the processor would draw the scene, slowly enough to freeze the page: <code>&lt;gss-scene&gt;</code> then shows its poster and a button, and draws the scene only when the reader asks. With <code>mount()</code>, <code>softwareRendering()</code>, from <code>gss-lang</code> or <code>gss-lang/runtime</code>, returns <code>true</code> on such a computer, to do the same.',
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

INSTALLATION.push({
  anchor: "set-variables",
  label: "Set variables from JavaScript",
  since: "0.0.4",
  paragraphs: [
    'A variable the scene registers with <a href="#at-property"><code>@property</code></a> can be set by the page at any moment, without compiling the scene again, the way <code>element.style.setProperty()</code> sets a CSS custom property. Drive a scene from a slider, the scroll position or your data. Move the slider:',
    `<div class="variables-demo">` +
      `<gss-scene controls="none"><script type="text/gss">\n${LIFT_SCENE.join("\n")}\n</script></gss-scene>` +
      `<label><code>--lift</code><input type="range" min="${LIFT_SLIDER.min}" max="${LIFT_SLIDER.max}" step="${LIFT_SLIDER.step}" value="${LIFT_SLIDER.value}" data-property="--lift"><output>${LIFT_SLIDER.value}</output></label>` +
      `</div>`,
    "The scene registers <code>--lift</code> and reads it in <code>translate</code> and in its color; the page sets it when the slider moves:",
    `<pre><code class="html">${highlightCode("html", LIFT_HTML)}</code></pre>`,
    `<pre><code class="js">${highlightCode("js", LIFT_JS)}</code></pre>`,
    "<h4>Three methods</h4>",
    "Named like those of <code>element.style</code>:",
    table([
      ["setProperty()", 'Sets the variable: <code>scene.setProperty("--lift", "1.5")</code>. The value is a string written like CSS (below); a <code>"&lt;number&gt;"</code> also takes a number.'],
      ["getPropertyValue()", 'Reads it back, written like a computed CSS value: <code>"90deg"</code>, <code>"#ff5a36"</code>. <code>""</code> for a variable the scene does not register.'],
      ["removeProperty()", "Returns to the start value: the one <code>scene { --lift: 2; }</code> gives, or else <code>initial-value</code>."],
    ]),
    "Unlike CSS, which ignores a value it cannot read, <code>setProperty()</code> throws an error for a value that does not match the syntax of the variable, and for a variable the scene does not register. Only a registered variable changes while the scene runs: an unregistered one (<code>--size: 2</code>) is computed once, when the scene compiles.",
    "<h4>Values</h4>",
    "The value is written by the syntax of the variable:",
    table([
      ['"&lt;number&gt;"', '<code>"2"</code>, <code>"-0.5"</code>, or the number <code>2</code>'],
      ['"&lt;angle&gt;"', '<code>"90deg"</code>, <code>"1.57rad"</code>, <code>"100grad"</code>, <code>"0.25turn"</code>'],
      ['"&lt;percentage&gt;"', '<code>"50%"</code>'],
      ['"&lt;color&gt;"', 'any CSS color: <code>"#ff5a36"</code>, <code>"tomato"</code>, <code>"hsl(10 100% 60%)"</code>, <code>"oklch(70% 0.15 40)"</code>, <code>"color-mix(in oklab, red, blue)"</code>'],
      ['"&lt;length&gt;"', '<code>"4px"</code>, in px only: the radius of <code>blur()</code> and <code>bloom()</code>'],
    ]),
    'The new value is drawn at the next frame, wherever the variable goes: transforms, colors, sizes, materials, lights, fog, filters, alone or inside <code>calc()</code> and the color functions. A value out of its range is kept in it: a size never goes below 0. <a href="#at-property"><code>@property</code></a> lists what a variable can change, and what it cannot: what the scene builds when it compiles, like the copies of <code>* n</code>.',
    "<h4>From <code>mount()</code></h4>",
    "<code>mount()</code> returns the scene at once, <code>mountAsync()</code> a promise of it. <code>mount()</code> from <code>gss-lang/runtime</code>, for a scene compiled by the Vite plugin, has the same methods.",
    `<pre><code class="js">${highlightCode("js", MOUNT_JS)}</code></pre>`,
    "A value set this way stays when <code>scene.update(source)</code> gives another scene, as long as the new scene registers the variable with the same syntax.",
    "<h4>In the playground</h4>",
    'With <code>@property-panel { display: open; }</code> in the scene, the playground, and Try it under the examples of these docs, show a panel over the render with a control for each registered variable: a slider and its number, or a color picker for a <code>"&lt;color&gt;"</code>. It calls <code>setProperty()</code> as it moves, and its reset button calls <code>removeProperty()</code>. A page that embeds the scene shows no panel. See <a href="#at-property-panel"><code>@property-panel</code></a>.',
    "<h4>From <code>&lt;gss-scene&gt;</code></h4>",
    'Its <code>scene</code> property gives the scene, with the same methods. It is <code>null</code> until the element fires <code>"load"</code>, since the scene only starts when it comes near the screen. Set your values on <code>"load"</code>, as the demo does: it fires again each time the element starts a new scene (a new <code>src</code>, <code>controls</code> or <code>backend</code>, or the element moved in the page), and a new scene starts from its start values.',
  ],
});

// The editor extension has its own version, published apart from the package
const EXTENSION_ID = "lukyvj.gss-language";
const MARKETPLACE_URL = `https://marketplace.visualstudio.com/items?itemName=${EXTENSION_ID}`;
const OPEN_VSX_URL = "https://open-vsx.org/extension/lukyvj/gss-language";

INSTALLATION.push({
  anchor: "editor-support",
  label: "Editor support",
  paragraphs: [
    "The GSS extension colors and formats <code>.gss</code> files in VS Code and in the editors built on it, like Cursor, VSCodium and Windsurf. It is not needed to run a scene.",
    table([
      ["Highlighting", "Selectors, properties, values, colors, numbers and units, the at-rules, nested rules and <code>&amp;</code>."],
      ["Formatting", "<em>Format Document</em>, or saving the file, writes the code in the style of these docs: one shape per line in <code>@scene</code>, one declaration per line, two-space indentation, comments kept."],
      ["File icon", "<code>.gss</code> files get the GSS icon in the explorer."],
    ]),
    "<h4>Install</h4>",
    `In VS Code, open the Extensions view (<code>Ctrl+Shift+X</code>, or <code>Cmd+Shift+X</code> on a Mac), search for <em>GSS</em> and install <em>GSS — GPU Style Sheets</em>. Or install it from the <a href="${MARKETPLACE_URL}">Visual Studio Marketplace</a>, or from the command line:`,
    `<pre><code class="sh">code --install-extension ${EXTENSION_ID}</code></pre>`,
    `Cursor, VSCodium and Windsurf install their extensions from <a href="${OPEN_VSX_URL}">Open VSX</a>: search for <em>GSS</em> in their Extensions view.`,
    "<h4>Format on save</h4>",
    "Formatting on save is on by default for <code>.gss</code> files. To turn it off, add this to your <code>settings.json</code>:",
    `<pre><code class="js">${highlightCode("js", '"[gss]": { "editor.formatOnSave": false }')}</code></pre>`,
  ],
});
