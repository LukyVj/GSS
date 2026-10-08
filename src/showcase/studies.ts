import { mountAsync, type AsyncEmbeddedScene } from "../embed";
import { encodeCode } from "../runtime/share";
import { renderGate } from "../runtime/software-gate";
import { STUDIES, type Study } from "./content";

// The studies viewer that opens the showcase (decision 119): one study at a time, on one
// canvas. Its words, its list and the first study are prerendered (prerender.ts); this
// script mounts the study, and swaps it when another one is chosen.
// A study driven by scroll() gets the slider of the playground: on this long page, the
// scroll of the page would spread the study over all of it.

const lab = document.querySelector<HTMLElement>("#lab")!;
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const status = byId("study-status");
const statusbar = byId("study-statusbar");
const edit = byId<HTMLAnchorElement>("study-edit");
const reference = byId<HTMLAnchorElement>("study-reference");
let scene: AsyncEmbeddedScene | undefined;
let closeGate = () => {}; // the notice over the canvas, when the study waits for a click
let shown = STUDIES[0];
let revision = 0;

async function select(study: Study) {
  const current = ++revision;
  shown = study;
  const words = { title: study.title, eyebrow: study.eyebrow, description: study.description, hint: study.hint };
  for (const [id, value] of Object.entries(words)) byId(`study-${id}`).textContent = value;
  // What the study uses, one chip each
  byId("study-features").replaceChildren(
    ...study.features.map((feature) => Object.assign(document.createElement("li"), { textContent: feature })),
  );
  lab.querySelectorAll<HTMLButtonElement>("[data-study]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.study === study.key)),
  );
  reference.hidden = !study.reference;
  reference.href = study.reference?.href ?? "";
  reference.textContent = study.reference?.label ?? "";
  // The playground link: off until it carries this study
  edit.setAttribute("aria-disabled", "true");
  statusbar.classList.remove("ready");
  status.textContent = "preparing the study…";
  scene?.destroy();
  scene = undefined;
  closeGate();
  closeGate = () => {};
  const oldCanvas = lab.querySelector("canvas")!;
  const canvas = oldCanvas.cloneNode(false) as HTMLCanvasElement;
  oldCanvas.replaceWith(canvas);
  const hash = await encodeCode(study.scene);
  if (current !== revision) return;
  edit.href = `./playground.html${hash}`;
  edit.removeAttribute("aria-disabled");
  try {
    const webgl = study.webgl || new URLSearchParams(location.search).get("backend") === "webgl";
    const mounted = await mountAsync(canvas, study.scene, { backend: webgl ? "webgl" : "auto", scrollSlider: true });
    if (current !== revision) { mounted.destroy(); return; }
    scene = mounted;
    closeGate = renderGate(canvas, mounted); // without a GPU, or too heavy: drawn on a click (decisions 137, 142)
    status.textContent = `gss · ${mounted.backend}`;
    statusbar.classList.add("ready");
  } catch (error) {
    if (current === revision) status.textContent = `unable to render: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const find = (key: string) => STUDIES.find((study) => study.key === key);

lab.querySelectorAll<HTMLButtonElement>("[data-study]").forEach((button) =>
  button.addEventListener("click", () => {
    const study = find(button.dataset.study ?? "");
    if (!study) return;
    history.replaceState(null, "", `#${study.key}`); // a link to this study
    void select(study);
  }),
);
window.addEventListener("pagehide", () => { ++revision; scene?.destroy(); });
// Back from the playground, out of the back-forward cache: the scene was freed
window.addEventListener("pageshow", (event) => { if (event.persisted) void select(shown); });

// A link to a study (showcase#bloom) opens it, and brings the viewer into view
const studies = document.getElementById("studies")!;
window.addEventListener("hashchange", () => {
  const study = find(location.hash.slice(1));
  if (!study) return;
  studies.scrollIntoView();
  void select(study);
});
const linked = find(location.hash.slice(1));
if (linked) studies.scrollIntoView();
void select(linked ?? STUDIES[0]);
