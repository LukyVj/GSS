// The columns of the search, wider or narrower at the reader's hand: a handle on the hairline
// beside the contents and beside the right column, dragged, or moved with the arrows. The width
// is a custom property of the modal that the grid reads (search-start.css); each column lays
// itself out by its own width with container queries. The widths are kept for the next search.
// At the widest (1,120px), both columns at their largest leave the results 360px.

export const COLUMNS = {
  contents: { initial: 232, min: 200, max: 320, share: 0.3, label: "Resize the contents" },
  concepts: { initial: 300, min: 240, max: 440, share: 0.4, label: "Resize the preview" },
} as const;

export type Column = keyof typeof COLUMNS;
type Widths = Partial<Record<Column, number>>;

const STORAGE = "gss-search-columns";
const STEP = 16;
const BIG_STEP = 64;

// Between its smallest and its largest, and never more than its share of the window
export function clampWidth(column: Column, width: number, modalWidth: number): number {
  const { min, max, share } = COLUMNS[column];
  const largest = Math.max(min, Math.min(max, Math.floor(modalWidth * share)));
  return Math.round(Math.min(largest, Math.max(min, width)));
}

// What the reader chose last time; a private window or a broken value gives nothing
export function readWidths(): Widths {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as Record<string, unknown>;
    const widths: Widths = {};
    for (const column of Object.keys(COLUMNS) as Column[]) {
      const width = saved?.[column];
      if (typeof width === "number" && Number.isFinite(width)) widths[column] = width;
    }
    return widths;
  } catch {
    return {};
  }
}

function saveWidths(widths: Widths): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(widths));
  } catch {
    // the width lasts for this search only
  }
}

export function mountColumnResizers(modal: HTMLElement): void {
  if (modal.querySelector(".gss-search-resizer")) return;
  const widths = readWidths();
  const footer = modal.querySelector(".DocSearch-Footer");

  for (const column of Object.keys(COLUMNS) as Column[]) {
    const { initial, min, max, label } = COLUMNS[column];
    const handle = document.createElement("div");
    handle.className = "gss-search-resizer";
    handle.dataset.column = column;
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", label);
    handle.setAttribute("aria-valuemin", String(min));
    handle.setAttribute("aria-valuemax", String(max));
    handle.title = `${label} (double-click: back to its width)`;

    const current = () => widths[column] ?? initial;
    const set = (width: number | undefined) => {
      if (width === undefined) {
        delete widths[column];
        modal.style.removeProperty(`--gss-search-${column}`);
      } else {
        widths[column] = clampWidth(column, width, modal.clientWidth || window.innerWidth);
        modal.style.setProperty(`--gss-search-${column}`, `${widths[column]}px`);
      }
      handle.setAttribute("aria-valuenow", String(current()));
    };
    // The contents widen to the right, the right column to the left: toward the results
    const direction = column === "contents" ? 1 : -1;

    handle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? BIG_STEP : STEP;
      const moves: Record<string, () => number | undefined> = {
        ArrowRight: () => current() + direction * step,
        ArrowLeft: () => current() - direction * step,
        Home: () => min,
        End: () => max,
        Enter: () => undefined,
      };
      if (!(event.key in moves)) return;
      event.preventDefault();
      event.stopPropagation(); // the arrows of DocSearch move in the results, not here
      set(moves[event.key]());
      saveWidths(widths);
    });

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = current();
      modal.classList.add("gss-search-resizing");
      handle.classList.add("gss-search-resizer--active"); // this one lit, not the other
      const move = (moveEvent: PointerEvent) => set(startWidth + direction * (moveEvent.clientX - startX));
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        modal.classList.remove("gss-search-resizing");
        handle.classList.remove("gss-search-resizer--active");
        saveWidths(widths);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });

    handle.addEventListener("dblclick", () => {
      set(undefined);
      saveWidths(widths);
    });

    set(widths[column]);
    if (footer) footer.before(handle);
    else modal.append(handle);
  }
}
