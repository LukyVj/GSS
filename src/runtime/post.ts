// filter: the passes after the scene (decision 83). The scene is drawn into an image, then
// each pass reads the images it needs (0 = the scene, n = what pass n - 1 drew) and draws
// the next one; the last pass draws on the screen. Only types come from the compiler.
import type { Pass } from "../compiler/features/filter";

type GpuPass = {
  program: WebGLProgram;
  inputs: number[];
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uRatio: WebGLUniformLocation | null;
  uInputs: (WebGLUniformLocation | null)[];
};

type Image = { texture: WebGLTexture; framebuffer: WebGLFramebuffer };

export type Post = {
  // The passes of a new scene; none: the scene is drawn straight on the screen
  set(passes: Pass[] | undefined): void;
  // Draws the scene through the passes; draw() draws the scene where it is told
  render(draw: () => void, width: number, height: number, time: number, ratio: number): void;
  active(): boolean;
  destroy(): void;
};

export function createPost(
  gl: WebGL2RenderingContext,
  link: (fragment: string) => WebGLProgram,
): Post {
  let passes: GpuPass[] = [];
  let images: Image[] = []; // the scene and every pass but the last
  let size = [0, 0];

  function freeImages() {
    for (const image of images) {
      gl.deleteTexture(image.texture);
      gl.deleteFramebuffer(image.framebuffer);
    }
    images = [];
    size = [0, 0];
  }

  // As many images as needed, of the size of the canvas
  function ensureImages(width: number, height: number) {
    if (images.length === passes.length && size[0] === width && size[1] === height) return;
    freeImages();
    for (let i = 0; i < passes.length; i++) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const framebuffer = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      images.push({ texture, framebuffer });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    size = [width, height];
  }

  function make(pass: Pass): GpuPass {
    const program = link(pass.shader);
    return {
      program,
      inputs: pass.inputs,
      uResolution: gl.getUniformLocation(program, "iResolution"),
      uTime: gl.getUniformLocation(program, "iTime"),
      uRatio: gl.getUniformLocation(program, "uRatio"),
      uInputs: pass.inputs.map((_, i) => gl.getUniformLocation(program, `uInput${i}`)),
    };
  }

  return {
    set(next) {
      // Every new pass compiles before the old ones go: an error leaves the scene as it was
      const built: GpuPass[] = [];
      try {
        for (const pass of next ?? []) built.push(make(pass));
      } catch (error) {
        for (const pass of built) gl.deleteProgram(pass.program);
        throw error; // GLSL errors
      }
      for (const pass of passes) gl.deleteProgram(pass.program);
      passes = built;
      freeImages();
    },
    active: () => passes.length > 0,
    render(draw, width, height, time, ratio) {
      ensureImages(width, height);
      // 1. The scene, into image 0
      gl.bindFramebuffer(gl.FRAMEBUFFER, images[0].framebuffer);
      draw();
      // 2. Each pass, into the next image, the last one on the screen
      passes.forEach((pass, n) => {
        const last = n === passes.length - 1;
        gl.bindFramebuffer(gl.FRAMEBUFFER, last ? null : images[n + 1].framebuffer);
        gl.useProgram(pass.program);
        pass.inputs.forEach((image, i) => {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, images[image].texture);
          gl.uniform1i(pass.uInputs[i], i);
        });
        gl.uniform3f(pass.uResolution, width, height, 1);
        gl.uniform1f(pass.uTime, time);
        gl.uniform1f(pass.uRatio, ratio);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
    },
    destroy() {
      for (const pass of passes) gl.deleteProgram(pass.program);
      passes = [];
      freeImages();
    },
  };
}
