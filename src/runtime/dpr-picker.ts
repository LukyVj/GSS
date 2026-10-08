import { createDensity, type Density, type DensityChoice } from "./dpr";

// The dpr picker of the docs and the playground (decision 120): a small menu at the top
// right of the render, a signal outline (styles/site.css, .gss-dpr). "auto" shows the
// ratio it draws at. The choice holds for the whole site, in this browser.

const KEY = "gss-dpr";
const RATIOS = [0.5, 1, 1.5, 2];

// The density of a view (decision 142): the viewer's choice with the menu, auto without it;
// none when the page asked for the scene's dpr as written (adaptDpr: false)
export function viewDensity(options: { dprPicker?: boolean; adaptDpr?: boolean }): Density | null {
  if (options.dprPicker) return createDensity(savedDpr());
  return options.adaptDpr === false ? null : createDensity("auto");
}

// The viewer's last choice, auto when there is none (or storage is off)
export function savedDpr(): DensityChoice {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // private mode, blocked storage: auto
  }
  const ratio = Number(saved);
  return saved !== null && saved !== "" && ratio > 0 && ratio <= 4 ? ratio : "auto";
}

function save(choice: DensityChoice): void {
  try {
    localStorage.setItem(KEY, String(choice));
  } catch {
    // the choice holds for this render only
  }
}

const label = (ratio: number) => String(Math.round(ratio * 100) / 100);

function option(text: string, value: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.textContent = text;
  element.value = value;
  return element;
}

export function createDprPicker(
  canvas: HTMLCanvasElement,
  density: Density,
  screen = window.devicePixelRatio,
) {
  const box = document.createElement("label");
  box.className = "gss-dpr";
  box.title = "Pixel density: auto follows the frame rate";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Pixel density (dpr)");
  // auto, then the ratios this screen can show, and the screen's own when it is between
  const ratios = RATIOS.filter((ratio) => ratio <= screen);
  if (!ratios.includes(screen) && screen <= 4) ratios.push(screen);
  const auto = option("auto", "auto");
  select.append(auto, ...ratios.map((ratio) => option(label(ratio), String(ratio))));
  select.value = String(density.choice);
  // A choice made on another screen, that this one cannot show: auto, here
  if (select.selectedIndex < 0) {
    density.choose("auto");
    select.value = "auto";
  }
  select.addEventListener("change", () => {
    const choice = select.value === "auto" ? "auto" : Number(select.value);
    density.choose(choice);
    save(choice);
  });
  box.append("dpr", select);
  canvas.after(box);

  let shown = "";
  return {
    // Each frame: the ratio drawn, next to auto; the place, at the top right of the render
    // (a sibling of the canvas, placed from the same box, like the scroll slider)
    update(ratio: number): void {
      const text = density.choice === "auto" ? `auto · ${label(ratio)}` : "auto";
      if (text !== shown) auto.textContent = shown = text;
      box.style.left = `${canvas.offsetLeft + canvas.offsetWidth - box.offsetWidth - 8}px`;
      box.style.top = `${canvas.offsetTop + 8}px`;
    },
    destroy(): void {
      box.remove();
    },
  };
}
