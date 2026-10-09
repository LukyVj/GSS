import "./styles/gss-code.css";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { createRendererAsync } from "./runtime/renderer";
import { elementMedia } from "./runtime/media";
import { renderGate } from "./runtime/software-gate";
import type { Backend } from "./runtime/backend";
import { connectEditor, theme } from "./runtime/editor";
import { glslLanguage } from "./runtime/glsl";
import { htmlLanguage } from "./runtime/html-language";
import { encodeCode, decodeCode, decodeHtml } from "./runtime/share";
import { postOnXUrl } from "./playground/post-on-x";
import { track } from "./analytics/track";
import { compileGSS, compileScene } from "./compiler";
import { toShadertoy } from "./compiler/shader/shadertoy";
import { EXAMPLES, renderExampleOptions } from "./playground/examples";
import { statusParts, fpsText } from "./runtime/status";
import { mountSearch } from "./docs/search-box";
import { profile, profileWebGPU, mountPanel } from "./profiler/panel";
import { mountSplitter } from "./playground/splitter";
import { mountVariablesPanel } from "./playground/variables-panel";
import { mountViewChips } from "./playground/view-chips";

mountSearch();

// The playground: the GSS editor (or the GLSL it becomes) on the left, the scene on the right.
const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

const query = new URLSearchParams(location.search);
const requested = query.get("backend");
const backend: Backend =
  requested === "webgl" || requested === "webgpu" ? requested : "auto";
const backendSelect = $<HTMLSelectElement>("#backend");
let currentSource: (() => string) | undefined;
backendSelect.value = backend;
backendSelect.addEventListener("change", async () => {
  const url = new URL(location.href);
  url.searchParams.set("backend", backendSelect.value);
  if (currentSource) url.hash = await encodeCode(currentSource(), html);
  location.assign(url.href);
});

// ----- The separator between the editor and the scene (decision 123) -----

// On a phone (the same query as the CSS), the editor sits under the scene: its height
const phone = matchMedia("(max-width: 720px)");
const splitter = mountSplitter({
  root: document.body,
  handle: $(".splitter"),
  axis: () => (phone.matches ? "y" : "x"),
  track: () => {
    if (!phone.matches) return { start: 0, end: innerWidth, length: innerWidth };
    const start = $(".topbar").getBoundingClientRect().bottom;
    const end = $(".statusbar").getBoundingClientRect().top;
    return { start, end, length: end - start };
  },
});
addEventListener("resize", splitter.update);
phone.addEventListener("change", splitter.update);

// A shared link opens its scene, and the HTML of its element(#id); otherwise the first example
const start = (await decodeCode(location.hash)) ?? EXAMPLES[0].code;
let html = await decodeHtml(location.hash);
// The HTML lives inside the canvas: element(#id) draws it there (decision 101)
const sceneCanvas = $<HTMLCanvasElement>("#scene");
sceneCanvas.innerHTML = html;
// element(#id) and paint() are drawn with WebGL2 for now: auto picks it for such a scene
// (decisions 101, 151)
const showsHtml = (code: string) => /\belement\(/.test(code);
const paints = (code: string) => /\bpaint\(/.test(code);
const renderer = await createRendererAsync(sceneCanvas, {
  backend: backend === "auto" && (html || showsHtml(start) || paints(start)) ? "webgl" : backend,
  profile,
  profileWebGPU,
  scrollSlider: true, // the playground does not scroll: a slider stands in for scroll()
  viewport: elementMedia, // @media reads the size of the render, like the result of CodePen (decision 165)
  dprPicker: true, // a menu over the render: the dpr, auto follows the frame rate (decision 120)
}).catch((error) => {
  $("#error").textContent =
    error instanceof Error ? error.message : String(error);
  $("#error").hidden = false;
  throw error;
});
// Without a GPU, nothing is drawn before the reader's click (decision 137); too heavy, the
// scene stops and waits for one too (decision 142)
renderGate(sceneCanvas, renderer);
mountPanel($(".statusbar"));
backendSelect.title = `Rendering with ${renderer.backend === "webgpu" ? "WebGPU" : "WebGL2"}`;
$<HTMLCanvasElement>("#scene").addEventListener("gss-error", (event) => {
  const error = (event as CustomEvent).detail;
  $("#error").textContent =
    error instanceof Error ? error.message : String(error);
  $("#error").hidden = false;
});

const editor = connectEditor(
  { host: $("#code"), error: $("#error") },
  renderer,
  start,
);
currentSource = editor.getCode;

// ----- The panel of variables: a control per @property, set live (decisions 127, 128) -----

const variables = mountVariablesPanel(document.body, renderer);
editor.onCompile((_code, compiled) => variables.update(compiled.properties, compiled.propertyPanel));

// ----- The chips of the view: shaded, or the isolines of the distance field (decision 131) -----

const chips = mountViewChips(document.body, { setView: renderer.setView, refresh: editor.refresh }, sceneCanvas);
editor.onCompile((_code, compiled) => chips.update(compiled));

// ----- The status bar: the numbers of the last compile, and the frame rate -----

const stats = $("#stats");
editor.onStats((current) => {
  const parts = statusParts(current).map((text) => {
    const part = document.createElement("span");
    part.textContent = text;
    return part;
  });
  stats.replaceChildren(...parts);
  stats.classList.toggle("error", current.errors > 0);
});

const fps = $("#fps");
renderer.sampleFrames(); // start counting now
setInterval(() => {
  const { frames, ms } = renderer.sampleFrames();
  fps.textContent = fpsText(frames, ms);
}, 1000);

// ----- The URL follows the code, so the address bar is always a share link -----

async function followUrl(code: string): Promise<void> {
  const hash = await encodeCode(code, html);
  if (editor.getCode() === code) history.replaceState(null, "", hash); // still the same code?
}
editor.onCompile(followUrl);

// element(#id) or paint() on WebGPU: the object keeps its color, so say how to see it
const notice = $("#notice");
editor.onCompile((code) => {
  const webglOnly = showsHtml(code) ? "element()" : paints(code) ? "paint()" : null;
  notice.hidden = !(renderer.backend === "webgpu" && webglOnly);
  notice.textContent = `${webglOnly} is WebGL2 only for now: choose WebGL2 in the backend menu`;
});

// ----- The HTML tab: the elements that element(#id) shows (decision 101) -----

const htmlEditor = new EditorView({
  parent: $("#html"),
  state: EditorState.create({
    doc: html,
    extensions: [
      lineNumbers(),
      htmlLanguage,
      theme,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        html = update.state.doc.toString();
        sceneCanvas.innerHTML = html; // a paint follows, and the texture with it
        void followUrl(editor.getCode());
      }),
    ],
  }),
});
$("#html").classList.add("gss-dark");
function setHtml(next: string): void {
  htmlEditor.dispatch({ changes: { from: 0, to: htmlEditor.state.doc.length, insert: next } });
}

// A link pasted in the address bar of this tab
window.addEventListener("hashchange", async () => {
  const code = await decodeCode(location.hash);
  const nextHtml = await decodeHtml(location.hash);
  if (nextHtml !== html) setHtml(nextHtml);
  if (code !== null && code !== editor.getCode()) editor.setCode(code);
});

const shareButton = $<HTMLButtonElement>("#share");
const postOnX = $<HTMLAnchorElement>("#post-on-x");
let hidePostOnX = 0;
shareButton.addEventListener("click", async () => {
  history.replaceState(null, "", await encodeCode(editor.getCode(), html));
  try {
    await navigator.clipboard.writeText(location.href);
    shareButton.textContent = "link copied";
  } catch {
    shareButton.textContent = "link in the address bar"; // the clipboard was refused
  }
  setTimeout(() => (shareButton.textContent = "share"), 2000);
  // The link is in the clipboard (or in the address bar); the status bar offers to post it on X, for a while
  postOnX.href = postOnXUrl(location.href);
  postOnX.hidden = false;
  clearTimeout(hidePostOnX);
  hidePostOnX = window.setTimeout(() => (postOnX.hidden = true), 15000);
});
postOnX.addEventListener("click", () => track("playground-share-x"));

// ----- The examples menu -----

const examples = $<HTMLSelectElement>("#examples");
examples.insertAdjacentHTML("beforeend", renderExampleOptions());
examples.addEventListener("change", () => {
  const example = EXAMPLES[Number(examples.value)];
  setHtml(example.html ?? ""); // an example is a whole scene: its HTML, or none
  editor.setCode(example.code); // Cmd/Ctrl+Z brings the previous code back
  examples.value = ""; // back to "Examples…", so the same example can be picked again
});

// ----- The export to Shadertoy button -----

// Shadertoy cannot receive code from a link (and the shader is too long for a URL):
// we copy it, in Shadertoy's format, and open a new shader where it can be pasted.
const exportToShadertoyButton = $<HTMLButtonElement>("#export-to-shadertoy");
exportToShadertoyButton.addEventListener("click", async () => {
  let shader: string;
  try {
    shader = toShadertoy(compileScene(editor.getCode()));
  } catch (error) {
    exportToShadertoyButton.textContent = (error as Error).message; // e.g. too many images
    setTimeout(
      () => (exportToShadertoyButton.textContent = "→ shadertoy"),
      4000,
    );
    return;
  }
  await navigator.clipboard.writeText(shader);
  window.open("https://www.shadertoy.com/new", "_blank");
  exportToShadertoyButton.textContent = "copied, paste it in shadertoy";
  setTimeout(() => (exportToShadertoyButton.textContent = "→ shadertoy"), 4000);
});

// ----- The GLSL tab: the shader the GSS becomes, read-only -----

const glsl = new EditorView({
  parent: $("#glsl"),
  state: EditorState.create({
    extensions: [
      lineNumbers(),
      glslLanguage, // the palette of GSS code, so both tabs look alike
      theme, // the same editor chrome as the GSS tab
      EditorState.readOnly.of(true),
    ],
  }),
});

$("#glsl").classList.add("gss-dark"); // the color variables of src/styles/gss-code.css

function showGlsl(code: string): void {
  let shader: string;
  try {
    shader = compileGSS(code, tab === "wgsl" ? "wgsl" : "glsl");
  } catch {
    return;
  } // the GSS editor already displays errors of unfinished code
  glsl.dispatch({
    changes: { from: 0, to: glsl.state.doc.length, insert: shader },
  });
}

let tab: "gss" | "html" | "glsl" | "wgsl" = "gss";
const shaderTab = () => tab === "glsl" || tab === "wgsl";
editor.onCompile((code) => {
  if (shaderTab()) showGlsl(code);
});

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-tab]",
)) {
  button.addEventListener("click", () => {
    tab = button.dataset.tab as typeof tab;
    $("#code").hidden = tab !== "gss";
    $("#html").hidden = tab !== "html";
    $("#glsl").hidden = !shaderTab();
    for (const other of document.querySelectorAll("[data-tab]")) {
      other.setAttribute("aria-selected", String(other === button));
    }
    if (shaderTab()) showGlsl(editor.getCode());
  });
}
