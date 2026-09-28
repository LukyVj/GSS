import "./styles/gss-code.css";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { createRenderer } from "./runtime/renderer";
import { connectEditor } from "./runtime/editor";
import { encodeCode, decodeCode } from "./runtime/share";
import { compileGSS } from "./compiler";
import { EXAMPLES, renderExampleOptions } from "./playground/examples";

// The playground: the GSS editor (or the GLSL it becomes) on the left, the scene on the right.
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const renderer = createRenderer($<HTMLCanvasElement>("#scene"));

// A shared link opens its scene; otherwise the first example
const start = (await decodeCode(location.hash)) ?? EXAMPLES[0].code;

const editor = connectEditor(
  { host: $("#code"), status: $("#status"), error: $("#error") },
  renderer,
  start,
);

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
  shareButton.textContent = "Link copied";
  setTimeout(() => (shareButton.textContent = "Share"), 2000);
});

// ----- The examples menu -----

const examples = $<HTMLSelectElement>("#examples");
examples.insertAdjacentHTML("beforeend", renderExampleOptions());
examples.addEventListener("change", () => {
  editor.setCode(EXAMPLES[Number(examples.value)].code); // Cmd/Ctrl+Z brings the previous code back
  examples.value = ""; // back to "Examples…", so the same example can be picked again
});

// ----- The GLSL tab: the shader the GSS becomes, read-only -----

const glsl = new EditorView({
  parent: $("#glsl"),
  state: EditorState.create({
    extensions: [
      lineNumbers(),
      cpp(), // GLSL is close enough to C for the colors
      oneDark,
      EditorState.readOnly.of(true),
      EditorView.theme({ "&": { height: "100%", backgroundColor: "transparent" } }),
    ],
  }),
});

function showGlsl(code: string): void {
  const shader = compileGSS(code);
  glsl.dispatch({ changes: { from: 0, to: glsl.state.doc.length, insert: shader } });
}

let tab: "gss" | "glsl" = "gss";
editor.onCompile((code) => {
  if (tab === "glsl") showGlsl(code);
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
  button.addEventListener("click", () => {
    tab = button.dataset.tab as "gss" | "glsl";
    $("#code").hidden = tab !== "gss";
    $("#glsl").hidden = tab !== "glsl";
    for (const other of document.querySelectorAll("[data-tab]")) {
      other.setAttribute("aria-selected", String(other === button));
    }
    if (tab === "glsl") showGlsl(editor.getCode());
  });
}
