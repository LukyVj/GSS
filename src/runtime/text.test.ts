import { describe, it, expect } from "vitest";
import { SIZE, textOf } from "./text";
import { elementId, needsWebGL, paintName, resolveImage } from "./textures";
import { digitsSource, LETTER_PIXELS, pieceSource, textSource } from "../compiler/features/content";
import { gssModule } from "../vite/plugin";

describe("the text of an object, among the images of the scene", () => {
  const hello = textSource("hello", "italic 700 Georgia, serif");

  it("is read back by the runtime: the text and its font", () => {
    expect(textOf(hello)).toEqual({ text: "hello", font: "italic 700 Georgia, serif", width: null, align: "left" });
    expect(textOf(textSource("hi", "normal 400 serif", 4, "center"))).toEqual({ text: "hi", font: "normal 400 serif", width: 4, align: "center" });
  });

  it("reads the pieces of a text with a number: its strings and the digits of its font", () => {
    expect(textOf(pieceSource("item: ", "normal 400 serif"))).toEqual({ text: "item: ", font: "normal 400 serif", width: null, align: "left", kind: "piece" });
    expect(textOf(digitsSource("normal 400 serif"))).toEqual({ text: "0123456789-.", font: "normal 400 serif", width: null, align: "left", kind: "digits" });
    expect(textOf('content(["a","normal 400 serif",null,"left","other"])')).toBeNull();
  });

  it("draws the letters at the size the compiler counts lines of font-size in", () => {
    expect(SIZE).toBe(LETTER_PIXELS);
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
