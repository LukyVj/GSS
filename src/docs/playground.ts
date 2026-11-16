import "../styles/playground-panel.css";
import { createRenderer } from "../runtime/renderer";
import { elementMedia } from "../runtime/media";
import { renderGate } from "../runtime/software-gate";
import { sleepOffscreen } from "../runtime/offscreen";
import { connectEditor } from "../runtime/editor";
import { encodeCode } from "../runtime/share";
import { formatGss } from "./format";
import { mountVariablesPanel } from "../playground/variables-panel";
import { mountViewChips } from "../playground/view-chips";
import { mountDebugPanel } from "../playground/debug-panel";
import { createStepsReader } from "../playground/steps-reader";

// "Try it" opens a live editor under an example, or beside the search. Only one is open at
// a time: browsers limit how many WebGL canvases a page can have.
let open: { panel: HTMLElement; example?: HTMLElement; close(): void } | null = null;

// Also called when the docs change page (src/docs/pages.ts)
export function closePlayground(): void {
  if (!open) return;
  const current = open;
  open = null;
  current.close();
}

// The panel of a live scene: the caller puts it in the page, then starts it. Starting returns
// what stops it. html: the elements the scene shows with element(#id), placed inside its canvas
function createPanel(code: string, html: string): { panel: HTMLElement; start(): () => void } {
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

  function start(): () => void {
    const canvas = panel.querySelector("canvas")!;
    canvas.innerHTML = html; // laid out inside the canvas, drawn on the object (decision 101)
    // @media reads the size of the render, like the result of CodePen (decision 165)
    // A probe that only tells when a frame is drawn, for the steps of @debug-panel: it never
    // asks for more frames than the scene needs (decision 204)
    const steps = createStepsReader(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd: () => steps.drawn(), shaderBuilt() {}, measuring: () => false };
    const renderer = createRenderer(canvas, { scrollSlider: true, dprPicker: true, viewport: elementMedia, profile: () => probe });
    renderer.setDebug(true); // the axes and the grid of @debug-panel (decision 204)
    const sleep = sleepOffscreen(canvas, renderer); // scrolled away: no frames, no GPU
    renderGate(canvas, sleep); // without a GPU, or too heavy: drawn on a click (decisions 137, 142)
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
    // The chips of the view, over the top-left corner of the render (decision 131)
    const chips = mountViewChips(
      panel.querySelector(".playground-body")!,
      { setView: (view) => renderer.setView(view), refresh: () => editor.refresh() },
      canvas,
    );
    // The numbers of the scene, with @debug-panel (decision 204)
    const debug = mountDebugPanel(panel.querySelector(".playground-body")!, { backend: "webgl", camera: renderer.camera, steps: steps.steps });

    // The link carries the code as it is now, edits included
    const link = panel.querySelector<HTMLAnchorElement>(".open-playground")!;
    editor.onCompile(async (current, compiled) => {
      variables.update(compiled.properties, compiled.propertyPanel, compiled.propertyRanges);
      chips.update(compiled);
      debug.update(compiled);
      link.href = `./playground.html${await encodeCode(current, html)}`; // the HTML goes too
    });

    return () => {
      editor.destroy();
      chips.destroy();
      debug.destroy();
      sleep.stop();
      renderer.destroy();
    };
  }
  return { panel, start };
}

function openPlayground(example: HTMLElement, code: string, html = ""): void {
  closePlayground();
  const { panel, start } = createPanel(code, html);
  example.after(panel);
  example.classList.add("is-open");
  const button = example.querySelector("button.try")!;
  button.textContent = "Close";
  const stop = start();
  open = {
    panel,
    example,
    close: () => {
      stop();
      panel.remove();
      example.classList.remove("is-open");
      button.textContent = "Try it";
    },
  };
}

// A live panel anywhere: place() puts it in the page; onClose runs once it is closed, by
// closePlayground() or by another one opening (the search opens one beside it)
export function openPanel(place: (panel: HTMLElement) => void, code: string, html = "", onClose?: () => void): HTMLElement {
  closePlayground();
  const { panel, start } = createPanel(code, html);
  place(panel);
  const stop = start();
  open = {
    panel,
    close: () => {
      stop();
      panel.remove();
      onClose?.();
    },
  };
  return panel;
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
