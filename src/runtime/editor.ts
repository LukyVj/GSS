import type { Renderer } from "./renderer";

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

  textarea.value = source;
  tryLoad(source);

  // We wait for a short pause in the typing before recompiling
  let typingTimer: number | undefined;
  textarea.addEventListener("input", () => {
    clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => tryLoad(textarea.value), 250);
  });

  // Tab inserts two spaces instead of leaving the editor
  textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    textarea.setRangeText("  ", textarea.selectionStart, textarea.selectionEnd, "end");
  });
}
