import { createRenderer, type Renderer } from "../runtime/renderer";
import { connectEditor } from "../runtime/editor";
import { formatGss } from "./format";

// "Try it" opens a live editor under an example. Only one is open at a time:
// browsers limit how many WebGL canvases a page can have.
let open: { example: HTMLElement; panel: HTMLElement; renderer: Renderer } | null = null;

function close(): void {
  if (!open) return;
  open.renderer.destroy();
  open.panel.remove();
  open.example.classList.remove("is-open");
  open.example.querySelector("button.try")!.textContent = "Try it";
  open = null;
}

function openPlayground(example: HTMLElement, code: string): void {
  close();

  const panel = document.createElement("div");
  panel.className = "playground";
  panel.innerHTML = `
    <div class="playground-bar">
      <span class="status ok">OK</span>
      <span class="hint">Edit the code, drag the scene to turn around it</span>
    </div>
    <div class="playground-body">
      <textarea spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="GSS code"></textarea>
      <canvas></canvas>
    </div>
    <pre class="error" hidden></pre>`;
  example.after(panel);
  example.classList.add("is-open");
  example.querySelector("button.try")!.textContent = "Close";

  const renderer = createRenderer(panel.querySelector("canvas")!);
  connectEditor(
    {
      textarea: panel.querySelector("textarea")!,
      status: panel.querySelector(".status")!,
      error: panel.querySelector(".error")!,
    },
    renderer,
    formatGss(code),
  );
  open = { example, panel, renderer };
}

// One listener for the whole page, whatever the number of examples
export function enableTryIt(root: HTMLElement): void {
  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button.try");
    if (!button) return;
    const example = button.closest<HTMLElement>(".example")!;
    if (open?.example === example) close();
    else openPlayground(example, button.dataset.example ?? "");
  });
}
