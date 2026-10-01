// Times the GPU work of a frame, without ever waiting for it: a result comes back
// a few frames later. Needs EXT_disjoint_timer_query_webgl2 (Chrome desktop mostly).
export type GpuTimer = {
  available: boolean; // false: show "GPU time unavailable", never 0 ms
  begin(): void; // before the draw
  end(): void; // after the draw
  collect(): number[]; // the frames measured since the last call, in ms (often empty)
  destroy(): void;
};

const MAX_PENDING = 8;

export function createGpuTimer(gl: WebGL2RenderingContext): GpuTimer {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let active: WebGLQuery | null = null; // the query between begin() and end()
  const pending: WebGLQuery[] = []; // ended, waiting for the GPU, oldest first

  return {
    available: ext !== null,

    begin() {
      if (!ext || active || pending.length >= MAX_PENDING) return; // skip this frame
      active = gl.createQuery()!;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    },

    end() {
      if (!ext || !active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },

    collect() {
      if (!ext) return [];
      // The GPU was interrupted: every pending time is wrong
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        pending.forEach((query) => gl.deleteQuery(query));
        pending.length = 0;
        return [];
      }
      const ms: number[] = [];
      // Oldest first: stop at the first one the GPU has not finished
      while (
        pending.length > 0 &&
        gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)
      ) {
        const query = pending.shift()!;
        const ns = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
        ms.push(ns / 1_000_000);
        gl.deleteQuery(query);
      }
      return ms;
    },

    destroy() {
      [...pending, active].forEach((query) => query && gl.deleteQuery(query));
      pending.length = 0;
      active = null;
    },
  };
}
