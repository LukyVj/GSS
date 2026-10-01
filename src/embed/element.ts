import { mount, type EmbeddedScene } from "./index";
import { readControls, sourceUrl } from "./options";

// <gss-scene>: a GSS scene in any page, without a build step (decision 63).
//
//   <script type="module" src="https://www.gss-lang.dev/embed.js"></script>
//   <gss-scene src="logo.gss"></gss-scene>
//   <gss-scene controls="none"><script type="text/gss"> @scene { sphere; } </script></gss-scene>
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
`;

export class GssSceneElement extends HTMLElement {
  static observedAttributes = ["src", "controls"];

  #canvas: HTMLCanvasElement;
  #error: HTMLPreElement;
  #scene: EmbeddedScene | null = null;
  #waiting: IntersectionObserver | null = null;
  #started = false;
  #run = 0; // the latest start(): an older fetch that arrives late is dropped

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style><canvas part="canvas"></canvas><pre class="error" part="error" hidden></pre>`;
    this.#canvas = root.querySelector("canvas")!;
    this.#error = root.querySelector("pre")!;
  }

  // The WebGL context and the compile only start when the scene comes near the screen
  connectedCallback(): void {
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
    this.#waiting?.disconnect();
    this.#waiting = null;
    this.#stop();
    this.#started = false;
  }

  attributeChangedCallback(
    _name: string,
    before: string | null,
    after: string | null,
  ): void {
    if (this.#started && before !== after) void this.#start();
  }

  // The scene, to pause(), play() or update() it from a script
  get scene(): EmbeddedScene | null {
    return this.#scene;
  }

  async #start(): Promise<void> {
    this.#started = true;
    const run = ++this.#run;
    try {
      const { code, base } = await this.#readSource();
      if (run !== this.#run) return;
      this.#stop(); // controls are set when the view is made: a change starts again
      this.#scene = mount(this.#canvas, code, {
        base,
        controls: readControls(this.getAttribute("controls")),
      });
      this.#error.hidden = true;
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
