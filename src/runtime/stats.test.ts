import { describe, it, expect } from "vitest";
import { createStats } from "./stats";

// scene.stats() (decision 229): the frame rate of the last second, and the ratio drawn
describe("createStats", () => {
  it("says 0 frames per second until a second has gone by", () => {
    const stats = createStats();
    stats.frame(0, 1);
    stats.frame(500, 1);
    expect(stats.read()).toEqual({ fps: 0, ratio: 1 });
  });

  it("measures the frames of each second, and gives the last ratio drawn", () => {
    const stats = createStats();
    for (let t = 0; t <= 1020; t += 1000 / 30) stats.frame(t, 1.5);
    expect(Math.abs(stats.read().fps - 30)).toBeLessThan(2);
    for (let t = 1000; t <= 2100; t += 1000 / 60) stats.frame(t, 2);
    expect(Math.abs(stats.read().fps - 60)).toBeLessThan(2);
    expect(stats.read().ratio).toBe(2);
  });

  it("starts a new measure after a pause, so a stopped scene does not count as slow", () => {
    const stats = createStats();
    for (let t = 0; t <= 1000; t += 1000 / 60) stats.frame(t, 1);
    stats.resume();
    stats.frame(9000, 1);
    for (let t = 9000; t <= 10100; t += 1000 / 60) stats.frame(t, 1);
    expect(Math.abs(stats.read().fps - 60)).toBeLessThan(2);
  });
});
