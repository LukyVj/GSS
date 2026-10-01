import type { CameraSettings } from "../compiler/camera";
import type { CompiledScene } from "../compiler";
import { createTextureStore, resolveImage } from "./textures";
import { pickPixel, hoverValues } from "./hover";
import { createPicker } from "./picker";
import { createClock } from "./clock";
import type { FrameProbe } from "../profiler/profiler";
import type { Dpr } from "../compiler/dpr";
import { pixelRatio } from "./dpr";

// Draws compiled GSS scenes in a canvas, with a camera the mouse can move.
// It never imports the compiler (decision 63): a page that embeds a scene compiled
// at build time only ships this file. createRenderer (renderer.ts) adds load(source).
export type View = {
  // A compiled scene → on screen. Throws on a GLSL error, before touching the
  // current scene: if the new shader is invalid, the old scene stays visible.
  show(compiled: CompiledScene): void;
  // Images drawn since the previous call, and over how many milliseconds (for "60 fps")
  sampleFrames(): { frames: number; ms: number };
  // Stops drawing (off screen) and starts again; the clock stops too
  pause(): void;
  play(): void;
  // prefers-reduced-motion: the time and the camera spin stand still
  freeze(frozen: boolean): void;
  // Stops the loop and frees the GPU (browsers limit the number of WebGL canvases)
  destroy(): void;
};

export type ViewOptions = {
  // Drag turns the camera, the wheel zooms (default). false: only :hover
  controls?: boolean;
  // The URL of the .gss file: its images are read next to it
  base?: string;
  // Dev only: gets the WebGL context, returns what to tell about each frame
  profile?: (gl: WebGL2RenderingContext) => FrameProbe;
};

// The vertex shader: a giant triangle that covers the whole canvas.
// The real work is done in the fragment shader, pixel by pixel.
const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

// A scene ready on the GPU: the program and the "addresses" of its uniforms
type GpuScene = {
  program: WebGLProgram;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uCamera: WebGLUniformLocation | null;
  uDist: WebGLUniformLocation | null;
  // One per image of the scene, in the order of uTexture0, uTexture1…
  textures: WebGLTexture[];
  uTextures: (WebGLUniformLocation | null)[];
  // :hover: for each slot of uHover[], the ids that set it to 1 (empty: no :hover)
  hover: number[][];
  uHover: WebGLUniformLocation | null;
  uPicking: WebGLUniformLocation | null;
  uPick: WebGLUniformLocation | null;
};

export function createView(
  canvas: HTMLCanvasElement,
  options: ViewOptions = {},
): View {
  const { controls = true, base } = options;
  // --- 1. Prepare WebGL ---
  const gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL2 is not available in this browser");
  gl.bindVertexArray(gl.createVertexArray());
  const probe = options.profile?.(gl); // undefined: no profiler, nothing happens
  // The images, kept for every scene this renderer will load
  const store = createTextureStore(gl);

  // :hover: the picking pass reads the id under the mouse without stopping the CPU
  // (picker.ts). The answer comes one or two frames later; until then, the last one holds.
  const picker = createPicker(gl);
  let hovered = 0; // the id under the mouse, as last read back (0: nothing)
  let dpr: Dpr = "auto"; // the pixel density the scene asks for (scene { dpr })

  function compileShader(type: number, source: string): WebGLShader {
    const shader = gl!.createShader(type)!;
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      const log = gl!.getShaderInfoLog(shader);
      gl!.deleteShader(shader);
      throw new Error(log ?? "Shader compilation error");
    }
    return shader;
  }

  function createGpuScene(
    fragSource: string,
    files: string[],
    hover: number[][],
  ): GpuScene {
    const vertex = compileShader(gl!.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = compileShader(gl!.FRAGMENT_SHADER, fragSource);
    const program = gl!.createProgram()!;
    gl!.attachShader(program, vertex);
    gl!.attachShader(program, fragment);
    gl!.linkProgram(program);
    gl!.deleteShader(vertex); // the program keeps what it needs
    gl!.deleteShader(fragment);
    if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) {
      const log = gl!.getProgramInfoLog(program);
      gl!.deleteProgram(program);
      throw new Error(log ?? "Program linking error");
    }
    return {
      program,
      uResolution: gl!.getUniformLocation(program, "iResolution"),
      uTime: gl!.getUniformLocation(program, "iTime"),
      uCamera: gl!.getUniformLocation(program, "uCamera"),
      uDist: gl!.getUniformLocation(program, "uDist"),
      textures: files.map((file) => store.get(resolveImage(file, base))),
      uTextures: files.map((_, i) =>
        gl!.getUniformLocation(program, `uTexture${i}`),
      ),
      hover,
      uHover: gl!.getUniformLocation(program, "uHover"),
      uPicking: gl!.getUniformLocation(program, "uPicking"),
      uPick: gl!.getUniformLocation(program, "uPick"),
    };
  }

  // --- 2. The state: this is where the memory lives ---
  let scene: GpuScene | null = null; // what is on screen
  let settings: CameraSettings | null = null; // the camera written in the GSS
  const camera = { yaw: 0, pitch: 0, dist: 8, dragging: false };
  let pointer: { x: number; y: number } | null = null; // the mouse, in the page

  // Only reset what the GSS changed, so that typing does not
  // move the camera the user has placed with the mouse.
  function applyCameraSettings(next: CameraSettings): void {
    if (
      !settings ||
      next.yaw !== settings.yaw ||
      next.pitch !== settings.pitch
    ) {
      camera.yaw = next.yaw;
      camera.pitch = next.pitch;
    }
    if (!settings || next.distance !== settings.distance) {
      camera.dist = next.distance;
    }
    settings = next;
  }

  // --- 3. The mouse moves the camera ---
  // (controls: false keeps only :hover: the page scrolls, the camera stays where the GSS put it)
  if (controls) {
    canvas.addEventListener("pointerdown", (e) => {
      camera.dragging = true;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault(); // zoom the scene, not the page
        camera.dist += e.deltaY * 0.01;
        camera.dist = Math.min(Math.max(camera.dist, 3), 15);
      },
      { passive: false },
    );
  }

  canvas.addEventListener("pointermove", (e) => {
    pointer = { x: e.clientX, y: e.clientY }; // before the return: hover works without a drag
    if (!camera.dragging) return;
    camera.yaw -= e.movementX * 0.01;
    camera.pitch += e.movementY * 0.01;
    camera.pitch = Math.min(Math.max(camera.pitch, 0.05), 1.4); // we block between the floor and the zenith
  });

  const stopDragging = () => {
    camera.dragging = false;
  };
  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener("pointerleave", () => {
    pointer = null; // nothing is hovered any more
  });

  // :hover: asks which object is under the mouse. The picking pass is the scene
  // drawn on one pixel; picker.ts brings its id back later, without waiting.
  function requestPick(scene: GpuScene): void {
    const pixel = pointer
      ? pickPixel(
          pointer.x,
          pointer.y,
          canvas.getBoundingClientRect(),
          canvas.width,
          canvas.height,
        )
      : null;
    if (!pixel) {
      hovered = 0; // outside the canvas: nothing is hovered, at once
      return;
    }
    picker.request(() => {
      gl!.uniform1i(scene.uPicking, 1);
      gl!.uniform2f(scene.uPick, pixel[0], pixel[1]);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      gl!.uniform1i(scene.uPicking, 0);
    });
    gl!.viewport(0, 0, canvas.width, canvas.height); // the picker drew on 1×1
  }

  // --- 4. Adapt the canvas size to its box ---
  function resize() {
    const ratio = pixelRatio(dpr, window.devicePixelRatio);
    const width = Math.floor(canvas.clientWidth * ratio);
    const height = Math.floor(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  // --- 5. The render loop: once per image ---
  const clock = createClock(performance.now());
  let frameId = 0;
  let playing = true;
  let framesSinceSample = 0;
  let sampleStart = performance.now();

  function frame(now: number) {
    framesSinceSample++;
    const dt = clock.tick(now); // seconds since the previous image (0 when frozen)

    // Automatic rotation, except during the drag
    if (settings && !camera.dragging) camera.yaw += dt * settings.spin;

    resize();
    gl!.viewport(0, 0, canvas.width, canvas.height);

    probe?.frameStart(now, canvas.width, canvas.height);

    if (scene) {
      // We send the state to the shader
      gl!.useProgram(scene.program);
      gl!.uniform3f(scene.uResolution, canvas.width, canvas.height, 1);
      gl!.uniform1f(scene.uTime, clock.seconds);
      gl!.uniform2f(scene.uCamera, camera.yaw, camera.pitch);
      gl!.uniform1f(scene.uDist, camera.dist);
      // Each image on its own texture unit, and each uTextureN told which unit to read
      scene.textures.forEach((texture, i) => {
        gl!.activeTexture(gl!.TEXTURE0 + i);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.uniform1i(scene!.uTextures[i], i);
      });
      probe?.drawStart(); // before the picking: its pass costs GPU time too
      // :hover: which object is under the mouse, then uHover[] for every slot
      if (scene.hover.length > 0) {
        const id = picker.poll(); // the answer to an earlier request, if it came back
        if (id !== null && pointer) hovered = id;
        requestPick(scene);
        gl!.uniform1fv(scene.uHover, hoverValues(scene.hover, hovered));
      }
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      probe?.drawEnd();
    }
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);

  return {
    show(compiled) {
      const start = performance.now();
      const next = createGpuScene(
        compiled.shader,
        compiled.textures,
        compiled.hover,
      ); // GLSL errors
      probe?.shaderBuilt(performance.now() - start);
      if (scene) gl.deleteProgram(scene.program);
      scene = next;
      hovered = 0; // the ids belong to the new scene now
      dpr = compiled.dpr;
      applyCameraSettings(compiled.camera);
    },
    sampleFrames() {
      const now = performance.now();
      const sample = { frames: framesSinceSample, ms: now - sampleStart };
      framesSinceSample = 0;
      sampleStart = now;
      return sample;
    },
    pause() {
      if (!playing) return;
      playing = false;
      cancelAnimationFrame(frameId);
    },
    play() {
      if (playing) return;
      playing = true;
      clock.resume(performance.now());
      frameId = requestAnimationFrame(frame);
    },
    freeze(frozen) {
      clock.freeze(frozen);
    },
    destroy() {
      playing = false;
      cancelAnimationFrame(frameId);
      if (scene) gl.deleteProgram(scene.program);
      scene = null;
      store.destroy();
      picker.destroy();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
