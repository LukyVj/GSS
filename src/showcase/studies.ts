import { mountAsync, type AsyncEmbeddedScene } from "../embed";
import { encodeCode } from "../runtime/share";
import { renderGate } from "../runtime/software-gate";
import { STUDIES, type Study } from "./content";

// The studies viewer that opens the showcase (decision 119): one study at a time, on one
// canvas. Its words, its list and the first study are prerendered (prerender.ts); this
// script mounts the study, and swaps it when another one is chosen.
// A study driven by scroll() gets the slider of the playground: on this long page, the
// scroll of the page would spread the study over all of it.
// The page opens on the poster of the study and a play button (decision 171): a study is
// heavy, and the reader came to look at the page. Play draws it; a study chosen in the
// list, or by a link of the page, is drawn at once.

const lab = document.querySelector<HTMLElement>("#lab")!;
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const status = byId("study-status");
const statusbar = byId("study-statusbar");
const edit = byId<HTMLAnchorElement>("study-edit");
const reference = byId<HTMLAnchorElement>("study-reference");
const poster = byId<HTMLImageElement>("study-poster");
const play = byId<HTMLButtonElement>("study-play");
let scene: AsyncEmbeddedScene | undefined;
let closeGate = () => {}; // the notice over the canvas, when the study waits for a click
let shown = STUDIES[0];
let revision = 0;
let playing = false; // once true, every study shown is drawn

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
  play.setAttribute("aria-label", `Play ${study.name}`);
  // The playground link: off until it carries this study
  edit.setAttribute("aria-disabled", "true");
  statusbar.classList.remove("ready");
  status.textContent = playing ? "preparing the study…" : "paused · press play";
  scene?.destroy();
  scene = undefined;
  closeGate();
  closeGate = () => {};
  const oldCanvas = lab.querySelector("canvas")!;
  const canvas = oldCanvas.cloneNode(false) as HTMLCanvasElement;
  oldCanvas.replaceWith(canvas);
  // The poster stays until the study draws: no black frame while it compiles
  poster.src = posterOf(study);
  poster.hidden = false;
  play.hidden = playing;
  const hash = await encodeCode(study.scene);
  if (current !== revision) return;
  edit.href = `./playground.html${hash}`;
  edit.removeAttribute("aria-disabled");
  if (!playing) return;
  try {
    const webgl = study.webgl || new URLSearchParams(location.search).get("backend") === "webgl";
    const mounted = await mountAsync(canvas, study.scene, { backend: webgl ? "webgl" : "auto", scrollSlider: true });
    if (current !== revision) { mounted.destroy(); return; }
    scene = mounted;
    poster.hidden = true;
    closeGate = renderGate(canvas, mounted); // without a GPU, or too heavy: drawn on a click (decisions 137, 142)
    status.textContent = `gss · ${mounted.backend}`;
    statusbar.classList.add("ready");
  } catch (error) {
    if (current === revision) status.textContent = `unable to render: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Its capture (npm run captures), the size of the viewer
const posterOf = (study: Study) => `/showcase/${study.key}.jpg`;

// Chosen by the reader: drawn at once
function choose(study: Study) {
  playing = true;
  void select(study);
}

const find = (key: string) => STUDIES.find((study) => study.key === key);

play.addEventListener("click", () => choose(shown));
poster.addEventListener("error", () => { poster.hidden = true; }); // no capture yet: the button alone
lab.querySelectorAll<HTMLButtonElement>("[data-study]").forEach((button) =>
  button.addEventListener("click", () => {
    const study = find(button.dataset.study ?? "");
    if (!study) return;
    history.replaceState(null, "", `#${study.key}`); // a link to this study
    choose(study);
  }),
);
window.addEventListener("pagehide", () => { ++revision; scene?.destroy(); });
// Back from the playground, out of the back-forward cache: the scene was freed
window.addEventListener("pageshow", (event) => { if (event.persisted) void select(shown); });

// A link to a study (showcase#bloom) opens it, and brings the viewer into view: from the
// page, it is drawn at once; the page opened by the link waits for play, like any other
const studies = document.getElementById("studies")!;
window.addEventListener("hashchange", () => {
  const study = find(location.hash.slice(1));
  if (!study) return;
  studies.scrollIntoView();
  if (playing && study === shown) return; // already drawn
  choose(study);
});
const linked = find(location.hash.slice(1));
if (linked) studies.scrollIntoView();
void select(linked ?? STUDIES[0]);
