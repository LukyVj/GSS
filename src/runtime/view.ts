import type { CameraSettings } from "../compiler/features/camera";
import type { CompiledScene } from "../compiler";
import { createTextureStore, paintName, resolveImage } from "./textures";
import { createPaints, PAINT_SIZE, type PaintSet } from "./paint";
import { pickPixel, pointerValues, createPress } from "./hover";
import { createPicker } from "./picker";
import { createClock } from "./clock";
import type { FrameProbe } from "../profiler/profiler";
import type { Dpr } from "../compiler/features/dpr";
import { pixelRatio } from "./dpr";
import { createDprPicker, viewDensity } from "./dpr-picker";
import { createTransitions } from "./transitions";
import { createTriggers } from "./triggers";
import { createScrollSlider, timelineValues } from "./timeline";
import type { Timeline } from "../compiler/features/timeline";
import { pickVariant, watchMedia, matchesNow } from "./media";
import { createPost } from "./post";
import { createProperties } from "./properties";
import { createDemand, movesWithTime } from "./demand";

// Draws compiled GSS scenes in a canvas, with a camera the mouse can move.
// It never imports the compiler (decision 63): a page that embeds a scene compiled
// at build time only ships this file. createRenderer (renderer.ts) adds load(source).
export type View = {
  // A compiled scene → on screen. Throws on a GLSL error, before touching the
  // current scene: if the new shader is invalid, the old scene stays visible.
  // The program links without blocking the page where the browser can (decision 150):
  // the promise settles once the scene is on screen, rejected if the driver cannot link it.
  // Until then, the scene before it stays.
  show(compiled: CompiledScene): Promise<void>;
  // Images drawn since the previous call, and over how many milliseconds (for "60 fps")
  sampleFrames(): { frames: number; ms: number };
  // Stops drawing (off screen) and starts again; the clock stops too. A scene too heavy for
  // the computer stops on its own and fires gss-too-heavy on the canvas (decision 142):
  // play() then draws it anyway, and it never stops on its own again.
  pause(): void;
  play(): void;
  // prefers-reduced-motion: the time and the camera spin stand still
  freeze(frozen: boolean): void;
  // Stops the loop and frees the GPU (browsers limit the number of WebGL canvases)
  destroy(): void;
  // @property (decision 105): a variable the scene registers, set from the page without
  // compiling again, like element.style.setProperty(). The value stays when the scene changes.
  setProperty(name: string, value: string | number): void;
  getPropertyValue(name: string): string;
  removeProperty(name: string): void;
};

export type ViewOptions = {
  // Drag turns the camera, the wheel zooms (default). false: only :hover
  controls?: boolean;
  // The URL of the .gss file: its images are read next to it
  base?: string;
  // Dev only: gets the WebGL context, returns what to tell about each frame
  profile?: (gl: WebGL2RenderingContext) => FrameProbe;
  // The playground and the docs, which do not scroll: a slider stands in for the
  // scroll of the page when a scene uses scroll() or view() (decision 96)
  scrollSlider?: boolean;
  // The docs and the playground: a menu over the render picks the dpr, auto follows the
  // frame rate (decision 120)
  dprPicker?: boolean;
  // true (default): the dpr starts light and follows the frame rate, and a scene too heavy
  // for the computer stops (decision 142). false: always the scene's dpr, never stopped,
  // for a capture or a benchmark.
  adaptDpr?: boolean;
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
  // scroll() and view(): what each component of uTimeline follows (decision 96)
  timelines?: Timeline[];
  uTimeline: WebGLUniformLocation | null;
  // One per image of the scene, in the order of uTexture0, uTexture1…
  textures: WebGLTexture[];
  uTextures: (WebGLUniformLocation | null)[];
  // :hover: for each slot of uHover[], the ids that set it to 1 (empty: no :hover)
  hover: number[][];
  active?: number[][]; // :active: the slots after the hover slots (decision 95)
  uHover: WebGLUniformLocation | null;
  uStart: WebGLUniformLocation | null; // the states that start an animation (decision 141)
  uPicking: WebGLUniformLocation | null;
  uPick: WebGLUniformLocation | null;
  uProperties: WebGLUniformLocation | null; // @property (decision 105)
  moves: boolean; // the image changes with time alone (decision 134)
  paints: PaintSet | null; // the textures its @paint draw (decision 151)
};

export function createView(
  canvas: HTMLCanvasElement,
  options: ViewOptions = {},
): View {
  const { controls = true, base } = options;
  // --- 1. Prepare WebGL ---
  const gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL2 is not available in this browser");
  const vertexArray = gl.createVertexArray();
  gl.bindVertexArray(vertexArray);
  const probe = options.profile?.(gl); // undefined: no profiler, nothing happens
  // The images, kept for every scene this renderer will load
  const store = createTextureStore(gl);
  // Links a program without blocking the page (decision 150). On Windows, the driver turns a
  // large shader into Direct3D code for seconds: asked at once, LINK_STATUS waits for it.
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  // texture: paint(name): each @paint draws into its own texture (decision 151)
  const paints = createPaints(gl, () => gl.bindVertexArray(vertexArray));

  // :hover: the picking pass reads the id under the mouse without stopping the CPU
  // (picker.ts). The answer comes one or two frames later; until then, the last one holds.
  const picker = createPicker(gl);
  let hovered = 0; // the id under the mouse, as last read back (0: nothing)
  const press = createPress(); // :active: the object pressed, until the button goes up
  const slider = options.scrollSlider ? createScrollSlider(canvas) : null;
  const density = viewDensity(options); // decisions 120 and 142
  const dprMenu = density && options.dprPicker ? createDprPicker(canvas, density) : null; // docs and playground only
  let dpr: Dpr = "auto"; // the pixel density the scene asks for (scene { dpr })
  let transitions = createTransitions([]); // how each hover slot glides (transition)
  let triggers = createTriggers([], 0); // the states that start an animation (decision 141)
  let reducedMotion = false; // freeze(): transitions jump, like the animations stop
  let shown: CompiledScene | null = null; // the version on screen (@media)
  let stopMedia = () => {}; // stops listening to the @media queries of the scene
  const properties = createProperties(); // @property: what the page set (decision 105)
  const demand = createDemand(); // render on demand (decision 134)
  let pickWanted = false; // the pointer moved since the last picking pass
  // The profiler draws every frame while it measures (decision 134)
  const measuring = () => probe !== undefined && (probe.measuring?.() ?? true);

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

  // A program: the giant triangle and a fragment shader. A GLSL error throws at once; the
  // link goes on in the driver, until linked() asks for its result
  function startLink(fragSource: string): WebGLProgram {
    const vertex = compileShader(gl!.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = compileShader(gl!.FRAGMENT_SHADER, fragSource);
    const program = gl!.createProgram()!;
    gl!.attachShader(program, vertex);
    gl!.attachShader(program, fragment);
    gl!.linkProgram(program);
    gl!.deleteShader(vertex); // the program keeps what it needs
    gl!.deleteShader(fragment);
    return program;
  }

  // Waits for the link if it is not done: throws, and frees the program, when it failed
  function linked(program: WebGLProgram): WebGLProgram {
    if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) {
      const log = gl!.getProgramInfoLog(program);
      gl!.deleteProgram(program);
      throw new Error(log ?? "Program linking error");
    }
    return program;
  }

  const link = (fragSource: string) => linked(startLink(fragSource));

  // filter: the passes after the scene, when it has some (decision 83)
  const post = createPost(gl, link);

  function createGpuScene(
    program: WebGLProgram,
    paintSet: PaintSet | null,
    files: string[],
    hover: number[][],
    active?: number[][],
    timelines?: Timeline[],
    moves = true,
  ): GpuScene {
    return {
      program,
      moves,
      uResolution: gl!.getUniformLocation(program, "iResolution"),
      uTime: gl!.getUniformLocation(program, "iTime"),
      uCamera: gl!.getUniformLocation(program, "uCamera"),
      uDist: gl!.getUniformLocation(program, "uDist"),
      timelines,
      uTimeline: gl!.getUniformLocation(program, "uTimeline"),
      textures: files.map((file) => {
        const name = paintName(file);
        return (name !== null && paintSet?.texture(name)) || store.get(resolveImage(file, base));
      }),
      paints: paintSet,
      uTextures: files.map((_, i) =>
        gl!.getUniformLocation(program, `uTexture${i}`),
      ),
      hover,
      active,
      uHover: gl!.getUniformLocation(program, "uHover"),
      uStart: gl!.getUniformLocation(program, "uStart"),
      uPicking: gl!.getUniformLocation(program, "uPicking"),
      uPick: gl!.getUniformLocation(program, "uPick"),
      uProperties: gl!.getUniformLocation(program, "uProperties"),
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

  // :active: pressed on the object under the pointer; a touch has no hover before it,
  // so the press also aims the picking pass (decision 95)
  canvas.addEventListener("pointerdown", (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    pickWanted = true;
    press.down(hovered);
  });
  // Released anywhere, like CSS: the button can go up outside the canvas
  const release = () => press.up();
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);

  canvas.addEventListener("pointermove", (e) => {
    pointer = { x: e.clientX, y: e.clientY }; // before the return: hover works without a drag
    pickWanted = true;
    if (!camera.dragging) return;
    camera.yaw += e.movementX * 0.01;
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

  // mouse in a @paint: the last pointer over the canvas, in the pixels of its texture, from
  // the bottom left like gl_FragCoord (decision 151)
  let paintPointer: [number, number] = [0, 0];
  function paintMouse(): [number, number] {
    if (pointer) {
      const box = canvas.getBoundingClientRect();
      paintPointer = [
        ((pointer.x - box.left) / Math.max(box.width, 1)) * PAINT_SIZE,
        (1 - (pointer.y - box.top) / Math.max(box.height, 1)) * PAINT_SIZE,
      ];
    }
    return paintPointer;
  }

  // The pixel of the canvas under the mouse, or null when the mouse is outside it
  function pointerPixel(): [number, number] | null {
    return pointer
      ? pickPixel(
          pointer.x,
          pointer.y,
          canvas.getBoundingClientRect(),
          canvas.width,
          canvas.height,
        )
      : null;
  }

  // :hover: asks which object is under the mouse. The picking pass is the scene
  // drawn on one pixel; picker.ts brings its id back later, without waiting.
  function requestPick(scene: GpuScene, pixel: [number, number]): void {
    const sent = picker.request(() => {
      gl!.uniform1i(scene.uPicking, 1);
      gl!.uniform2f(scene.uPick, pixel[0], pixel[1]);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      gl!.uniform1i(scene.uPicking, 0);
    });
    if (sent) pickWanted = false;
    gl!.viewport(0, 0, canvas.width, canvas.height); // the picker drew on 1×1
  }

  // --- 4. Adapt the canvas size to its box ---
  function resize(): number {
    const authored = pixelRatio(dpr, window.devicePixelRatio);
    const ratio = density ? density.ratio(authored, window.devicePixelRatio) : authored;
    const width = Math.floor(canvas.clientWidth * ratio);
    const height = Math.floor(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return ratio;
  }

  // --- 5. The render loop: once per image ---
  const clock = createClock(performance.now());
  let frameId = 0;
  let playing = true;
  let halted = false; // too heavy for the computer (decision 142), until play()
  let framesSinceSample = 0;
  let sampleStart = performance.now();

  function frame(now: number) {
    framesSinceSample++;
    const dt = clock.tick(now); // seconds since the previous image (0 when frozen)

    // Automatic rotation, except during the drag
    if (settings && !camera.dragging) camera.yaw -= dt * settings.spin;

    const drawn = resize(); // not inside dprMenu?.(): it must run without the menu too
    dprMenu?.update(drawn);
    gl!.viewport(0, 0, canvas.width, canvas.height);

    probe?.frameStart(now, canvas.width, canvas.height);

    if (scene) {
      // Too heavy for the computer: stop, and say so (decision 142)
      if (!document.hidden && density?.frame(now)) {
        playing = false;
        halted = true;
        canvas.dispatchEvent(new CustomEvent("gss-too-heavy"));
        return;
      }
      // :hover: which object is under the mouse, then how far each slot has glided
      const hovers = scene.hover.length + (scene.active?.length ?? 0) > 0;
      const pixel = hovers ? pointerPixel() : null;
      let glides: Float32Array | null = null;
      let started: Float32Array | null = null; // uStart[]
      if (hovers) {
        const id = picker.poll(); // the answer to an earlier request, if it came back
        if (id !== null && pointer) {
          hovered = id;
          press.picked(id);
        }
        if (!pixel) {
          hovered = 0; // outside the canvas: nothing is hovered, at once
          pickWanted = false;
        }
        const pointed = pointerValues(scene.hover, scene.active, hovered, press.id);
        // A state that starts an animation holds until it ends (decision 141)
        const { targets, starts } = triggers.update(pointed, clock.seconds);
        glides = transitions.update(targets, now, reducedMotion);
        if (starts.length > 0) started = starts;
      }
      const values = properties.values();
      const timeline = scene.timelines
        ? timelineValues(scene.timelines, canvas, slider?.value() ?? null)
        : null;
      // Render on demand (decision 134): the state of the last frame drawn, nothing to draw;
      // the mouse may still have moved over the frame on screen
      const changed = demand.need([
        canvas.width,
        canvas.height,
        canvas.clientWidth,
        scene.moves ? clock.seconds : 0,
        camera.yaw,
        camera.pitch,
        camera.dist,
        store.version(),
        ...(values ?? []),
        ...(timeline ?? []),
        ...(glides ?? []),
        ...(scene.paints?.pointer ? paintMouse() : []), // a @paint that reads mouse
      ]);
      if (!changed && !measuring()) {
        if (pixel && pickWanted) {
          gl!.useProgram(scene.program); // its uniforms are those of the frame on screen
          requestPick(scene, pixel);
        }
        frameId = requestAnimationFrame(frame);
        return;
      }
      // The textures of its @paint, before the scene samples them (decision 151)
      if (scene.paints) {
        scene.paints.draw(clock.seconds, paintMouse());
        gl!.viewport(0, 0, canvas.width, canvas.height);
      }
      // We send the state to the shader
      gl!.useProgram(scene.program);
      gl!.uniform3f(scene.uResolution, canvas.width, canvas.height, 1);
      gl!.uniform1f(scene.uTime, clock.seconds);
      gl!.uniform2f(scene.uCamera, camera.yaw, camera.pitch);
      gl!.uniform1f(scene.uDist, camera.dist);
      if (values) gl!.uniform4fv(scene.uProperties, values);
      if (timeline) gl!.uniform4fv(scene.uTimeline, timeline);
      // Each image on its own texture unit, and each uTextureN told which unit to read
      scene.textures.forEach((texture, i) => {
        gl!.activeTexture(gl!.TEXTURE0 + i);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.uniform1i(scene!.uTextures[i], i);
      });
      probe?.drawStart(); // before the picking: its pass costs GPU time too
      // :hover: the object under the mouse in this frame, then uHover[] for every slot
      if (hovers) {
        if (pixel) requestPick(scene, pixel);
        gl!.uniform1fv(scene.uHover, glides!);
        if (started) gl!.uniform1fv(scene.uStart, started);
      }
      if (post.active()) {
        // filter: the scene into an image, then the passes; blur(4px) is 4 CSS pixels
        const ratio = canvas.width / Math.max(canvas.clientWidth, 1);
        post.render(
          () => gl!.drawArrays(gl!.TRIANGLES, 0, 3),
          canvas.width,
          canvas.height,
          clock.seconds,
          ratio,
          values,
        );
      } else {
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      }
      probe?.drawEnd();
    }
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  // Back on a hidden page: the time it was away is not a slow frame
  const onVisible = () => {
    if (!document.hidden) density?.resume(performance.now());
  };
  document.addEventListener("visibilitychange", onVisible);

  // One compiled scene (one version, with @media) on screen, once its program is linked
  let revision = 0; // the latest display(): a program still linking for an older one is dropped
  let linking: WebGLProgram | null = null;
  let destroyed = false;
  function display(compiled: CompiledScene, resetCamera: boolean): Promise<void> {
    const start = performance.now();
    // The @paint first: small programs, their GLSL errors at once (decision 151)
    const paintSet = compiled.paints ? paints.prepare(compiled.paints) : null;
    let program: WebGLProgram;
    try {
      program = startLink(compiled.shader); // GLSL errors, at once
    } catch (error) {
      paintSet?.destroy();
      throw error;
    }
    const ticket = ++revision;
    if (linking) gl!.deleteProgram(linking);
    linking = program;
    if (!parallel) {
      linking = null;
      swap(compiled, resetCamera, program, paintSet, start);
      return Promise.resolve();
    }
    // Asked once a frame: the page goes on while the driver links (decision 150)
    return new Promise((resolve, reject) => {
      const wait = () => {
        if (destroyed || ticket !== revision) {
          paintSet?.destroy(); // replaced: its program is freed, and its paints here
          return resolve();
        }
        if (!gl!.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
          requestAnimationFrame(wait);
          return;
        }
        linking = null;
        try {
          swap(compiled, resetCamera, program, paintSet, start);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      wait();
    });
  }

  // The linked program replaces the scene on screen
  function swap(compiled: CompiledScene, resetCamera: boolean, program: WebGLProgram, paintSet: PaintSet | null, start: number) {
    let next: GpuScene;
    try {
      next = createGpuScene(
        linked(program), // link errors
        paintSet,
        compiled.textures,
      compiled.hover,
      compiled.active,
        compiled.timelines,
        movesWithTime(compiled) || !!paintSet?.animated, // a @paint that reads time moves
      );
    } catch (error) {
      paintSet?.destroy();
      throw error;
    }
    try {
      post.set(compiled.passes); // GLSL errors of the passes
    } catch (error) {
      gl!.deleteProgram(next.program);
      paintSet?.destroy();
      throw error;
    }
    probe?.shaderBuilt(performance.now() - start);
    if (scene) {
      gl!.deleteProgram(scene.program);
      scene.paints?.destroy();
    }
    scene = next;
    shown = compiled;
    demand.forget(); // a new shader: its first frame is drawn
    properties.use(compiled.properties);
    hovered = 0; // the ids belong to the new scene now
    press.reset();
    slider?.show(compiled.timelines !== undefined);
    dpr = compiled.dpr;
    density?.restart(performance.now()); // its compile is not a slow frame
    transitions = createTransitions(compiled.transitions);
    triggers = createTriggers(compiled.triggers ?? [], compiled.transitions.length);
    if (resetCamera) applyCameraSettings(compiled.camera);
  }

  return {
    show(compiled) {
      // @media: the version for the screen now, then another one when it changes,
      // keeping the camera where the mouse left it
      const linkedNow = display(pickVariant(compiled, matchesNow), true); // GLSL errors
      stopMedia();
      stopMedia = compiled.media
        ? watchMedia(compiled.media.queries, () => {
            const next = pickVariant(compiled, matchesNow);
            if (next === shown) return;
            try {
              display(next, false).catch((error) => console.error(error));
            } catch (error) {
              console.error(error);
            }
          })
        : () => {};
      return linkedNow;
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
      if (halted) density?.insist(); // drawn anyway: never stopped again
      halted = false;
      density?.resume(performance.now());
      clock.resume(performance.now());
      frameId = requestAnimationFrame(frame);
    },
    freeze(frozen) {
      clock.freeze(frozen);
      reducedMotion = frozen;
    },
    setProperty: properties.set,
    getPropertyValue: properties.get,
    removeProperty: properties.remove,
    destroy() {
      probe?.destroy?.();
      stopMedia();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      slider?.destroy();
      dprMenu?.destroy();
      playing = false;
      destroyed = true;
      cancelAnimationFrame(frameId);
      if (linking) gl.deleteProgram(linking);
      linking = null;
      if (scene) gl.deleteProgram(scene.program);
      scene?.paints?.destroy();
      paints.destroy();
      scene = null;
      post.destroy();
      store.destroy();
      picker.destroy();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
