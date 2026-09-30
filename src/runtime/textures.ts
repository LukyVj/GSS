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

      // The download, in the background
      const image = new Image();
      image.crossOrigin = "anonymous"; // an image from another site needs CORS to reach the GPU
      image.onload = () => upload(texture, image);
      image.onerror = () => console.warn(`GSS: cannot load the image ${file}`);
      image.src = file;

      textures.set(file, texture);
      return texture;
    },
    destroy() {
      for (const texture of textures.values()) gl.deleteTexture(texture);
      textures.clear();
    },
  };
}
