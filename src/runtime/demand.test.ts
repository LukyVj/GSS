import { describe, it, expect } from "vitest";
import { createDemand, movesWithTime } from "./demand";

// Render on demand (decision 134): a frame is drawn only when what it shows can have changed

describe("createDemand", () => {
  it("draws the first frame, then rests while the state stays the same", () => {
    const demand = createDemand();
    expect(demand.need([800, 600, 0.5])).toBe(true);
    expect(demand.need([800, 600, 0.5])).toBe(false);
    expect(demand.need(new Float32Array([800, 600, 0.5]))).toBe(false);
  });

  it("draws again when one value changes, or when the state grows", () => {
    const demand = createDemand();
    demand.need([800, 600, 0.5]);
    expect(demand.need([800, 600, 0.6])).toBe(true);
    expect(demand.need([800, 600, 0.6, 1])).toBe(true);
    expect(demand.need([800, 600, 0.6, 1])).toBe(false);
  });

  it("draws again after forget(): a new scene", () => {
    const demand = createDemand();
    demand.need([1]);
    demand.forget();
    expect(demand.need([1])).toBe(true);
  });

  it("never rests on a value that is not a number", () => {
    const demand = createDemand();
    demand.need([NaN]);
    expect(demand.need([NaN])).toBe(true);
  });
});

describe("movesWithTime", () => {
  const still = "uniform float iTime;\nvoid main() { outColor = vec4(1.0); }";
  const moving = "uniform float iTime;\nvoid main() { outColor = vec4(sin(iTime)); }";

  it("is false when the shader only declares iTime", () => {
    expect(movesWithTime({ shader: still })).toBe(false);
  });

  it("is true when the shader reads iTime", () => {
    expect(movesWithTime({ shader: moving })).toBe(true);
  });

  it("is true when a pass of the filters reads it", () => {
    expect(movesWithTime({ shader: still, passes: [{ shader: still }, { shader: moving }] })).toBe(true);
  });
});
