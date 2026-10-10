import { describe, it, expect } from "vitest";
import { textOf } from "./text";
import { elementId, needsWebGL, paintName, resolveImage } from "./textures";
import { textSource } from "../compiler/features/content";
import { gssModule } from "../vite/plugin";

describe("the text of an object, among the images of the scene", () => {
  const hello = textSource("hello", "italic 700 Georgia, serif");

  it("is read back by the runtime: the text and its font", () => {
    expect(textOf(hello)).toEqual({ text: "hello", font: "italic 700 Georgia, serif" });
  });

  it("keeps quotes, parentheses and line breaks of the text", () => {
    const text = 'say "hi") (ok\\';
    expect(textOf(textSource(text, "normal 400 sans-serif"))?.text).toBe(text);
  });

  it("is not an image, an element or a @paint", () => {
    expect(textOf("dirt.png")).toBeNull();
    expect(textOf("element(#card)")).toBeNull();
    expect(textOf("paint(rings)")).toBeNull();
    expect(textOf("content(oops)")).toBeNull();
    expect(elementId(hello)).toBeNull();
    expect(paintName(hello)).toBeNull();
  });

  it("is no file: its name stays as it is, whatever the base", () => {
    expect(resolveImage(hello, "https://example.com/scenes/a.gss")).toBe(hello);
    expect(resolveImage("dirt.png", "https://example.com/scenes/a.gss")).toBe("https://example.com/scenes/dirt.png");
  });

  it("is drawn by WebGPU too", () => {
    expect(needsWebGL({ textures: [hello] })).toBe(false);
  });

  it("is not an asset for the Vite plugin", () => {
    const module = gssModule('@scene { cube; } cube { content: "hello"; texture: url("dirt.png"); }');
    expect(module).toContain(`scene.textures = [new URL("./dirt.png", import.meta.url).href, ${JSON.stringify(textSource("hello", "normal 400 sans-serif"))}];`);
  });
});
