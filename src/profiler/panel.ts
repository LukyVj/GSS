import "./panel.css";
import { createProfiler } from "./profiler";
import { createGpuTimer } from "./gpu-timer";
import { reportRows } from "./format";

let profiler: ReturnType<typeof createProfiler> | null = null;

// Given to createRenderer: view.ts calls it once, with its WebGL context
export function profile(gl: WebGL2RenderingContext) {
  profiler = createProfiler(createGpuTimer(gl));
  return profiler;
}

// The panel over the scene, its toggle in the status bar; Alt+P shows or hides it
export function mountPanel(statusbar: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "perf-panel";
  panel.hidden = true;
  panel.innerHTML = "<h2>performance</h2><dl></dl>";
  document.body.append(panel); // a grid item of <body>: the CSS puts it in the scene cell
  const list = panel.querySelector("dl")!;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "perf-toggle";
  toggle.textContent = "perf";
  statusbar.append(toggle);

  function render() {
    if (!profiler || !visible) return;
    const rows = reportRows(profiler.report());
    list.replaceChildren(
      ...rows.flatMap((row) => {
        const dt = document.createElement("dt");
        dt.textContent = row.label;
        const dd = document.createElement("dd");
        dd.textContent = row.value;
        dd.classList.toggle("missing", row.missing === true);
        dd.classList.toggle("warning", row.warning === true);
        return [dt, dd];
      }),
    );
  }

  let visible = false; // the state lives here; the DOM only shows it

  function setVisible(next: boolean) {
    visible = next;
    panel.hidden = !next;
    toggle.setAttribute("aria-pressed", String(visible));
    try {
      localStorage.setItem("gss-perf", visible ? "1" : "0"); // remembered across reloads
    } catch {} // private window: just not remembered
    render();
  }

  toggle.addEventListener("click", () => setVisible(!visible));
  window.addEventListener("keydown", (event) => {
    // event.code, not event.key: on a Mac, Alt+P types "π"
    if (event.altKey && event.code === "KeyP") {
      event.preventDefault();
      setVisible(!visible);
    }
  });
  setInterval(render, 500); // twice a second: readable, and cheap

  let remembered = false;
  try {
    remembered = localStorage.getItem("gss-perf") === "1";
  } catch {}
  setVisible(remembered);
}
