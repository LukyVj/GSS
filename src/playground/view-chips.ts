import "./view-chips.css";
import type { CompiledScene } from "../compiler";
import type { View } from "../compiler/features/view";

// The chips of the view (decision 131): over the top-left corner of the render, in the
// playground and in "Try it" of the docs, `view: shaded`, `view: distance` and `view: steps` (decision 204) switch the view
// without touching the code, like the dpr menu replaces the dpr of the scene. The choice holds
// while the code compiles again with the same view; when the code changes its view, the code
// wins again. Nothing is kept in the browser: the code says what is seen.

const VIEWS: View[] = ["shaded", "distance", "steps"];
// Narrower than this, the chips and the dpr menu do not fit on one row: the chips go under it
const NARROW = 360;

export type ViewTarget = {
  setView(view: View | null): void; // the view of the next compiles; null: the code's
  refresh(): void; // compiles the code again
};

// canvas: the render, whose width decides the row of the chips
export function mountViewChips(host: HTMLElement, target: ViewTarget, canvas?: HTMLElement) {
  const box = document.createElement("div");
  box.className = "view-chips";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "View");
  let code: View = "shaded"; // what the code asks for
  let chosen: View | null = null; // the viewer's choice, until the code changes its view

  const chips = VIEWS.map((view) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "view-chip";
    chip.textContent = `view: ${view}`;
    chip.addEventListener("click", () => {
      if (view === (chosen ?? code)) return;
      chosen = view === code ? null : view;
      show();
      target.setView(chosen);
      target.refresh();
    });
    return chip;
  });
  box.append(...chips);
  host.append(box);
  const narrow =
    canvas && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => box.classList.toggle("is-narrow", canvas.clientWidth < NARROW))
      : null;
  if (canvas) narrow?.observe(canvas);

  function show(): void {
    chips.forEach((chip, n) => chip.setAttribute("aria-pressed", String(VIEWS[n] === (chosen ?? code))));
  }
  show();

  return {
    // After each compile: the view the code asks for
    update(compiled: Pick<CompiledScene, "view">): void {
      const next = compiled.view ?? "shaded";
      if (next !== code) {
        code = next;
        // The code wins. The choice was its new view: the shader is right; another view: the
        // scene compiles again with the view of the code
        if (chosen !== null) {
          const shown = chosen;
          chosen = null;
          target.setView(null);
          if (shown !== next) target.refresh();
        }
      }
      show();
    },
    destroy(): void {
      narrow?.disconnect();
      box.remove();
    },
  };
}
