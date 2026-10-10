import { escapeHtml } from "./escape";
import { TILE, cells, isolines, lines, onCube, path, round, says, tile } from "./figure-kit";
import { REST_VIEW, ball, slices, type Frame } from "./hairline";

// What covers a surface: an image, a text, a pattern, a mask, a material. A figure shows the
// image flat, then on the faces of an object.

const CELL: Frame = { width: 132, height: 132, scale: 62, x: 66, y: 68 };
const flow = (items: [label: string, art: string][]) => cells("figure-flow", items, CELL);
const steps = (items: [label: string, art: string][], columns = items.length) => cells("figure-steps", items, CELL, columns);

// --- the images, each in a square of TILE

const photo = path("edge", "M3 57L24 30L36 45L47 34L69 57") + `<circle class="edge" cx="52" cy="17" r="6"/>`;
const word = (letters: string, more = "") => `<text class="letters"${more} x="${TILE / 2}" y="${TILE / 2 + 2}">${escapeHtml(letters)}</text>`;
const bands = path("edge", [1, 3, 5, 7].map((i) => `M0 ${i * 9}H${TILE}`).join(""));
const checks = path(
  "edge",
  Array.from({ length: 16 }, (_, n) => [n % 4, Math.floor(n / 4)])
    .filter(([i, j]) => (i + j) % 2 === 0)
    .map(([i, j]) => `M${i * 18} ${j * 18 + 18}L${i * 18 + 18} ${j * 18}M${i * 18} ${j * 18 + 9}L${i * 18 + 9} ${j * 18}M${i * 18 + 9} ${j * 18 + 18}L${i * 18 + 18} ${j * 18 + 9}`)
    .join(""),
);
// A smooth noise, drawn by the lines where it crosses three levels
const wobble = (x: number, y: number) => Math.sin(x * 0.11 + 1) * Math.cos(y * 0.09) + 0.5 * Math.sin((x + y) * 0.07 + 2);
const clouds = path("edge", [-0.5, 0, 0.5].map((level) => isolines(wobble, level, [0, 0, TILE, TILE])).join(""));
// The bands, moved by the noise
const waves = path(
  "edge",
  [1, 3, 5, 7]
    .map((i) => `M${Array.from({ length: 25 }, (_, k) => `${k * 3} ${round(i * 9 + 5 * wobble(k * 3 * 1.6, i * 30))}`).join("L")}`)
    .join(""),
);
const card =
  `<rect class="edge" x="6" y="10" width="60" height="52" rx="5"/>` + path("edge", "M6 24H66M14 34H46M14 42H38") + `<rect class="tint" x="40" y="48" width="20" height="8" rx="2"/>`;

// --- texture, and what an image looks like on an object

export const texture = () => flow([['url("photo.jpg")', tile(photo)], ["texture", onCube(CELL, photo)]]) + says('texture: url("photo.jpg");');

export function textureSize(): string {
  const quarter = [0, 1, 2, 3].map((n) => `<g transform="translate(${(n % 2) * 36} ${Math.floor(n / 2) * 36}) scale(0.5)">${photo}</g>`).join("");
  return steps([["texture-size: auto;", onCube(CELL, photo)], ["texture-size: 0.5;", onCube(CELL, quarter)]]);
}

// A curve of the image, seen very close: smooth, or with the squares of its pixels
export function imageRendering(): string {
  const curve = (x: number) => 62 - Math.sqrt(Math.max(0, 54 * 54 - (x - 62) * (x - 62)));
  const smooth = `M${Array.from({ length: 19 }, (_, k) => `${8 + k * 3} ${round(curve(8 + k * 3))}`).join("L")}`;
  let stairs = `M8 ${Math.round(curve(8) / 9) * 9}`;
  for (let x = 8; x < 62; x += 9) stairs += `H${x + 9}V${Math.round(curve(x + 9) / 9) * 9}`;
  return steps([
    ["image-rendering: smooth;", tile(path("tint", smooth))],
    ["image-rendering: pixelated;", tile(path("tint", stairs))],
  ]);
}

export const face = () => flow([['url("grass.png")', tile(photo)], ["cube::top", onCube(CELL, photo, ["top"])]]) + says('cube::top { texture: url("grass.png"); }');

export const element = () => {
  const plate: Frame = { ...CELL, scale: 78 };
  return flow([['<div id="card">', tile(card)], ["element(#card)", onCube(plate, card, ["front"])]]) + says("texture: element(#card);");
};

// --- content, and the font of its text

export const content = () => flow([['"GSS"', tile(word("GSS"))], ["content", onCube(CELL, word("GSS"))]]) + says('content: "GSS";');

const letters = (style: string) => `<text class="letters large" style="${style}" x="66" y="70">Aa</text>`;

export const fontFamily = () =>
  steps([
    ["font-family: sans-serif;", letters("font-family: sans-serif")],
    ["font-family: serif;", letters("font-family: serif")],
    ["font-family: monospace;", letters("font-family: monospace")],
  ]);

export const fontWeight = () =>
  steps([
    ["font-weight: 300;", letters("font-family: system-ui, sans-serif; font-weight: 300")],
    ["font-weight: normal;", letters("font-family: system-ui, sans-serif; font-weight: 400")],
    ["font-weight: bold;", letters("font-family: system-ui, sans-serif; font-weight: 700")],
  ]);

export const fontStyle = () =>
  steps([
    ["font-style: normal;", letters("font-family: serif")],
    ["font-style: italic;", letters("font-family: serif; font-style: italic")],
  ]);

export const textFill = () =>
  steps([
    ["black or white", onCube(CELL, word("GSS"))],
    ["-webkit-text-fill-color: #ff5a36;", onCube(CELL, word("GSS", ' style="stroke: var(--gss-signal)"'))],
  ]);

// --- the patterns that go wherever a gradient goes

export function gradients(): string {
  const linear = path("edge", [4, 9, 15, 22, 30, 39, 49, 60].map((y) => `M0 ${y}H${TILE}`).join(""));
  const radial = [6, 13, 21, 30].map((r) => `<circle class="edge" cx="36" cy="36" r="${r}"/>`).join("");
  const conic =
    path("edge", Array.from({ length: 12 }, (_, i) => `M36 36L${round(36 + 34 * Math.sin((i * Math.PI) / 6))} ${round(36 - 34 * Math.cos((i * Math.PI) / 6))}`).join("")) +
    `<g class="turns" style="transform-origin: 36px 36px">${path("tint", "M36 36V2")}</g>`;
  return steps([
    ["linear-gradient()", tile(linear)],
    ["radial-gradient()", tile(radial)],
    ["conic-gradient()", tile(conic)],
  ]);
}

export const noise = () => flow([["noise()", tile(clouds)], ["color", onCube(CELL, clouds)]]) + says("color: noise(3, #1b2a4a, #9fc4ff);");
export const checker = () => flow([["checker()", tile(checks)], ["color", onCube(CELL, checks)]]) + says("color: checker(4, #111, #eee);");
// Across y: bands around the sides, and one color on the top
export const stripes = () => flow([["stripes()", tile(bands)], ["color", onCube(CELL, bands, ["front", "left"])]]) + says("color: stripes(4, #111, #eee);");
export const displace = () =>
  cells(
    "figure-flow sums",
    [
      ["an image", tile(bands)],
      ["a map", tile(clouds)],
      ["displace()", tile(waves)],
    ],
    CELL,
  ) + says("color: displace(stripes(4, #111, #eee), noise(2, black, white), 0.3);");

// --- a mask cuts holes

const kept = path("tint", [0, 2, 4].map((i) => `M0 ${i * 14 + 3}H${TILE}M0 ${i * 14 + 11}H${TILE}`).join(""));
export const maskImage = () =>
  flow([["mask-image", tile(kept)], ["the object", lines(slices(REST_VIEW, 3), CELL)]]) + says("mask-image: repeating-linear-gradient(black 0 20%, transparent 20% 40%);");

export function maskMode(): string {
  const shape = `<circle class="tint" cx="36" cy="36" r="24"/>`;
  // alpha: what is drawn counts. luminance: what is light counts, here the right half.
  const alpha = shape + path("ghost", "M0 0H72V72H0Z");
  const luminance = path("tint", "M36 12A24 24 0 0 1 36 60Z") + path("ghost", "M36 12A24 24 0 0 0 36 60");
  return steps([
    ["mask-mode: alpha;", tile(alpha)],
    ["mask-mode: luminance;", tile(luminance)],
  ]);
}

// --- material: how a surface answers the light

export function material(): string {
  const frame: Frame = { ...CELL, scale: 64 };
  const sphere = lines(ball(REST_VIEW, 0.6), frame);
  const [cx, cy, r] = [frame.x, frame.y, 0.6 * frame.scale];
  const arc = (inset: number, from: number, to: number) => {
    const at = (angle: number) => `${round(cx + (r - inset) * Math.cos((angle * Math.PI) / 180))} ${round(cy + (r - inset) * Math.sin((angle * Math.PI) / 180))}`;
    return `M${at(from)}A${r - inset} ${r - inset} 0 0 1 ${at(to)}`;
  };
  const glint = path("glint", arc(6, 200, 250));
  const rays = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5;
    return `M${round(cx + (r + 5) * Math.cos(angle))} ${round(cy + (r + 5) * Math.sin(angle))}L${round(cx + (r + 13) * Math.cos(angle))} ${round(cy + (r + 13) * Math.sin(angle))}`;
  }).join("");
  return cells(
    "figure-steps",
    [
      ["matte()", sphere],
      // a metal mirrors the horizon and the floor
      ["metal()", sphere + path("edge", arc(0, 160, 20).replace("0 0 1", "0 0 0").replace(/A[\d.]+ [\d.]+/, `A${r} ${round(r * 0.35)}`)) + glint],
      ["glass()", `<g class="tinted">${sphere}${glint}</g>` + path("ground", `M${cx - r - 8} ${cy + 10}H${cx + r + 8}M${cx - r - 8} ${cy - 12}H${cx + r + 8}`)],
      ["jelly()", sphere + `<circle class="tint wobbles" cx="${cx}" cy="${cy + 4}" r="${round(r * 0.55)}"/>`],
      ["emissive()", `<g class="tinted">${sphere}</g>` + `<g class="glows">${path("tint", rays)}</g>`],
      ["iridescent()", sphere + `<circle class="sheen one" cx="${cx - 2}" cy="${cy - 2}" r="${r - 4}"/><circle class="sheen two" cx="${cx + 2}" cy="${cy + 2}" r="${r - 8}"/>`],
    ],
    frame,
    3,
  );
}

// Each page of this family, and its figure
const TILES: Record<string, () => string> = {
  texture,
  "texture-size": textureSize,
  "image-rendering": imageRendering,
  "selector-face": face,
  "fn-element": element,
  content,
  "font-family": fontFamily,
  "font-weight": fontWeight,
  "font-style": fontStyle,
  "-webkit-text-fill-color": textFill,
  "fn-gradients": gradients,
  "fn-noise": noise,
  "fn-checker": checker,
  "fn-stripes": stripes,
  "fn-displace": displace,
  "mask-image": maskImage,
  "mask-mode": maskMode,
  material,
};
export const tiles = (subject: string) => TILES[subject]();
export const TILE_PAGES = Object.keys(TILES);
