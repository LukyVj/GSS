import { escapeHtml } from "./escape";
import { TILE, cells, isolines, lines, onCube, path, round, says, text, tile } from "./figure-kit";
import { REST_VIEW, SHAPES, ball, draw, place, slices, type Frame, type Vec3 } from "./hairline";

// What covers a surface: an image, a text, a pattern, a mask, a material. A figure shows the
// image flat, then on the faces of an object.

const CELL: Frame = { width: 132, height: 132, scale: 62, x: 66, y: 68 };
const flow = (items: [label: string, art: string][]) => cells("figure-flow", items, CELL);
const steps = (items: [label: string, art: string][], columns = items.length) => cells("figure-steps", items, CELL, columns);

// --- the images, each in a square of TILE

const photo = path("edge", "M3 57L24 30L36 45L47 34L69 57") + `<circle class="edge" cx="52" cy="17" r="6"/>`;
const word = (letters: string, more = "") => `<text class="letters"${more} x="${TILE / 2}" y="${TILE / 2 + 2}">${escapeHtml(letters)}</text>`;
// A pattern of two colors is filled with them, the two its figure writes: lines would only
// show where one color ends, and a checkerboard drawn as lines is not one
const [FIRST, SECOND] = ["#111", "#eee"];
const filled = (x: number, y: number, width: number, height: number, color: string) =>
  `<rect class="chip" x="${x}" y="${y}" width="${width}" height="${height}" style="--c: ${color}"/>`;
// stripes(4): four pairs of bands in the height of a cube, the first color at the bottom
const bands = Array.from({ length: 8 }, (_, j) => filled(0, j * 9, TILE, 9, j % 2 ? FIRST : SECOND)).join("");
// checker(4): four cells along each edge of a cube. The grid is cut in the cube, so a cell on
// an edge has the same color on both faces: from one face to the next, the colors swap.
const checks = (swapped = false) =>
  Array.from({ length: 16 }, (_, n) => [n % 4, Math.floor(n / 4)])
    .map(([i, j]) => filled(i * 18, j * 18, 18, 18, (i + j + (swapped ? 1 : 0)) % 2 ? SECOND : FIRST))
    .join("");
// A smooth noise, drawn by the lines where it crosses three levels
const wobble = (x: number, y: number) => Math.sin(x * 0.11 + 1) * Math.cos(y * 0.09) + 0.5 * Math.sin((x + y) * 0.07 + 2);
const clouds = path("edge", [-0.5, 0, 0.5].map((level) => isolines(wobble, level, [0, 0, TILE, TILE])).join(""));
// The bands, moved by the noise: each edge between two bands goes up and down with it
const edge = (j: number) => Array.from({ length: 25 }, (_, k) => `${k * 3} ${round(j * 9 + 5 * wobble(k * 3 * 1.6, j * 30))}`);
const waves =
  filled(0, 0, TILE, TILE, FIRST) +
  [0, 2, 4, 6, 8].map((j) => `<path class="chip" style="--c: ${SECOND}" d="M${edge(j).join("L")}L${edge(j + 1).reverse().join("L")}Z"/>`).join("");
// An image that goes over the edges of its square is cut there
const cut = (art: string) => `<rect class="tile" x="30" y="30" width="${TILE}" height="${TILE}"/><svg class="window" aria-hidden="true" x="30" y="30" width="${TILE}" height="${TILE}">${art}</svg>`;
const card =
  `<rect class="edge" x="6" y="10" width="60" height="52" rx="5"/>` + path("edge", "M6 24H66M14 34H46M14 42H38") + `<rect class="tint" x="40" y="48" width="20" height="8" rx="2"/>`;

// --- texture, and what an image looks like on an object

export const texture = () => flow([['url("photo.jpg")', tile(photo)], ["texture", onCube(CELL, photo)]]) + says('texture: url("photo.jpg");');

export function textureSize(): string {
  const quarter = [0, 1, 2, 3].map((n) => `<g transform="translate(${(n % 2) * 36} ${Math.floor(n / 2) * 36}) scale(0.5)">${photo}</g>`).join("");
  return steps([["texture-size: auto;", onCube(CELL, photo)], ["texture-size: 0.5;", onCube(CELL, quarter)]]);
}

// A map of the world, twice as wide as it is tall: a meridian every 45deg, the parallels at 45deg
// north and south, and in signal the equator and the meridian of the middle, the one that
// faces the front. In a box of width × height.
const graticule = (width: number, height: number) =>
  path("edge", [1, 2, 3, 5, 6, 7].map((i) => `M${round((i * width) / 8)} 0V${height}`).join("") + [1, 3].map((j) => `M0 ${round((j * height) / 4)}H${width}`).join("")) +
  path("tint", `M${width / 2} 0V${height}M0 ${height / 2}H${width}`);

// The map on each face of a cube, whole each time, then once around a ball: the same lines,
// only the half the eye sees, like the faces of a cube
export function textureMapping(): string {
  const radius = 0.6;
  const globe = ball(REST_VIEW, radius);
  // A point of the ball at a longitude and a latitude, in degrees: longitude 0 faces the front
  const at = (longitude: number, latitude: number): Vec3 => {
    const [l, p] = [(longitude * Math.PI) / 180, (latitude * Math.PI) / 180];
    return [radius * Math.cos(p) * Math.sin(l), radius * Math.sin(p), radius * Math.cos(p) * Math.cos(l)];
  };
  const meridian = (longitude: number) => ({ points: Array.from({ length: 37 }, (_, k) => at(longitude, -90 + k * 5)) });
  const parallel = (latitude: number) => ({ points: Array.from({ length: 73 }, (_, k) => at(-180 + k * 5, latitude)) });
  const seen = (...drawn: { points: Vec3[] }[]) => draw({ lines: drawn, mesh: globe.mesh }, CELL).visible;
  // The flat map, as wide as the cell lets it be, in its middle
  const [width, height] = [CELL.width - 24, (CELL.width - 24) / 2];
  const [x, y] = [(CELL.width - width) / 2, (CELL.height - height) / 2];
  const map = `<rect class="tile" x="${x}" y="${y}" width="${width}" height="${height}"/><g transform="translate(${x} ${y})">${graticule(width, height)}</g>`;
  return steps([
    ['url("earth.jpg")', map],
    ["texture-mapping: box;", onCube(CELL, graticule(TILE, TILE))],
    [
      "texture-mapping: sphere;",
      lines(globe, CELL) +
        path("edge", seen(...[-135, -90, -45, 45, 90, 135].map(meridian), parallel(-45), parallel(45))) +
        path("tint", seen(meridian(0), parallel(0))),
    ],
  ]);
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

// The number of each face ::face() gives, written on the faces the eye sees: a cube like a
// die, a pyramid from its front slope turning right then its base, an octahedron from its
// front-right top triangle
const numbered = (shape: "cube" | "pyramid" | "octahedron", faces: [middle: Vec3, normal: Vec3][]) =>
  lines(SHAPES[shape](REST_VIEW), CELL) +
  faces
    .map(([middle, normal], i) => {
      const seen = normal[0] * REST_VIEW.eye[0] + normal[1] * REST_VIEW.eye[1] + normal[2] * REST_VIEW.eye[2] > 0.3 * Math.hypot(...normal); // a face seen nearly edge-on is left without its number
      const [x, y] = place(middle, CELL, REST_VIEW);
      return seen ? text(x - 3.5, y + 4, String(i + 1), "mark-label face-number") : "";
    })
    .join("");
const corner = (sx: number, sy: number, sz: number): [Vec3, Vec3] => [[sx * 0.21, sy * 0.21, sz * 0.21], [sx, sy, sz]];
export const face = () =>
  steps([
    [
      "cube::face(1)",
      numbered("cube", [
        [[0, 0, 0.5], [0, 0, 1]], [[0, 0.5, 0], [0, 1, 0]], [[0.5, 0, 0], [1, 0, 0]],
        [[-0.5, 0, 0], [-1, 0, 0]], [[0, -0.5, 0], [0, -1, 0]], [[0, 0, -0.5], [0, 0, -1]],
      ]),
    ],
    [
      "pyramid::face(1)",
      numbered("pyramid", [
        [[0, -0.1, 0.33], [0, 0.5, 1.05]], [[0.33, -0.1, 0], [1.05, 0.5, 0]], [[0, -0.1, -0.33], [0, 0.5, -1.05]],
        [[-0.33, -0.1, 0], [-1.05, 0.5, 0]], [[0, -0.45, 0], [0, -1, 0]],
      ]),
    ],
    [
      "octahedron::face(1)",
      numbered("octahedron", [
        corner(1, 1, 1), corner(1, 1, -1), corner(-1, 1, -1), corner(-1, 1, 1),
        corner(1, -1, 1), corner(1, -1, -1), corner(-1, -1, -1), corner(-1, -1, 1),
      ]),
    ],
  ]) + says('cube::face(1) { content: "1"; }');

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

export const fontSize = () =>
  steps([
    ["font-size: auto;", letters("font-family: sans-serif")],
    ["font-size: 0.2;", letters("font-family: sans-serif; font-size: 20px")],
  ]);

// Two lines, leaning to one side
const aligned = (anchor: "start" | "middle" | "end") => {
  const x = { start: 18, middle: 66, end: 114 }[anchor];
  return `<text class="letters" text-anchor="${anchor}" x="${x}" y="58">GPU</text><text class="letters" text-anchor="${anchor}" x="${x}" y="86">Style Sheets</text>`;
};

export const textAlign = () =>
  steps([
    ["text-align: start;", aligned("start")],
    ["text-align: center;", aligned("middle")],
    ["text-align: end;", aligned("end")],
  ]);

export const textFill = () =>
  steps([
    ["black or white", onCube(CELL, word("GSS"))],
    ["text-color: #ff5a36;", onCube(CELL, word("GSS", ' style="stroke: var(--gss-signal)"'))],
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
export const checker = () =>
  flow([["checker()", tile(checks())], ["color", `<g class="opaque">${onCube(CELL, (face) => checks(face !== "front"))}</g>`]]) + says(`color: checker(4, ${FIRST}, ${SECOND});`);
// Across y: bands around the sides, and one color on the top
export const stripes = () =>
  flow([["stripes()", tile(bands)], ["color", `<g class="opaque">${onCube(CELL, (face) => (face === "top" ? filled(0, 0, TILE, TILE, FIRST) : bands))}</g>`]]) + says(`color: stripes(4, ${FIRST}, ${SECOND});`);
export const displace = () =>
  cells(
    "figure-flow sums",
    [
      ["an image", tile(bands)],
      ["a map", tile(clouds)],
      ["displace()", cut(waves)],
    ],
    CELL,
  ) + says(`color: displace(stripes(4, ${FIRST}, ${SECOND}), noise(2, black, white), 0.3);`);

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
  // Glass: three bars stand behind the ball. Around it they are straight; through it they
  // are seen bent, like through a lens.
  const bars = [-15, 0, 15].map((dx) => {
    const reach = Math.sqrt(r * r - dx * dx);
    const [x, top, bottom] = [round(cx + dx), round(cy - reach), round(cy + reach)];
    return { around: `M${x} ${round(cy - r - 16)}V${top}M${x} ${bottom}V${round(cy + r + 16)}`, through: `M${x} ${top}Q${round(cx + dx * 2.6)} ${cy} ${x} ${bottom}` };
  });
  const glass =
    path("guide", bars.map((bar) => bar.around).join("")) +
    path("guide bent", bars.map((bar) => bar.through).join("")) +
    `<circle class="edge" cx="${cx}" cy="${cy}" r="${round(r)}"/>` +
    `<g class="glows">${glint}</g>`;
  // Jelly: the ball in its color, see-through, shaded with points. They are spread evenly over
  // the ball, and fewer are kept where it faces the light, which comes from the upper left.
  const [inside, count] = [r - 3, 300];
  const toLight = [-0.48, -0.6, 0.64];
  const stipple = Array.from({ length: count }, (_, i) => {
    const [radius, angle] = [Math.sqrt((i + 0.5) / count), i * 2.39996];
    const [x, y] = [radius * Math.cos(angle), radius * Math.sin(angle)];
    const facing = Math.max(0, x * toLight[0] + y * toLight[1] + Math.sqrt(1 - x * x - y * y) * toLight[2]);
    // a point is kept by its place in the list, not by chance: the same drawing each time
    return (1 - facing) ** 1.7 > (i * 0.7548776662) % 1 ? `M${round(cx + x * inside)} ${round(cy + y * inside)}h0.01` : "";
  }).join("");
  const jelly = `<circle class="jelly" cx="${cx}" cy="${cy}" r="${round(r)}"/>` + path("stipple", stipple) + `<g class="glows">${glint}</g>`;
  return cells(
    "figure-steps",
    [
      ["matte()", sphere],
      // a metal mirrors the horizon and the floor
      ["metal()", sphere + path("edge", arc(0, 160, 20).replace("0 0 1", "0 0 0").replace(/A[\d.]+ [\d.]+/, `A${r} ${round(r * 0.35)}`)) + glint],
      ["glass()", glass],
      ["jelly()", jelly],
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
  "texture-mapping": textureMapping,
  "image-rendering": imageRendering,
  "selector-face": face,
  "fn-element": element,
  content,
  "font-family": fontFamily,
  "font-weight": fontWeight,
  "font-style": fontStyle,
  "font-size": fontSize,
  "text-align": textAlign,
  "text-color": textFill,
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
