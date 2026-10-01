// Frame times, summed up like a benchmark: median, p95, p99 (never an average of fps)
export type Summary = {
  count: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
};

export function summarize(samples: number[]): Summary | null {
  const sorted = samples
    .filter((x) => Number.isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  // The sample under which a share p (0 … 1) of the samples are
  const percentile = (p: number) =>
    sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  const meanMs = sorted.reduce((sum, x) => sum + x, 0) / sorted.length;

  return {
    count: sorted.length,
    meanMs,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
  };
}

// The last `capacity` samples: the oldest falls out when a new one comes in
export function createSamples(capacity: number) {
  const values: number[] = [];
  return {
    push(x: number) {
      values.push(x);
      if (values.length > capacity) values.shift();
    },
    values: () => [...values],
    clear() {
      values.length = 0;
    },
  };
}
