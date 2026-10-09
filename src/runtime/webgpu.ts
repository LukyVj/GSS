import type { CompiledScene } from "../compiler";
import type { AsyncView, BackendOptions } from "./backend";
import { createClock } from "./clock";
import { pixelRatio } from "./dpr";
import { createDprPicker, viewDensity } from "./dpr-picker";
import { pickPixel, pointerValues, createPress, decodeId, cursorAt } from "./hover";
import { createTransitions } from "./transitions";
import { createTriggers } from "./triggers";
import { createScrollSlider, timelineValues } from "./timeline";
import { pickVariant, WINDOW_MEDIA } from "./media";
import { elementId, paintName, resolveImage } from "./textures";
import { createProperties } from "./properties";
import { createDemand, movesWithTime } from "./demand";

type ImageEntry = { texture: GPUTexture; image: HTMLImageElement };
type Pipeline = { pipeline: GPURenderPipeline; inputs: number[]; textures: string[] };
type Scene = {
  compiled: CompiledScene;
  layout: GPUBindGroupLayout;
  pipelines: Pipeline[];
  picking: GPURenderPipeline | null;
  uniforms: GPUBuffer;
  pickUniforms: GPUBuffer;
  values: Float32Array;
  groups: GPUBindGroup[];
  pickGroup: GPUBindGroup | null;
  images: GPUTexture[];
  textureVersion: number;
  moves: boolean; // the image changes with time alone (decision 134)
};

// Device acquisition is separate from canvas configuration so auto selection can
// fall back before a canvas is committed to a WebGPU context.
export async function requestWebGPU(profiling = false): Promise<GPUDevice> {
  if (!navigator.gpu) throw new Error("WebGPU is not available in this browser (HTTPS or localhost required)");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU could not acquire a GPU adapter");
  if (profiling && adapter.features.has("timestamp-query")) {
    try { return await adapter.requestDevice({ requiredFeatures: ["timestamp-query"] }); }
    catch { /* Keep CPU/FPS profiling if timestamp device creation fails. */ }
  }
  return adapter.requestDevice();
}

export function createWebGPUView(canvas: HTMLCanvasElement, device: GPUDevice, options: BackendOptions = {}): AsyncView {
  const format = navigator.gpu.getPreferredCanvasFormat();
  const context = canvas.getContext("webgpu");
  if (!context) { device.destroy(); throw new Error("Cannot create a WebGPU canvas context"); }
  context.configure({ device, format, alphaMode: "opaque" });
  const probe = options.profileWebGPU?.(device);
  const sampler = device.createSampler({ minFilter: "linear", magFilter: "linear" });
  const textures = new Map<string, ImageEntry>();
  let textureVersion = 0;
  let destroyed = false;
  let revision = 0;
  let scene: Scene | null = null;
  let root: CompiledScene | null = null;
  let stopMedia = () => {};
  const media = options.viewport?.(canvas) ?? WINDOW_MEDIA; // decision 165
  let hovered = 0;
  const press = createPress(); // :active (decision 95)
  const slider = options.scrollSlider ? createScrollSlider(canvas) : null; // decision 96
  const density = viewDensity(options); // decisions 120 and 142
  const dprMenu = density && options.dprPicker ? createDprPicker(canvas, density) : null; // docs and playground only
  let reducedMotion = false;
  const properties = createProperties(); // @property: what the page set (decision 105)
  let transitions = createTransitions([]);
  let triggers = createTriggers([], 0); // the states that start an animation (decision 141)
  let settings: CompiledScene["camera"] | null = null;
  const camera = { yaw: 0, pitch: 0, dist: 8, dragging: false };
  let pointer: { x: number; y: number } | null = null;
  const clock = createClock(performance.now());
  let playing = true;
  let halted = false; // too heavy for the computer (decision 142), until play()
  let frameId = 0;
  let frames = 0;
  let sampleStart = performance.now();
  let pickPending = false;
  let pickGeneration = 0;
  const demand = createDemand(); // render on demand (decision 134)
  let pickWanted = false; // the pointer moved since the last picking pass
  // The profiler draws every frame while it measures (decision 134)
  const measuring = () => probe !== undefined && (probe.measuring?.() ?? true);
  const pickTexture = device.createTexture({ size: [1, 1], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const readback = device.createBuffer({ size: 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const listeners: (() => void)[] = [];
  function on<K extends keyof HTMLElementEventMap>(event: K, listener: (event: HTMLElementEventMap[K]) => void, config?: AddEventListenerOptions) {
    canvas.addEventListener(event, listener, config);
    listeners.push(() => canvas.removeEventListener(event, listener, config));
  }
  if (options.controls !== false) {
    on("pointerdown", e => { camera.dragging = true; canvas.setPointerCapture(e.pointerId); });
    on("wheel", e => { e.preventDefault(); camera.dist = Math.min(Math.max(camera.dist + e.deltaY * 0.01, 3), 15); }, { passive: false });
  }
  on("pointerdown", e => { pointer = { x: e.clientX, y: e.clientY }; pickWanted = true; press.down(hovered); });
  const unpress = () => press.up(); // released anywhere, like CSS
  window.addEventListener("pointerup", unpress);
  window.addEventListener("pointercancel", unpress);
  listeners.push(() => { window.removeEventListener("pointerup", unpress); window.removeEventListener("pointercancel", unpress); });
  on("pointermove", e => {
    pointer = { x: e.clientX, y: e.clientY };
    pickWanted = true;
    if (!camera.dragging) return;
    camera.yaw += e.movementX * 0.01;
    camera.pitch = Math.min(Math.max(camera.pitch + e.movementY * 0.01, 0.05), 1.4);
  });
  on("pointerup", () => { camera.dragging = false; });
  on("pointercancel", () => { camera.dragging = false; });
  on("pointerleave", () => { pointer = null; hovered = 0; pickGeneration++; });

  function image(file: string): GPUTexture {
    const url = resolveImage(file, options.base);
    const known = textures.get(url);
    if (known) return known.texture;
    const texture = device.createTexture({ size: [1, 1], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture }, new Uint8Array(4), { bytesPerRow: 4 }, [1, 1]);
    // element(#id) (decision 101): WebGPU cannot copy an element yet; the transparent pixel
    // stays, so the object keeps its color (mountAsync draws such a scene with WebGL2)
    // paint(name) too (decision 151): WebGPU cannot run its GLSL
    if (elementId(file) !== null || paintName(file) !== null) {
      console.warn(`GSS: ${file} is drawn with WebGL2 only for now: with WebGPU, the object keeps its color`);
      textures.set(url, { texture, image: new Image() });
      return texture;
    }
    const element = new Image();
    const entry = { texture, image: element };
    textures.set(url, entry);
    element.crossOrigin = "anonymous";
    element.onload = () => {
      if (destroyed) return;
      const next = device.createTexture({ size: [element.naturalWidth, element.naturalHeight], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      device.queue.copyExternalImageToTexture({ source: element, flipY: true }, { texture: next }, [element.naturalWidth, element.naturalHeight]);
      entry.texture.destroy(); entry.texture = next; textureVersion++;
    };
    element.onerror = () => { if (!destroyed) console.warn(`GSS: cannot load the image ${url}`); };
    element.src = url;
    return texture;
  }
  function release(next: Scene) {
    next.uniforms.destroy(); next.pickUniforms.destroy();
    next.images.forEach(t => t.destroy());
  }
  function resize(): number {
    const authored = pixelRatio(scene?.compiled.dpr ?? "auto", window.devicePixelRatio);
    const ratio = density ? density.ratio(authored, window.devicePixelRatio) : authored;
    const max = device.limits.maxTextureDimension2D;
    const width = Math.max(1, Math.min(max, Math.floor(canvas.clientWidth * ratio)));
    const height = Math.max(1, Math.min(max, Math.floor(canvas.clientHeight * ratio)));
    if (canvas.width === width && canvas.height === height) return ratio;
    canvas.width = width; canvas.height = height;
    if (scene) { scene.images.forEach(t => t.destroy()); scene.images = []; scene.groups = []; }
    return ratio;
  }
  function bindings(current: Scene) {
    const passes = current.pipelines.length - 1;
    if (current.images.length !== passes) {
      current.images = Array.from({ length: passes }, () => device.createTexture({ size: [canvas.width, canvas.height], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
    }
    if (current.groups.length && current.textureVersion === textureVersion) return;
    const group = (p: Pipeline, uniforms: GPUBuffer) => device.createBindGroup({
      layout: current.layout,
      entries: [
        { binding: 0, resource: { buffer: uniforms } },
        { binding: 1, resource: sampler },
        ...Array.from({ length: Math.max(current.compiled.textures.length, passes ? 3 : 0) }, (_, i) => ({
          binding: i + 2,
          resource: (p.textures.length ? image(p.textures[i] ?? p.textures[0]) : current.images[p.inputs[i] ?? p.inputs[0]])?.createView() ?? fallback.createView(),
        })),
      ],
    });
    current.groups = current.pipelines.map(p => group(p, current.uniforms));
    current.pickGroup = current.picking ? group(current.pipelines[0], current.pickUniforms) : null;
    current.textureVersion = textureVersion;
  }
  const fallback = device.createTexture({ size: [1, 1], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  device.queue.writeTexture({ texture: fallback }, new Uint8Array(4), { bytesPerRow: 4 }, [1, 1]);

  async function prepare(compiled: CompiledScene): Promise<Scene> {
    if (!compiled.wgsl || compiled.passes?.some(p => !p.wgsl)) throw new Error("This scene has no WGSL target. Recompile it with compile(source) or the current GSS Vite plugin.");
    const count = Math.max(compiled.textures.length, compiled.passes?.length ? 3 : 0);
    if (count > device.limits.maxSampledTexturesPerShaderStage) throw new Error("This scene exceeds the WebGPU device's texture limit");
    const slots = compiled.hover.length + (compiled.active?.length ?? 0);
    // uTimeline goes after the hover slots (decision 96), uProperties after it (decision 105),
    // uStart after them (decision 141)
    const size = 48 + 16 * Math.max(1, slots) + (compiled.timelines ? 16 : 0) + 16 * (compiled.properties?.length ?? 0) + 16 * (compiled.triggers?.length ?? 0);
    if (size > device.limits.maxUniformBufferBindingSize) throw new Error("This scene exceeds the WebGPU device's uniform buffer limit");
    const layout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform", minBindingSize: size } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ...Array.from({ length: count }, (_, i) => ({ binding: i + 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" as const } })),
    ] });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    async function pipeline(code: string, target: GPUTextureFormat): Promise<GPURenderPipeline> {
      const module = device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter(m => m.type === "error");
      if (errors.length) throw new Error(errors.map(m => `WGSL ${m.lineNum}:${m.linePos}: ${m.message}`).join("\n"));
      return device.createRenderPipelineAsync({ layout: pipelineLayout, vertex: { module, entryPoint: "vertexMain" }, fragment: { module, entryPoint: "fragmentMain", targets: [{ format: target }] } });
    }
    const passes = compiled.passes ?? [];
    const pipelines: Pipeline[] = [{ pipeline: await pipeline(compiled.wgsl, passes.length ? "rgba8unorm" : format), inputs: [], textures: compiled.textures }];
    for (const [i, pass] of passes.entries()) pipelines.push({ pipeline: await pipeline(pass.wgsl!, i === passes.length - 1 ? format : "rgba8unorm"), inputs: pass.inputs, textures: [] });
    // cursor (decision 161) needs the object under the mouse too
    const picking = slots || compiled.cursors ? await pipeline(compiled.wgsl, "rgba8unorm") : null;
    return {
      compiled, layout, pipelines, picking,
      uniforms: device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
      pickUniforms: device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
      values: new Float32Array(size / 4), groups: [], pickGroup: null, images: [], textureVersion: -1,
      moves: movesWithTime(compiled),
    };
  }
  async function display(compiled: CompiledScene, resetCamera: boolean) {
    const ticket = ++revision;
    const start = performance.now();
    const next = await prepare(compiled);
    if (destroyed || ticket !== revision) { release(next); return; }
    if (scene) release(scene);
    if (scene?.compiled.cursors) canvas.style.cursor = ""; // the cursors belong to the new scene now
    scene = next;
    demand.forget(); // a new pipeline: its first frame is drawn
    properties.use(compiled.properties);
    probe?.shaderBuilt(performance.now() - start);
    hovered = 0; press.reset(); pickGeneration++;
    slider?.show(compiled.timelines !== undefined);
    density?.restart(performance.now()); // its compile is not a slow frame
    transitions = createTransitions(compiled.transitions);
    triggers = createTriggers(compiled.triggers ?? [], compiled.transitions.length);
    if (resetCamera) {
      const next = compiled.camera;
      if (!settings || next.yaw !== settings.yaw || next.pitch !== settings.pitch) { camera.yaw = next.yaw; camera.pitch = next.pitch; }
      if (!settings || next.distance !== settings.distance) camera.dist = next.distance;
      settings = next;
    }
  }
  let firstPass = true;
  function draw(encoder: GPUCommandEncoder, pipeline: GPURenderPipeline, group: GPUBindGroup, target: GPUTextureView, last = false) {
    const timestampWrites = probe?.timestampWrites?.(firstPass, last);
    firstPass = false;
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: target, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }], ...(timestampWrites ? { timestampWrites } : {}) });
    pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.draw(3); pass.end();
  }
  function frame(now: number) {
    if (destroyed || !playing) return;
    frames++;
    // Initial asynchronous compilation must not consume the animation's start.
    let dt = 0;
    if (scene) dt = clock.tick(now);
    else clock.resume(now);
    if (settings && !camera.dragging) camera.yaw -= dt * settings.spin;
    const drawn = resize(); // not inside dprMenu?.(): it must run without the menu too
    dprMenu?.update(drawn);
    if (scene) {
      // Too heavy for the computer: stop, and say so (decision 142)
      if (!document.hidden && density?.frame(now)) {
        playing = false;
        halted = true;
        canvas.dispatchEvent(new CustomEvent("gss-too-heavy"));
        return;
      }
      const current = scene;
      const v = current.values;
      v.set([canvas.width, canvas.height, 1, clock.seconds, camera.yaw, camera.pitch, camera.dist, canvas.width / Math.max(canvas.clientWidth, 1), 0, 0, 0, 0]);
      if (current.compiled.cursors) canvas.style.cursor = cursorAt(current.compiled.cursors, hovered, press.id);
      // A state that starts an animation holds until it ends (decision 141)
      const held = triggers.update(pointerValues(current.compiled.hover, current.compiled.active, hovered, press.id), clock.seconds);
      const targets = transitions.update(held.targets, now, reducedMotion);
      targets.forEach((value, i) => { v[12 + 4 * i] = value; });
      const { timelines, hover, active } = current.compiled;
      const after = 12 + 4 * Math.max(1, hover.length + (active?.length ?? 0));
      if (timelines) v.set(timelineValues(timelines, canvas, slider?.value() ?? null), after);
      const values = properties.values();
      if (values) v.set(values, after + (timelines ? 4 : 0));
      const startsAt = after + (timelines ? 4 : 0) + (values?.length ?? 0); // 4 floats per property
      held.starts.forEach((value, i) => { v[startsAt + 4 * i] = value; });
      // Render on demand (decision 134): the state of the last frame drawn, nothing to draw;
      // the mouse may still have moved over the frame on screen
      const state = Array.from(v);
      if (!current.moves) state[3] = 0; // the time, which this image does not read
      state.push(textureVersion, canvas.clientWidth);
      const drawing = demand.need(state) || measuring();
      const pick = current.picking !== null && !pickPending && pointer !== null && (drawing || pickWanted);
      if (!drawing && !pick) {
        frameId = requestAnimationFrame(frame);
        return;
      }
      if (drawing) {
        probe?.frameStart(now, canvas.width, canvas.height);
        probe?.drawStart();
      }
      firstPass = true;
      bindings(current);
      if (drawing) device.queue.writeBuffer(current.uniforms, 0, v);
      const encoder = device.createCommandEncoder();
      let picking = false;
      if (pick && pointer) {
        pickWanted = false;
        const pixel = pickPixel(pointer.x, pointer.y, canvas.getBoundingClientRect(), canvas.width, canvas.height);
        if (pixel) {
          v[8] = pixel[0]; v[9] = pixel[1]; v[10] = 1;
          device.queue.writeBuffer(current.pickUniforms, 0, v);
          draw(encoder, current.picking!, current.pickGroup!, pickTexture.createView());
          encoder.copyTextureToBuffer({ texture: pickTexture }, { buffer: readback, bytesPerRow: 256 }, [1, 1]);
          picking = true; pickPending = true;
        } else hovered = 0;
      }
      if (drawing) {
        current.pipelines.forEach((p, i) => draw(encoder, p.pipeline, current.groups[i], i === current.pipelines.length - 1 ? context!.getCurrentTexture().createView() : current.images[i].createView(), i === current.pipelines.length - 1));
        probe?.resolveTimestamps?.(encoder);
      }
      device.queue.submit([encoder.finish()]);
      if (drawing) {
        probe?.timestampsSubmitted?.();
        probe?.drawEnd();
      }
      if (picking) {
        const generation = pickGeneration;
        void readback.mapAsync(GPUMapMode.READ).then(() => {
          if (!destroyed && generation === pickGeneration && pointer) { hovered = decodeId(new Uint8Array(readback.getMappedRange(), 0, 4)); press.picked(hovered); }
          readback.unmap();
        }).catch(error => { if (!destroyed) console.error("GSS WebGPU picking:", error); }).finally(() => { pickPending = false; });
      }
    }
    frameId = requestAnimationFrame(frame);
  }
  device.lost.then(info => {
    if (destroyed) return;
    playing = false; cancelAnimationFrame(frameId);
    canvas.dispatchEvent(new CustomEvent("gss-error", { detail: new Error(`WebGPU device lost: ${info.message}`) }));
  });
  frameId = requestAnimationFrame(frame);
  // Back on a hidden page: the time it was away is not a slow frame
  const onVisible = () => {
    if (!document.hidden) density?.resume(performance.now());
  };
  document.addEventListener("visibilitychange", onVisible);
  return {
    backend: "webgpu",
    async show(compiled) {
      if (destroyed) throw new Error("This GSS view has been destroyed");
      const previous = root;
      root = compiled;
      try { await display(pickVariant(compiled, media.matches), true); }
      catch (error) { if (root === compiled) root = previous; throw error; }
      if (destroyed || root !== compiled) return;
      stopMedia();
      stopMedia = compiled.media ? media.watch(compiled.media.queries, () => {
        const variant = pickVariant(compiled, media.matches);
        if (variant === scene?.compiled) return;
        void display(variant, false).catch(error => canvas.dispatchEvent(new CustomEvent("gss-error", { detail: error })));
      }) : () => {};
    },
    sampleFrames() { const now = performance.now(); const result = { frames, ms: now - sampleStart }; frames = 0; sampleStart = now; return result; },
    pause() { playing = false; cancelAnimationFrame(frameId); },
    play() {
      if (playing || destroyed) return;
      playing = true;
      if (halted) density?.insist(); // drawn anyway: never stopped again
      halted = false;
      density?.resume(performance.now());
      clock.resume(performance.now());
      frameId = requestAnimationFrame(frame);
    },
    freeze(frozen) { clock.freeze(frozen); reducedMotion = frozen; },
    setProperty: properties.set,
    getPropertyValue: properties.get,
    removeProperty: properties.remove,
    destroy() {
      if (destroyed) return;
      destroyed = true; revision++; pickGeneration++; playing = false;
      cancelAnimationFrame(frameId); stopMedia(); media.destroy(); listeners.forEach(stop => stop());
      document.removeEventListener("visibilitychange", onVisible);
      probe?.destroy?.(); slider?.destroy(); dprMenu?.destroy();
      if (scene) release(scene); scene = null;
      for (const entry of textures.values()) { entry.image.onload = null; entry.image.onerror = null; entry.texture.destroy(); }
      textures.clear(); fallback.destroy(); pickTexture.destroy(); readback.destroy(); context.unconfigure(); device.destroy();
    },
  };
}
