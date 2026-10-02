import { createView, type View, type ViewOptions } from "./view";
import { createWebGPUView, requestWebGPU } from "./webgpu";
export type AsyncView = Omit<View, "show"> & {
  readonly backend: "webgl" | "webgpu";
  show(scene: Parameters<View["show"]>[0]): Promise<void>;
};
export type Backend = "auto" | "webgl" | "webgpu";
export type BackendOptions = ViewOptions & {
  backend?: Backend;
  profileWebGPU?: (device: GPUDevice) => import("../profiler/profiler").FrameProbe;
};

// Existing synchronous APIs retain WebGL2. New asynchronous APIs select WebGPU
// first and fall back only if adapter/device acquisition fails, before getContext.
export async function createViewAsync(canvas: HTMLCanvasElement, options: BackendOptions = {}): Promise<AsyncView> {
  const backend = options.backend ?? "auto";
  if (backend !== "webgl") {
    let device: GPUDevice | undefined;
    try { device = await requestWebGPU(!!options.profileWebGPU); }
    catch (error) { if (backend === "webgpu") throw error; }
    if (device) {
      try { return createWebGPUView(canvas, device, options); }
      catch (error) { device.destroy(); throw error; }
    }
  }
  const view = createView(canvas, options);
  return { ...view, backend: "webgl", async show(scene) { view.show(scene); } };
}
