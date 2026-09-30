import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./track";

describe("track", () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("sends the event and its data to Umami", () => {
    const send = vi.fn();
    (globalThis as any).window = { umami: { track: send } };
    track("playground-example", { example: "logo" });
    expect(send).toHaveBeenCalledWith("playground-example", {
      example: "logo",
    });
  });

  it("does nothing when Umami is blocked", () => {
    (globalThis as any).window = {};
    expect(() => track("playground-share")).not.toThrow();
  });

  it("does nothing outside a browser", () => {
    expect(() => track("playground-share")).not.toThrow();
  });
});
