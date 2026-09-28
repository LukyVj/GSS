import type { Renderer } from "./renderer";
import { highlightGss } from "../docs/highlight";

// The elements of an editor: the code, an OK / Error badge, and the error message
export type EditorElements = {
  textarea: HTMLTextAreaElement;
  status: HTMLElement;
  error: HTMLElement;
};

// Shows the code in the textarea, and recompiles the scene after each change
export function connectEditor(
  { textarea, status, error }: EditorElements,
  renderer: Renderer,
  source: string,
): void {
  function tryLoad(code: string): void {
    try {
      renderer.load(code);
      status.textContent = "OK";
      status.className = "status ok";
      error.hidden = true;
    } catch (caught) {
      status.textContent = "Error";
      status.className = "status error";
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  }

  // The colors: a <pre> under the textarea shows the same text, highlighted.
  // The textarea stays on top (transparent letters, visible caret) and does the editing.
  const area = document.createElement("div");
  area.className = "code-area";
  const layer = document.createElement("pre");
  layer.className = "code-layer";
  layer.setAttribute("aria-hidden", "true");
  textarea.before(area);
  area.append(layer, textarea);

  function paint(): void {
    // The extra "\n": a <pre> ignores a last empty line, the textarea does not
    layer.innerHTML = highlightGss(textarea.value) + "\n";
    layer.scrollTop = textarea.scrollTop;
    layer.scrollLeft = textarea.scrollLeft;
  }
  textarea.addEventListener("scroll", () => {
    layer.scrollTop = textarea.scrollTop;
    layer.scrollLeft = textarea.scrollLeft;
  });

  textarea.value = source;
  paint();
  tryLoad(source);

  // We wait for a short pause in the typing before recompiling
  let typingTimer: number | undefined;
  textarea.addEventListener("input", () => {
    paint(); // the colors follow at once, the scene after a pause
    clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => tryLoad(textarea.value), 250);
  });

  // Tab inserts two spaces instead of leaving the editor
  textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    textarea.setRangeText("  ", textarea.selectionStart, textarea.selectionEnd, "end");
    textarea.dispatchEvent(new Event("input")); // setRangeText does not fire "input" by itself
  });
}
