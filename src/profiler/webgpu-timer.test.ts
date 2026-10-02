import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createWebGPUTimer } from "./webgpu-timer";
import { requestWebGPU } from "../runtime/webgpu";
beforeEach(() => {
  vi.stubGlobal("GPUBufferUsage", { QUERY_RESOLVE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8 });
  vi.stubGlobal("GPUMapMode", { READ: 1 });
});
afterEach(() => vi.unstubAllGlobals());
function fakeDevice(available = true) {
  const pending: (() => void)[] = [];
  const buffers: any[] = [];
  const device = {
    features: new Set(available ? ["timestamp-query"] : []),
    createQuerySet: vi.fn(() => ({ destroy: vi.fn() })),
    createBuffer: vi.fn(() => {
      const buffer = { destroy: vi.fn(), unmap: vi.fn(), getMappedRange: () => new BigUint64Array([9_000_000_000_000_000n, 9_000_000_003_500_000n]).buffer,
        mapAsync: vi.fn(() => new Promise<void>(resolve => pending.push(resolve))) };
      buffers.push(buffer); return buffer;
    }),
  };
  return { device: device as unknown as GPUDevice & typeof device, pending, buffers };
}
const encoder = () => ({ resolveQuerySet: vi.fn(), copyBufferToBuffer: vi.fn() });
async function complete(pending: (() => void)[]) { pending.splice(0).forEach(resolve => resolve()); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
it("allocates no queries without timestamp support", () => {
  const { device } = fakeDevice(false); const timer = createWebGPUTimer(device);
  timer.begin(); timer.resolve(encoder() as unknown as GPUCommandEncoder); timer.submitted();
  expect(timer.available).toBe(false); expect(timer.collect()).toEqual([]); expect(device.createBuffer).not.toHaveBeenCalled();
});
it("times from the first pass to the final pass and converts nanoseconds after asynchronous readback", async () => {
  const { device, pending } = fakeDevice(); const timer = createWebGPUTimer(device);
  expect(device.createBuffer).not.toHaveBeenCalled(); timer.begin();
  expect(timer.timestampWrites(true, false)).toMatchObject({ beginningOfPassWriteIndex: 0 });
  expect(timer.timestampWrites(false, false)).toBeUndefined();
  expect(timer.timestampWrites(false, true)).toMatchObject({ endOfPassWriteIndex: 1 });
  const e = encoder(); timer.resolve(e as unknown as GPUCommandEncoder); expect(e.resolveQuerySet).toHaveBeenCalled();
  timer.submitted(); expect(timer.collect()).toEqual([]);
  await complete(pending); expect(timer.collect()).toEqual([3.5]); expect(timer.collect()).toEqual([]); timer.destroy();
});
it("bounds pending reads and skips frames rather than waiting for the GPU", async () => {
  const { device, pending } = fakeDevice(); const timer = createWebGPUTimer(device);
  for (let i = 0; i < 20; i++) { timer.begin(); timer.submitted(); }
  expect(pending.length).toBe(8); expect(device.createQuerySet).toHaveBeenCalledTimes(8);
  await complete(pending); timer.begin(); expect(timer.timestampWrites(true, true)).toBeDefined();
  expect(device.createQuerySet).toHaveBeenCalledTimes(8); timer.destroy();
});
it("discards measurements from before a shader reset or destruction", async () => {
  const { device, pending, buffers } = fakeDevice(); const timer = createWebGPUTimer(device);
  timer.begin(); timer.submitted(); timer.reset!(); await complete(pending); expect(timer.collect()).toEqual([]);
  timer.begin(); timer.submitted(); timer.destroy(); timer.destroy(); await complete(pending); expect(timer.collect()).toEqual([]);
  buffers.forEach(buffer => expect(buffer.destroy).toHaveBeenCalledTimes(1));
});
it("requests timestamps for profiling without making them mandatory for rendering", async () => {
  const device = {} as GPUDevice;
  const requestDevice = vi.fn().mockRejectedValueOnce(new Error("timestamp feature denied")).mockResolvedValueOnce(device);
  vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => ({ features: new Set(["timestamp-query"]), requestDevice }) } });
  expect(await requestWebGPU(true)).toBe(device);
  expect(requestDevice).toHaveBeenNthCalledWith(1, { requiredFeatures: ["timestamp-query"] });
  expect(requestDevice).toHaveBeenNthCalledWith(2);
});
