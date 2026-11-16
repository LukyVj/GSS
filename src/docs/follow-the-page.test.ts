import { describe, it, expect } from "vitest";
import { compileScene } from "../compiler";
import { FOLLOW_SCENE, INSTALLATION } from "./guide";

describe('"Follow the page as it scrolls"', () => {
  it("shows a scene that compiles on the timeline its section names", () => {
    expect(compileScene(FOLLOW_SCENE.join("\n")).timelines).toEqual([{ type: "named", name: "--feature" }]);
  });

  it("names that section in its demo, and the page links to animation-timeline", () => {
    const entry = INSTALLATION.find((e) => e.anchor === "follow-the-page")!;
    const html = entry.paragraphs.join("");
    expect(html).toContain('style="view-timeline-name: --feature"');
    expect(html).toContain('href="#animation-timeline"');
  });
});
