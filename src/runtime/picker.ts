import { decodeId } from "./hover";

// :hover without stopping the CPU. The picking pass draws one pixel into a 1×1 image;
// the GPU copies it into a buffer of its own (a PBO), and a fence tells when it's done.
// The id comes back one or two frames later: invisible, and nothing waits for it.
export type Picker = {
  // Draws the picking pass with draw(), then asks for its pixel without waiting.
  // Skipped while the previous pixel is still on its way.
  request(draw: () => void): boolean; // false: a pixel is still on its way, nothing sent
  // The id read back since the last call (0: the background), or null if none came back
  poll(): number | null;
  destroy(): void;
};

export function createPicker(gl: WebGL2RenderingContext): Picker {
  // The 1×1 image the picking pass draws into
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // The buffer on the GPU that receives the pixel: 4 bytes, r g b a
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
  gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

  const pixel = new Uint8Array(4); // where poll() copies it, once ready
  let sync: WebGLSync | null = null; // the fence of the pixel on its way, if any

  return {
    request(draw) {
      if (sync) return false; // a pixel is on its way: one at a time
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, 1, 1);
      draw();
      // Into the buffer, not into an array: the last argument is an offset,
      // and the CPU goes on at once. The framebuffer must still be the 1×1 image.
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); // "tell me when all this is done"
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); // back to the canvas
      return true;
    },

    poll() {
      if (!sync) return null;
      if (gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED) return null; // not yet
      gl.deleteSync(sync);
      sync = null;
      // The copy is done: reading the buffer does not wait for the GPU any more
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixel);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return decodeId(pixel);
    },

    destroy() {
      if (sync) gl.deleteSync(sync);
      sync = null;
      gl.deleteBuffer(buffer);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
    },
  };
}
