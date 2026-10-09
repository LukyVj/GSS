// The archive of the showcase (decision 172), prerendered (prerender.ts): its grid / list
// switch, kept for the next visit, and the code of a scene in place of a missing capture.

const KEY = "gss-showcase-archive-view";

export function connectArchiveView(root: HTMLElement): void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>(".views [data-view]")];
  const show = (view: string) => {
    root.dataset.view = view;
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.view === view));
  };
  // Storage can be refused (a private window, blocked site data): the grid then
  let kept: string | null = null;
  try {
    kept = localStorage.getItem(KEY);
  } catch {}
  if (kept && buttons.some((button) => button.dataset.view === kept)) show(kept);
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const view = button.dataset.view ?? "grid";
      show(view);
      try {
        localStorage.setItem(KEY, view);
      } catch {}
    });
  }

  for (const img of root.querySelectorAll<HTMLImageElement>(".art img")) {
    img.addEventListener("error", () => {
      const fallback = img.parentElement?.querySelector<HTMLElement>(".fallback");
      img.remove();
      if (fallback) fallback.hidden = false;
    });
  }
}
