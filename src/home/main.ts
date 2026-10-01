import "../styles/gss-code.css";
import { highlightGss } from "../docs/highlight";
import { formatGss } from "../docs/format";
import { FIRST_SCENE } from "../docs/guide";
import { PROPERTIES, SELECTORS, SHAPE_DOCS } from "../compiler/registry/registry";
import { createRenderer } from "../runtime/renderer";
import { connectEditor } from "../runtime/editor";
import { encodeCode } from "../runtime/share";
import { statusParts } from "../runtime/status";
import { mountSearch } from "../docs/search-box";
import { createLogoReveal } from "./logo-reveal";

mountSearch();

// Hero: SVG in front, hero-logo.gss behind, revealed by a drag bar
const heroField = document.querySelector<SVGSVGElement>(".hero svg.field");
if (heroField) {
  try {
    createLogoReveal(heroField, { initial: 50 });
  } catch (error) {
    console.warn("GSS hero reveal unavailable:", error);
  }
}

// The home page: design/reference/png/01-home.png.
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

// A link shared before the playground moved to playground.html: #code=… still opens it there
if (location.hash.startsWith("#code=")) location.replace(`./playground.html${location.hash}`);

// ----- The code of the pillars, colored like everywhere else -----
for (const code of document.querySelectorAll<HTMLElement>("code[data-gss]")) {
  code.innerHTML = highlightGss(code.textContent ?? "");
}

// ----- Numbers: read from the registry, so they are always true -----
$("#count-shapes").textContent = String(SHAPE_DOCS.length);
$("#count-properties").textContent = String(PROPERTIES.length);
$("#count-selectors").textContent = String(SELECTORS.length);

// The first scene of the docs, in jelly (the material of the logo) on a dark floor that sits
// in the page: glass shows the floor through it, so on a dark floor it turns muddy
const DEMO_SCENE = `${FIRST_SCENE.replace("glass(1.5, frosted 0.3)", "jelly(0.6)")} scene { floor: #1a1a1f; }`;

// ----- Live: the real compiler and renderer, started when the section comes into view
// (a WebGL context and a shader compile are not free: no cost for visitors who don't scroll) -----
function startDemo(): void {
  const renderer = createRenderer($<HTMLCanvasElement>("#demo-scene"));
  const editor = connectEditor(
    { host: $("#demo-code"), error: $("#demo-error") },
    renderer,
    formatGss(DEMO_SCENE),
  );

  const stats = $("#demo-stats");
  editor.onStats((current) => {
    stats.replaceChildren(
      ...statusParts(current).map((text) => {
        const part = document.createElement("span");
        part.textContent = text;
        return part;
      }),
    );
    stats.classList.toggle("error", current.errors > 0);
  });

  // "open in the playground" carries the code as it is now, edits included
  const open = $<HTMLAnchorElement>("#open-demo");
  editor.onCompile(async (code) => {
    open.href = `./playground.html${await encodeCode(code)}`;
  });
}

const live = $("#live");
const observer = new IntersectionObserver(
  (entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    try {
      startDemo();
    } catch (error) {
      // No WebGL2 (an old browser, a locked-down machine): say so where the scene would be
      $("#demo-stats").textContent = error instanceof Error ? error.message : String(error);
    }
  },
  { rootMargin: "200px" },
);
observer.observe(live);
