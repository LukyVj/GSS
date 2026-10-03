import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const MARBLE = "displace(repeating-linear-gradient(#f4f1ea 0% 4%, #8a8478 5% 6%), noise(turbulence 2 4, black, white), 0.3)";
const object = (rule: string, more = "") => compileGSS(`@scene { cube; } cube { translate: 0 0.6 0; ${rule} } ${more}`);
// The body of gradientColor(): the image of the painted object
const paintOf = (shader: string) => shader.slice(shader.indexOf("vec3 gradientColor("));

describe("displace(): the map moves the point where the image is read, like feDisplacementMap", () => {
  it("reads the map first, then moves the point of a gradient by its red and green, y down like SVG", () => {
    const paint = paintOf(object(`color: ${MARBLE};`));
    const map = paint.indexOf("float t = turbulenceNoise(");
    const move = paint.indexOf("at += 0.3 * size * vec2(move.r - 0.5, 0.5 - move.g);");
    const image = paint.indexOf("vec2 dir = ");
    expect(map).toBeGreaterThan(-1);
    expect(move).toBeGreaterThan(map);
    expect(image).toBeGreaterThan(move);
    // Each read of the map is a block of its own: its t and col are not those of the image
    expect(paint.slice(0, map)).toMatch(/\{  \/\/ displace\(\)[^\n]*\n\s*vec3 move = vec3\(0\.5\);\n\s*\{\n\s*$/);
  });

  it("gives each channel of a noise() map a noise of its own, like feTurbulence", () => {
    const paint = paintOf(object(`color: ${MARBLE};`));
    expect(paint).toContain("move.r = col.r;");
    expect(paint).toContain("move.g = col.g;");
    // Red reads the noise of the map, green another seed of it
    expect(paint).toContain("turbulenceNoise((q + vec3(0.0)) * 2.0, 4);");
    expect(paint).toContain("turbulenceNoise((q + vec3(0.0)) * 2.0 + vec3(37.1, 17.3, 51.9), 4);");
    // A gradient map is read once: its colors are its channels
    expect(paintOf(object("color: displace(linear-gradient(red, blue), linear-gradient(to right, black, white), 0.3);"))).toContain(
      "move = col;",
    );
  });

  it("takes the amount as a number or a percentage of the image's size", () => {
    expect(paintOf(object(`color: ${MARBLE.replace("0.3)", "30%)")};`))).toContain("at += 0.3 * size * vec2(");
  });

  it("moves a noise() in 3D, by red, green and blue", () => {
    const paint = paintOf(object("color: displace(noise(3, black, white), noise(2, black, white), 0.5);"));
    expect(paint).toContain("q += 0.5 * max(size.x, size.y) * (move - 0.5);");
    expect(paint).toContain("move.b = col.b;");
  });

  it("works in the background, its layers and mask-image", () => {
    const flat = (background: string) => compileGSS(`@scene { } scene { floor: none; background: ${background}; }`);
    expect(flat("displace(linear-gradient(#102040, #3a7bff), noise(2, black, white), 0.2)")).toContain(
      "at += 0.2 * size * vec2(move.r - 0.5, 0.5 - move.g);",
    );
    expect(flat("displace(noise(3, #102040, #3a7bff), noise(2, black, white), 0.3)")).toContain("rd += 0.2 * (move - 0.5);");
    expect(flat("displace(noise(3, #ffffff00, #ffffff), noise(2, black, white), 0.2), #3a7bff")).toContain("vec4 backgroundLayer0(");
    const mask = object("mask-image: displace(radial-gradient(circle, transparent 30%, black 31%), noise(5, black, white), 0.2);");
    expect(mask.slice(mask.indexOf("float maskAlpha("))).toContain("at += 0.2 * size * vec2(move.r - 0.5, 0.5 - move.g);");
  });

  it("is lowered to WGSL", () => {
    expect(() => compileGSS(`@scene { cube; } cube { color: ${MARBLE}; }`, "wgsl")).not.toThrow();
  });
});

describe("displace(): moving", () => {
  it("moves its amount and its map like the numbers of a gradient", () => {
    const amount = paintOf(object(`color: ${MARBLE}; animation: a 4s;`, `@keyframes a { to { color: ${MARBLE.replace("0.3)", "0.6)")}; } }`));
    expect(amount).toMatch(/at \+= \(mix\(0\.3, 0\.6, [^\n]*iTime \/ 4\.0/);
    const map = paintOf(
      object(`color: ${MARBLE}; animation: a 4s;`, `@keyframes a { to { color: ${MARBLE.replace("4, black", "4 at 1 0 0, black")}; } }`),
    );
    expect(map).toContain("turbulenceNoise((q + vec3(mix(0.0, 1.0, ");
  });

  it("changes into another displace() with the same kinds of image and map", () => {
    expect(() =>
      object(`color: ${MARBLE}; animation: a 4s;`, "@keyframes a { to { color: repeating-linear-gradient(#f4f1ea 0% 4%, #8a8478 5% 6%); } }"),
    ).toThrow("a displace() can only change into another displace()");
    expect(() =>
      object(`color: ${MARBLE}; animation: a 4s;`, `@keyframes a { to { color: ${MARBLE.replace("noise(turbulence 2 4, black, white)", "linear-gradient(black, white)")}; } }`),
    ).toThrow("the map of a displace() can only change into another noise()");
  });

  it("follows a variable set from JS", () => {
    const paint = paintOf(
      compileGSS(
        `@property --wave { syntax: "<number>"; inherits: false; initial-value: 0.3; } @scene { cube; } cube { color: ${MARBLE.replace("0.3)", "var(--wave))")}; }`,
      ),
    );
    expect(paint).toContain("uProperties[0]");
  });
});

describe("displace(): errors", () => {
  it("takes an image, a map and an amount", () => {
    expect(() => object("color: displace(linear-gradient(red, blue), noise(2, black, white));")).toThrow(
      "displace() takes an image, a map and an amount",
    );
  });

  it("moves a gradient or a noise(), by a gradient or a noise()", () => {
    expect(() => object("color: displace(red, noise(2, black, white), 0.3);")).toThrow("displace(): the image is a gradient or a noise()");
    expect(() => object(`color: displace(${MARBLE}, noise(2, black, white), 0.3);`)).toThrow("not another displace()");
    expect(() => object("color: displace(linear-gradient(red, blue), white, 0.3);")).toThrow("displace(): the map is a gradient or a noise()");
  });

  it("takes a number or a percentage as its amount", () => {
    expect(() => object("color: displace(linear-gradient(red, blue), noise(2, black, white), 3deg);")).toThrow(
      "displace(): the amount is a number or a percentage",
    );
  });

  it("reads the map by its colors, which are opaque", () => {
    expect(() =>
      compileGSS("@scene { } scene { background: displace(linear-gradient(red, blue), noise(2, transparent, white), 0.3); }"),
    ).toThrow("displace(): the map takes opaque colors");
  });
});
