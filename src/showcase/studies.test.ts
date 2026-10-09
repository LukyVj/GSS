// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { STUDIES } from "./content";
import { renderLabHtml } from "./prerender";

// The studies viewer waits for play: a study is heavy, and the page opens on it. Play
// draws the study shown; choosing another one in the list draws it at once.

const mounted = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../embed", () => ({
  mountAsync: vi.fn(async (_canvas: HTMLCanvasElement, scene: string) => {
    mounted.calls.push(scene);
    return { backend: "webgl", destroy() {}, pause() {}, play() {} };
  }),
}));
vi.mock("../runtime/software-gate", () => ({ renderGate: () => () => {} }));
vi.mock("../runtime/share", () => ({ encodeCode: async () => "#code=x" }));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Each import is a new page: the listeners of the previous one leave the window
// (happy-dom fires hashchange on replaceState, unlike a browser)
const listeners: [string, EventListenerOrEventListenerObject][] = [];
const listen = window.addEventListener.bind(window);
window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
  listeners.push([type, listener]);
  listen(type, listener, options);
}) as typeof window.addEventListener;

async function open(hash = "") {
  for (const [type, listener] of listeners.splice(0)) window.removeEventListener(type, listener);
  vi.resetModules();
  mounted.calls.length = 0;
  history.replaceState(null, "", `/showcase.html${hash}`);
  document.body.innerHTML = `<section id="studies"><div class="lab" id="lab">${renderLabHtml("./playground.html#code=x")}</div></section>`;
  Element.prototype.scrollIntoView = () => {};
  await import("./studies");
  await settle();
}

const poster = () => document.querySelector<HTMLImageElement>("#study-poster")!;
const play = () => document.querySelector<HTMLButtonElement>("#study-play")!;

describe("the studies viewer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens on the poster of the first study and a play button, without drawing it", async () => {
    await open();
    expect(mounted.calls).toEqual([]);
    expect(poster().getAttribute("src")).toBe(`/showcase/${STUDIES[0].key}.jpg`);
    expect(play().hidden).toBe(false);
    expect(document.querySelector("#study-edit")!.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("draws the study on play, and takes the button away", async () => {
    await open();
    play().click();
    await settle();
    expect(mounted.calls).toEqual([STUDIES[0].scene]);
    expect(play().hidden).toBe(true);
    expect(poster().hidden).toBe(true);
  });

  it("draws a study chosen in the list at once", async () => {
    await open();
    const bloom = STUDIES.find((study) => study.key === "bloom")!;
    document.querySelector<HTMLButtonElement>('[data-study="bloom"]')!.click();
    await settle();
    await settle();
    expect(mounted.calls).toEqual([bloom.scene]);
    expect(play().hidden).toBe(true);
  });

  it("opens a linked study on its poster, waiting for play too", async () => {
    await open("#camera");
    expect(mounted.calls).toEqual([]);
    expect(poster().getAttribute("src")).toBe("/showcase/camera.jpg");
    expect(document.querySelector('[data-study="camera"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("#study-title")!.textContent).toBe(STUDIES.find((s) => s.key === "camera")!.title);
  });
});
