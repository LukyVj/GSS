import { describe, expect, it } from "vitest";
import { sleepOffscreen } from "./offscreen";

// A canvas that only fires events, a screen the test moves, a view that logs its calls
function setup() {
  const canvas = new EventTarget() as unknown as HTMLCanvasElement;
  let onScreen: (visible: boolean) => void = () => {};
  let watching = false;
  const watch = (_canvas: HTMLCanvasElement, change: (visible: boolean) => void) => {
    onScreen = change;
    watching = true;
    return () => {
      watching = false;
    };
  };
  const calls: string[] = [];
  const view = { pause: () => calls.push("pause"), play: () => calls.push("play") };
  const sleep = sleepOffscreen(canvas, view, watch);
  return { canvas, sleep, calls, screen: (visible: boolean) => onScreen(visible), watching: () => watching };
}

describe("sleepOffscreen: a scene off screen draws nothing", () => {
  it("pauses when the canvas leaves the screen, and plays when it comes back", () => {
    const { calls, screen } = setup();
    screen(false);
    screen(true);
    expect(calls).toEqual(["pause", "play"]);
  });

  it("keeps a scene the page paused asleep, even back on screen", () => {
    const { calls, screen, sleep } = setup();
    sleep.pause();
    screen(false);
    screen(true);
    expect(calls.at(-1)).toBe("pause");
    sleep.play();
    expect(calls.at(-1)).toBe("play");
  });

  it("does not play a scene the page plays while it is off screen", () => {
    const { calls, screen, sleep } = setup();
    screen(false);
    sleep.play();
    expect(calls.at(-1)).toBe("pause");
  });

  it("keeps a scene too heavy stopped back on screen, until the page plays it", () => {
    const { calls, screen, sleep, canvas } = setup();
    canvas.dispatchEvent(new Event("gss-too-heavy"));
    screen(false);
    screen(true);
    expect(calls.at(-1)).toBe("pause");
    sleep.play();
    expect(calls.at(-1)).toBe("play");
  });

  it("stops watching the screen and the canvas", () => {
    const { calls, screen, sleep, canvas, watching } = setup();
    sleep.stop();
    expect(watching()).toBe(false);
    canvas.dispatchEvent(new Event("gss-too-heavy"));
    sleep.play();
    expect(calls).toEqual(["play"]); // not paused by the event any more
    screen(false);
  });
});
