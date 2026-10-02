import type { GpuTimer } from "./gpu-timer";

// One bounded readback pool, never a CPU wait. Timestamp 0 starts the first
// render pass (including picking); timestamp 1 ends the final post-processing pass.
export type WebGPUTimer = GpuTimer & {
  timestampWrites(first: boolean, last: boolean): GPURenderPassTimestampWrites | undefined;
  resolve(encoder: GPUCommandEncoder): void;
  submitted(): void;
};
type Slot = { queries: GPUQuerySet; resolved: GPUBuffer; readback: GPUBuffer; busy: boolean };
export function createWebGPUTimer(device: GPUDevice): WebGPUTimer {
  const available = device.features.has("timestamp-query");
  const slots: Slot[] = [];
  let active: Slot | null = null;
  let destroyed = false;
  let generation = 0;
  const ready: number[] = [];
  return {
    available,
    begin() {
      if (!available || destroyed || active) return;
      let slot = slots.find(s => !s.busy);
      if (!slot && slots.length < 8) {
        slot = {
          queries: device.createQuerySet({ type: "timestamp", count: 2 }),
          resolved: device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
          readback: device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), busy: false,
        };
        slots.push(slot);
      }
      if (slot) { slot.busy = true; active = slot; }
    },
    timestampWrites(first, last) {
      if (!active || (!first && !last)) return undefined;
      return { querySet: active.queries, ...(first ? { beginningOfPassWriteIndex: 0 } : {}), ...(last ? { endOfPassWriteIndex: 1 } : {}) };
    },
    resolve(encoder) {
      if (!active) return;
      encoder.resolveQuerySet(active.queries, 0, 2, active.resolved, 0);
      encoder.copyBufferToBuffer(active.resolved, 0, active.readback, 0, 16);
    },
    submitted() {
      if (!active) return;
      const slot = active; active = null;
      const ticket = generation;
      void slot.readback.mapAsync(GPUMapMode.READ).then(() => {
        const values = new BigUint64Array(slot.readback.getMappedRange());
        const elapsed = values[1] >= values[0] ? Number(values[1] - values[0]) / 1_000_000 : NaN;
        slot.readback.unmap();
        if (!destroyed && ticket === generation && Number.isFinite(elapsed) && elapsed > 0) ready.push(elapsed);
      }).catch(() => {}).finally(() => { slot.busy = false; });
    },
    end() {}, // timestamps belong to render passes, not the CPU draw boundary
    collect() { return ready.splice(0); },
    reset() { generation++; ready.length = 0; },
    destroy() {
      if (destroyed) return;
      destroyed = true; generation++; active = null; ready.length = 0;
      slots.forEach(s => { s.queries.destroy(); s.resolved.destroy(); s.readback.destroy(); });
    },
  };
}
