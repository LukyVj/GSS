// The images of the scenes, on the GPU: one texture per file, shared by every scene
// the renderer loads, so typing in the playground does not download an image again.
export type TextureStore = {
  // The texture of a file. Until the image arrives it is one transparent pixel,
  // so the object keeps its color (triplanar() mixes by the alpha).
  get(file: string): WebGLTexture;
  // Frees every texture (the renderer is destroyed)
  destroy(): void;
};

export function createTextureStore(gl: WebGL2RenderingContext): TextureStore {
  const textures = new Map<string, WebGLTexture>();
  const elements = new Map<string, WebGLTexture>(); // element(#id): id → its texture
  const canvas = gl.canvas instanceof HTMLCanvasElement ? gl.canvas : null;
  const warned = new Set<string>();
  const warn = (message: string) => {
    if (!warned.has(message)) console.warn(message);
    warned.add(message);
  };

  // texture: element(#id) (decision 101): the browser draws the element (HTML-in-Canvas),
  // and says when it changes with a paint event on the canvas; only then can it be read
  function paint(): void {
    for (const [id, texture] of elements) {
      const element = findElement(canvas!, id);
      if (!element) {
        warn(`GSS: no element #${id} inside the scene's canvas: element(#${id}) stays empty`);
        continue;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // like the images
      try {
        const draw = (gl as unknown as { texElementImage2D: (...args: unknown[]) => void }).texElementImage2D;
        // Chromium 148 to 150 (the origin trial): target, level, formats, type, element;
        // since: target, internal format, element
        if (draw.length <= 3) draw.call(gl, gl.TEXTURE_2D, gl.RGBA8, element);
        else draw.call(gl, gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element);
      } catch (error) {
        warn(`GSS: cannot draw #${id}: ${error instanceof Error ? error.message : error}`);
        continue;
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }
  let watching = false;
  function watch(): void {
    if (!canvas || !("texElementImage2D" in gl)) {
      warn("GSS: this browser cannot draw HTML elements in a canvas yet: an object with element() keeps its color");
      return;
    }
    if (!watching) {
      canvas.setAttribute("layoutsubtree", ""); // the children are laid out, to be drawn
      canvas.addEventListener("paint", paint);
      watching = true;
    }
    (canvas as unknown as { requestPaint?: () => void }).requestPaint?.(); // a first paint, for a new element
  }

  // The image has arrived: it replaces the transparent pixel
  function upload(texture: WebGLTexture, image: HTMLImageElement): void {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Smooth for now; step 4: image-rendering: pixelated → NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  return {
    get(file) {
      const known = textures.get(file);
      if (known) return known;

      // One transparent pixel, right now: the shader can read it on the next frame
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0]),
      );
      textures.set(file, texture);

      // An HTML element of the page: drawn at each paint of the canvas
      const id = elementId(file);
      if (id !== null) {
        elements.set(id, texture);
        watch();
        return texture;
      }

      // The download, in the background
      const image = new Image();
      image.crossOrigin = "anonymous"; // an image from another site needs CORS to reach the GPU
      image.onload = () => upload(texture, image);
      image.onerror = () => console.warn(`GSS: cannot load the image ${file}`);
      image.src = file;
      return texture;
    },
    destroy() {
      canvas?.removeEventListener("paint", paint);
      for (const texture of textures.values()) gl.deleteTexture(texture);
      textures.clear();
      elements.clear();
    },
  };
}

// texture: element(#card) reaches the runtime as "element(#card)": the id, or null for a file
export function elementId(source: string): string | null {
  return /^element\(#([^()\s]+)\)$/.exec(source)?.[1] ?? null;
}

// The element of this id inside the canvas: a child, or an element that a <slot> of the
// canvas shows (the HTML children of <gss-scene>, whose canvas is in its shadow root)
export function findElement(canvas: Element, id: string): Element | null {
  const selector = `#${CSS.escape(id)}`;
  const inside = canvas.querySelector(selector);
  if (inside) return inside;
  for (const slot of canvas.querySelectorAll("slot"))
    for (const shown of slot.assignedElements({ flatten: true })) {
      const found = shown.id === id ? shown : shown.querySelector(selector);
      if (found) return found;
    }
  return null;
}

// Does the scene, or one of its versions (@media), show an element of the page?
export function usesElements(scene: { textures: string[]; media?: { variants: { textures: string[] }[] } }): boolean {
  return [scene, ...(scene.media?.variants ?? [])].some((version) => version.textures.some((file) => elementId(file) !== null));
}

// Where an image of the scene lives: next to the .gss file, like url() in a stylesheet.
// Without a base (the playground, the docs), the path stays as written.
export function resolveImage(file: string, base?: string): string {
  return base && elementId(file) === null ? new URL(file, base).href : file; // an element is no file
}
