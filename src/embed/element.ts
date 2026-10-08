import { mountAsync, type EmbeddedScene, type AsyncEmbeddedScene } from "./index";
import { readControls, sourceUrl } from "./options";
import { softwareRendering } from "./runtime";
import { HEAVY_NOTICE, SOFTWARE_NOTICE, SOFTWARE_PLAY } from "../runtime/software";

// <gss-scene>: a GSS scene in any page, without a build step (decision 63).
//
//   <script type="module" src="https://www.gss-lang.dev/embed.js"></script>
//   <gss-scene src="logo.gss"></gss-scene>
//   <gss-scene controls="none"><script type="text/gss"> @scene { sphere; } </script></gss-scene>
//   <gss-scene src="logo.gss" poster="logo.jpg"></gss-scene>
//
// poster: an image shown until the scene draws, like the poster of a <video>. On a machine
// without a GPU, the scene waits for a click on a button, over its poster (decision 137). With
// a GPU too slow for the scene, it stops after a second or two, and the same button draws it
// anyway (decision 142).
//
// Its other HTML children are shown inside the canvas by a <slot>, laid out but not painted,
// for texture: element(#id) (decision 101): they keep the styles of the page.
//
// The structure of the scene stays in @scene (decision 2): the element only gives it a
// place in the page. Its size is the element's (16 / 9 by default, like a video).

const STYLE = `
  :host { display: block; position: relative; aspect-ratio: 16 / 9; background: #0a0a0c; }
  :host([hidden]) { display: none; }
  canvas { display: block; width: 100%; height: 100%; touch-action: pan-y; }
  .error {
    position: absolute; inset: auto 0 0 0; margin: 0; padding: 8px 10px;
    font: 12px/1.45 "JetBrains Mono", ui-monospace, monospace; white-space: pre-wrap;
    color: #ff9a80; background: #0a0a0ce6; border-top: 1px solid #202026;
  }
  .error[hidden] { display: none; }
  .poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
  .gate {
    position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px;
    padding: 16px; text-align: center; font: 13px/1.45 system-ui, sans-serif; color: #c8c8d0;
  }
  .gate p { margin: 0; max-width: 32ch; padding: 4px 8px; background: #0a0a0cb3; }
  .gate button {
    font: inherit; color: #0a0a0c; background: #e8e8ec; border: 0; border-radius: 4px; padding: 6px 12px; cursor: pointer;
  }
  .poster[hidden], .gate[hidden] { display: none; }
`;

export class GssSceneElement extends HTMLElement {
  static observedAttributes = ["src", "controls", "backend", "poster"];

  #canvas: HTMLCanvasElement;
  #error: HTMLPreElement;
  #poster: HTMLImageElement;
  #gate: HTMLDivElement;
  #allowed = false; // without a GPU: the reader asked for the scene anyway
  #heavy = false; // the scene stopped, too heavy for the computer: the button plays it
  #scene: EmbeddedScene | AsyncEmbeddedScene | null = null;
  #waiting: IntersectionObserver | null = null;
  #started = false;
  #run = 0; // the latest start(): an older fetch that arrives late is dropped

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style><canvas part="canvas" layoutsubtree><slot></slot></canvas>`
      + `<img class="poster" part="poster" alt="" hidden><pre class="error" part="error" hidden></pre>`
      + `<div class="gate" part="gate" hidden><p>${SOFTWARE_NOTICE}</p>`
      + `<button type="button" part="play">${SOFTWARE_PLAY}</button></div>`;
    this.#canvas = root.querySelector("canvas")!;
    this.#error = root.querySelector("pre")!;
    this.#poster = root.querySelector("img")!;
    this.#gate = root.querySelector(".gate")!;
    this.#gate.querySelector("button")!.addEventListener("click", () => {
      this.#gate.hidden = true;
      if (this.#heavy) {
        this.#heavy = false;
        this.#scene?.play(); // never stopped again
        return;
      }
      this.#allowed = true;
      void this.#start();
    });
  }

  // The WebGL context and the compile only start when the scene comes near the screen
  connectedCallback(): void {
    this.#showPoster(true);
    if (typeof IntersectionObserver === "undefined") return void this.#start();
    this.#waiting = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#waiting?.disconnect();
        this.#waiting = null;
        void this.#start();
      },
      { rootMargin: "200px" },
    );
    this.#waiting.observe(this);
  }

  disconnectedCallback(): void {
    this.#run++;
    this.#waiting?.disconnect();
    this.#waiting = null;
    this.#stop();
    this.#started = false;
  }

  attributeChangedCallback(
    name: string,
    before: string | null,
    after: string | null,
  ): void {
    if (name === "poster") return void this.#showPoster(this.#scene === null);
    if (this.#started && before !== after) void this.#start();
  }

  // The scene, to pause(), play() or update() it from a script
  get scene(): EmbeddedScene | AsyncEmbeddedScene | null {
    return this.#scene;
  }

  async #start(): Promise<void> {
    this.#started = true;
    const run = ++this.#run;
    if (!this.#allowed && softwareRendering()) {
      this.#gate.querySelector("p")!.textContent = SOFTWARE_NOTICE;
      this.#gate.hidden = false;
      return;
    }
    try {
      const { code, base } = await this.#readSource();
      if (run !== this.#run) return;
      this.#stop(); // controls are set when the view is made: a change starts again
      // A canvas cannot switch between WebGL and WebGPU contexts. Its <slot> comes along.
      const canvas = this.#canvas.cloneNode(true) as HTMLCanvasElement;
      this.#canvas.replaceWith(canvas);
      this.#canvas = canvas;
      canvas.addEventListener("gss-error", event => {
        if (canvas !== this.#canvas) return;
        const error = (event as CustomEvent).detail;
        const message = error instanceof Error ? error.message : String(error);
        this.#error.textContent = message;
        this.#error.hidden = false;
        this.dispatchEvent(new CustomEvent("error", { detail: message }));
      });
      // Too heavy for the computer: the view stopped (decision 142). Without a GPU, the reader
      // already chose to wait: it goes on.
      canvas.addEventListener("gss-too-heavy", () => {
        if (canvas !== this.#canvas) return;
        if (this.#allowed) return void this.#scene?.play();
        this.#heavy = true;
        this.#gate.querySelector("p")!.textContent = HEAVY_NOTICE;
        this.#gate.hidden = false;
      });
      const options = {
        base,
        controls: readControls(this.getAttribute("controls")),
      };
      const backend = this.getAttribute("backend");
      if (backend !== null && !["auto", "webgl", "webgpu"].includes(backend))
        throw new Error('backend must be "auto", "webgl" or "webgpu"');
      // Without backend, WebGL2 as before; awaited, so the poster stays until the driver has
      // linked the scene (decision 150)
      const scene = await mountAsync(canvas, code, { ...options, backend: (backend ?? "webgl") as "auto" | "webgl" | "webgpu" });
      if (run !== this.#run) { scene.destroy(); return; }
      this.#scene = scene;
      this.#heavy = false; // a new scene: drawn until it is too heavy itself
      this.#gate.hidden = true;
      this.#error.hidden = true;
      this.#showPoster(false);
      this.dispatchEvent(new Event("load"));
    } catch (error) {
      if (run !== this.#run) return;
      const message = error instanceof Error ? error.message : String(error);
      this.#error.textContent = message;
      this.#error.hidden = false;
      console.error(`<gss-scene>: ${message}`);
      this.dispatchEvent(new CustomEvent("error", { detail: message }));
    }
  }

  // src="logo.gss", or the text of a <script type="text/gss"> inside the element
  async #readSource(): Promise<{ code: string; base: string }> {
    const src = this.getAttribute("src");
    if (src) {
      const url = sourceUrl(src, document.baseURI);
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`cannot load ${url} (${response.status})`);
      return { code: await response.text(), base: url };
    }
    const inline = this.querySelector('script[type="text/gss"]');
    if (!inline)
      throw new Error('no scene: add src="…" or a <script type="text/gss">');
    return { code: inline.textContent ?? "", base: document.baseURI };
  }

  // The poster, while there is one and no scene drawn
  #showPoster(shown: boolean): void {
    const poster = this.getAttribute("poster");
    if (poster) this.#poster.src = poster;
    this.#poster.hidden = !shown || !poster;
  }

  #stop(): void {
    this.#scene?.destroy();
    this.#scene = null;
  }
}

if (!customElements.get("gss-scene"))
  customElements.define("gss-scene", GssSceneElement);

declare global {
  interface HTMLElementTagNameMap {
    "gss-scene": GssSceneElement;
  }
}
