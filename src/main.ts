import "./styles/gss-code.css";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { createRendererAsync } from "./runtime/renderer";
import type { Backend } from "./runtime/backend";
import { connectEditor, theme } from "./runtime/editor";
import { glslLanguage } from "./runtime/glsl";
import { encodeCode, decodeCode } from "./runtime/share";
import { compileGSS, compileScene } from "./compiler";
import { toShadertoy } from "./compiler/shader/shadertoy";
import { EXAMPLES, renderExampleOptions } from "./playground/examples";
import { statusParts, fpsText } from "./runtime/status";
import { mountSearch } from "./docs/search-box";
import { profile, profileWebGPU, mountPanel } from "./profiler/panel";

mountSearch();

// The playground: the GSS editor (or the GLSL it becomes) on the left, the scene on the right.
const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

const query = new URLSearchParams(location.search);
const requested = query.get("backend");
const backend: Backend = requested === "webgl" || requested === "webgpu" ? requested : "auto";
const backendSelect = $<HTMLSelectElement>("#backend");
let currentSource: (() => string) | undefined;
backendSelect.value = backend;
backendSelect.addEventListener("change", async () => {
  const url = new URL(location.href);
  url.searchParams.set("backend", backendSelect.value);
  if (currentSource) url.hash = await encodeCode(currentSource());
  location.assign(url.href);
});
const renderer = await createRendererAsync($<HTMLCanvasElement>("#scene"), {
  backend,
  profile,
  profileWebGPU,
}).catch(error => {
  $("#error").textContent = error instanceof Error ? error.message : String(error);
  $("#error").hidden = false;
  throw error;
});
mountPanel($(".statusbar"));
backendSelect.title = `Rendering with ${renderer.backend === "webgpu" ? "WebGPU" : "WebGL2"}`;
$<HTMLCanvasElement>("#scene").addEventListener("gss-error", event => {
  const error = (event as CustomEvent).detail;
  $("#error").textContent = error instanceof Error ? error.message : String(error);
  $("#error").hidden = false;
});

// A shared link opens its scene; otherwise the first example
const start = (await decodeCode(location.hash)) ?? EXAMPLES[0].code;

const editor = connectEditor(
  { host: $("#code"), error: $("#error") },
  renderer,
  start,
);
currentSource = editor.getCode;

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

editor.onCompile(async (code) => {
  const hash = await encodeCode(code);
  if (editor.getCode() === code) history.replaceState(null, "", hash); // still the same code?
});

// A link pasted in the address bar of this tab
window.addEventListener("hashchange", async () => {
  const code = await decodeCode(location.hash);
  if (code !== null && code !== editor.getCode()) editor.setCode(code);
});

const shareButton = $<HTMLButtonElement>("#share");
shareButton.addEventListener("click", async () => {
  history.replaceState(null, "", await encodeCode(editor.getCode()));
  await navigator.clipboard.writeText(location.href);
  shareButton.textContent = "link copied";
  setTimeout(() => (shareButton.textContent = "share"), 2000);
});

// ----- The examples menu -----

const examples = $<HTMLSelectElement>("#examples");
examples.insertAdjacentHTML("beforeend", renderExampleOptions());
examples.addEventListener("change", () => {
  editor.setCode(EXAMPLES[Number(examples.value)].code); // Cmd/Ctrl+Z brings the previous code back
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
  try { shader = compileGSS(code, tab === "wgsl" ? "wgsl" : "glsl"); }
  catch { return; } // the GSS editor already displays errors of unfinished code
  glsl.dispatch({
    changes: { from: 0, to: glsl.state.doc.length, insert: shader },
  });
}

let tab: "gss" | "glsl" | "wgsl" = "gss";
editor.onCompile((code) => {
  if (tab !== "gss") showGlsl(code);
});

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-tab]",
)) {
  button.addEventListener("click", () => {
    tab = button.dataset.tab as typeof tab;
    $("#code").hidden = tab !== "gss";
    $("#glsl").hidden = tab === "gss";
    for (const other of document.querySelectorAll("[data-tab]")) {
      other.setAttribute("aria-selected", String(other === button));
    }
    if (tab !== "gss") showGlsl(editor.getCode());
  });
}
