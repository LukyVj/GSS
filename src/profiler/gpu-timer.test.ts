import { describe, it, expect } from "vitest";
import { createGpuTimer } from "./gpu-timer";

// A fake WebGL2: queries are plain objects, and the test decides when the GPU is done
function fakeGl({ withExtension = true } = {}) {
  const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
  const created: object[] = [];
  const results = new Map<object, number>(); // query → nanoseconds, once the GPU is done
  const calls = { begin: 0, deleted: 0, finish: 0 };
  let disjoint = false;
  const gl = {
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    getExtension: (name: string) =>
      withExtension && name === "EXT_disjoint_timer_query_webgl2" ? ext : null,
    createQuery: () => {
      const query = { n: created.length };
      created.push(query);
      return query;
    },
    // Like WebGL: the second argument must be a query made by createQuery()
    beginQuery: (_target: number, query: object) => {
      if (!created.includes(query)) throw new TypeError("beginQuery: not a WebGLQuery");
      calls.begin++;
    },
    endQuery: () => {},
    deleteQuery: () => void calls.deleted++,
    getParameter: (p: number) => (p === ext.GPU_DISJOINT_EXT ? disjoint : null),
    // Like WebGL: QUERY_RESULT is only read once QUERY_RESULT_AVAILABLE said true
    getQueryParameter: (query: object, p: number) => {
      if (p === gl.QUERY_RESULT_AVAILABLE) return results.has(query);
      if (p === gl.QUERY_RESULT && results.has(query)) return results.get(query);
      throw new Error("QUERY_RESULT read before QUERY_RESULT_AVAILABLE");
    },
    finish: () => void calls.finish++,
  };
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    calls,
    created,
    gpuDone: (n: number, ns: number) => results.set(created[n], ns),
    setDisjoint: (value: boolean) => (disjoint = value),
  };
}

const measure = (timer: ReturnType<typeof createGpuTimer>) => {
  timer.begin();
  timer.end();
};

describe("createGpuTimer", () => {
  it("says so when the extension is missing, and never throws", () => {
    const { gl } = fakeGl({ withExtension: false });
    const timer = createGpuTimer(gl);
    expect(timer.available).toBe(false);
    measure(timer);
    expect(timer.collect()).toEqual([]);
  });

  it("gives the GPU time of a frame in milliseconds, once the GPU is done", () => {
    const fake = fakeGl();
    const timer = createGpuTimer(fake.gl);
    measure(timer);
    expect(timer.collect()).toEqual([]); // not ready: we do not wait
    fake.gpuDone(0, 4_000_000);
    expect(timer.collect()).toEqual([4]);
    expect(fake.calls.deleted).toBe(1); // a read query is freed
  });

  it("never blocks the GPU with finish()", () => {
    const fake = fakeGl();
    const timer = createGpuTimer(fake.gl);
    measure(timer);
    timer.collect();
    expect(fake.calls.finish).toBe(0);
  });

  it("reads the results in order and stops at the first one not ready", () => {
    const fake = fakeGl();
    const timer = createGpuTimer(fake.gl);
    measure(timer);
    measure(timer);
    fake.gpuDone(1, 2_000_000); // the second is done, not the first
    expect(timer.collect()).toEqual([]);
    fake.gpuDone(0, 3_000_000);
    expect(timer.collect()).toEqual([3, 2]);
  });

  it("keeps a GPU time of 0 ms instead of waiting for it forever", () => {
    const fake = fakeGl();
    const timer = createGpuTimer(fake.gl);
    measure(timer);
    measure(timer);
    fake.gpuDone(0, 0);
    fake.gpuDone(1, 1_000_000);
    expect(timer.collect()).toEqual([0, 1]);
  });

  it("never measures two frames at once", () => {
    const fake = fakeGl();
    const timer = createGpuTimer(fake.gl);
    timer.begin();
    timer.begin();
    expect(fake.calls.begin).toBe(1);
  });

  it("skips a frame when 8 measures are already waiting", () => {
    const fake = fakeGl();
    const timer = createGpuTimer(fake.gl);
    for (let i = 0; i < 9; i++) measure(timer);
    expect(fake.created.length).toBe(8);
  });

  it("throws everything away when the GPU says disjoint", () => {
    const fake = fakeGl();
    const timer = createGpuTimer(fake.gl);
    measure(timer);
    measure(timer);
    fake.gpuDone(0, 4_000_000);
    fake.setDisjoint(true);
    expect(timer.collect()).toEqual([]);
    expect(fake.calls.deleted).toBe(2);
    fake.setDisjoint(false);
    measure(timer); // it measures again afterwards
    expect(fake.created.length).toBe(3);
  });
});
