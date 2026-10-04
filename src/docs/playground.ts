import { createRenderer, type Renderer } from "../runtime/renderer";
import { connectEditor, type Editor } from "../runtime/editor";
import { encodeCode } from "../runtime/share";
import { formatGss } from "./format";
import { mountVariablesPanel } from "../playground/variables-panel";

// "Try it" opens a live editor under an example. Only one is open at a time:
// browsers limit how many WebGL canvases a page can have.
let open: {
  example: HTMLElement;
  panel: HTMLElement;
  renderer: Renderer;
  editor: Editor;
} | null = null;

// Also called when the docs change page (src/docs/pages.ts)
export function closePlayground(): void {
  if (!open) return;
  open.editor.destroy();
  open.renderer.destroy();
  open.panel.remove();
  open.example.classList.remove("is-open");
  open.example.querySelector("button.try")!.textContent = "Try it";
  open = null;
}

// html: the elements the scene shows with element(#id), placed inside its canvas
function openPlayground(example: HTMLElement, code: string, html = ""): void {
  closePlayground();

  const panel = document.createElement("div");
  panel.className = "playground";
  panel.innerHTML = `
    <div class="playground-bar">
      <span class="status ok">OK</span>
      <span class="hint">Edit the code, drag the scene to turn around it</span>
      <a class="open-playground" href="./playground.html" target="_blank">Open in playground ↗</a>
    </div>
    <div class="playground-body">
      <div class="code-host"></div>
      <canvas></canvas>
    </div>
    <pre class="error" hidden></pre>`;
  example.after(panel);
  example.classList.add("is-open");
  example.querySelector("button.try")!.textContent = "Close";

  const canvas = panel.querySelector("canvas")!;
  canvas.innerHTML = html; // laid out inside the canvas, drawn on the object (decision 101)
  const renderer = createRenderer(canvas, { scrollSlider: true, dprPicker: true });
  const editor = connectEditor(
    {
      host: panel.querySelector(".code-host")!,
      status: panel.querySelector(".status")!,
      error: panel.querySelector(".error")!,
    },
    renderer,
    formatGss(code),
  );

  // A control per @property over the render, like the playground (decisions 127, 128)
  const variables = mountVariablesPanel(panel.querySelector(".playground-body")!, renderer);

  // The link carries the code as it is now, edits included
  const link = panel.querySelector<HTMLAnchorElement>(".open-playground")!;
  editor.onCompile(async (current, compiled) => {
    variables.update(compiled.properties, compiled.propertyPanel);
    link.href = `./playground.html${await encodeCode(current, html)}`; // the HTML goes too
  });

  open = { example, panel, renderer, editor };
}

// One listener for the whole page, whatever the number of examples
export function enableTryIt(root: HTMLElement): void {
  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button.try");
    if (!button) return;
    const example = button.closest<HTMLElement>(".example")!;
    if (open?.example === example) closePlayground();
    else openPlayground(example, button.dataset.example ?? "", button.dataset.html ?? "");
  });
}
