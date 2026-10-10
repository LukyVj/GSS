import { between, cells, isolines, lines, path, playing, round, says, stage, text } from "./figure-kit";
import { REST_VIEW, SHAPES, ball, box, floor, moved, place, spinDrawing, together, type Frame, type Vec3 } from "./hairline";

// The scene around the objects: its light, its floor, its fog, its camera; and what changes
// how an object shows in it: its outline, its opacity, how it joins the others.

const SCENE: Frame = { width: 380, height: 220, scale: 46, x: 190, y: 150 };
const CELL: Frame = { width: 132, height: 132, scale: 62, x: 66, y: 66 };
const { PI } = Math;

// A line through points of the scene, on the screen
const route = (frame: Frame, points: Vec3[], closed = false) =>
  `M${points.map((p) => place(p, frame, REST_VIEW)).map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}${closed ? "Z" : ""}`;
// A circle lying flat at a height, or a part of it: from an angle to another, 0 in front
const ringPoints = (center: Vec3, radius: number, from = 0, to = 360): Vec3[] =>
  Array.from({ length: 49 }, (_, i) => {
    const angle = ((from + ((to - from) * i) / 48) * PI) / 180;
    return [center[0] + radius * Math.sin(angle), center[1], center[2] + radius * Math.cos(angle)];
  });
const sphereAt = (y: number, radius = 0.5) => moved(ball(REST_VIEW, radius), [0, y, 0]);
const fade = (art: string, back = false) => `<g class="fades${back ? " reverse" : ""}">${art}</g>`;

// --- the light

function light(): string {
  const scene = lines(together(floor(1.4, 0.7), sphereAt(0.5)), SCENE);
  // The sun, from the upper left in front; the shadow goes the other way
  const rays = [0, 1, 2].map((i) => `M${92 + i * 24} ${24 + i * 5}L${146 + i * 20} ${98 + i * 7}`).join("");
  const shadow = path("ghost", route(SCENE, ringPoints([0.85, 0, -0.35], 0.42), true));
  return stage(SCENE, scene + shadow + path("tint flows", rays)) + says("light: -45deg 54.7deg;");
}

function intensity(): string {
  const bulb: Frame = { ...SCENE, scale: 70, x: 120, y: 104 };
  const lit: Frame = { ...SCENE, scale: 74, x: 280, y: 112 };
  return (
    stage(SCENE, `<g class="tinted pulses" style="transform-origin: 120px 104px">${lines(SHAPES.light(REST_VIEW), bulb)}</g>` + lines(ball(REST_VIEW, 0.5), lit)) +
    between("intensity: 0.5;", "intensity: 2;")
  );
}

// The side the sun does not reach: dark with a low ambient light, clear with a high one
function ambient(): string {
  const frame: Frame = { ...SCENE, scale: 110, x: 190, y: 108 };
  const [cx, cy, r] = [190, 108, 66];
  const shade = [0, 1, 2, 3, 4]
    .map((i) => {
      const inner = r - 6 - i * 9;
      const at = (angle: number) => `${round(cx + inner * Math.cos((angle * PI) / 180))} ${round(cy + inner * Math.sin((angle * PI) / 180))}`;
      return `M${at(-10 + i * 6)}A${inner} ${inner} 0 0 1 ${at(110 - i * 6)}`;
    })
    .join("");
  return stage(frame, lines(ball(REST_VIEW, 0.6), frame) + `<g class="dims">${path("edge", shade)}</g>`) + between("ambient: 0.1;", "ambient: 0.6;");
}

function shadows(): string {
  const scene = lines(together(floor(1.4, 0.7), sphereAt(1.1)), SCENE);
  const cast = [0.42, 0.3, 0.18].map((radius) => route(SCENE, ringPoints([0.7, 0, -0.3], radius), true)).join("");
  return stage(SCENE, scene + fade(path("edge", cast))) + between("shadows: none;", "shadows: soft;");
}

// The farther from the camera, the more fog: each ball fades by its distance
function fog(): string {
  const frame: Frame = { ...SCENE, scale: 44, x: 176, y: 150 };
  // From near on the left to far on the right, as the eye sees them
  const places: [number, number, number][] = [
    [-1.48, 0.49, 1],
    [-0.51, 0.15, 0.62],
    [0.47, -0.18, 0.32],
    [1.44, -0.51, 0.1],
  ];
  const balls = places.map(([x, z, left]) => `<g class="mists" style="--to: ${left}">${lines(moved(ball(REST_VIEW, 0.36), [x, 0.36, z]), frame)}</g>`).join("");
  return stage(frame, lines(floor(1.8, 0.9), frame) + balls) + between("fog: none;", "fog: 6 14;");
}

function floorFigure(): string {
  return stage(SCENE, fade(lines(floor(1.4, 0.7), SCENE), true) + lines(sphereAt(0.5), SCENE)) + between("floor: #e8e3db;", "floor: none;");
}

// --- the background: layers behind the scene, the first on top

function background(): string {
  const frame: Frame = { ...SCENE, scale: 44, y: 160 };
  const sheet = (z: number): Vec3[] => [
    [-1.7, 0, z],
    [1.7, 0, z],
    [1.7, 2.2, z],
    [-1.7, 2.2, z],
  ];
  const [front, back] = [sheet(-1), sheet(-1.9)];
  const name = (points: Vec3[], words: string, kind: string) => {
    const [x, y] = place(points[3], frame, REST_VIEW);
    return text(x + 8, y + 12, words, kind);
  };
  return (
    stage(
      frame,
      path("edge", route(frame, back, true)) + name(back, "2", "plot-label") + path("tint", route(frame, front, true)) + name(front, "1", "plot-label lit") + lines(sphereAt(0.5), frame),
    ) + says("background: noise(3, #fff0 40%, #fff), linear-gradient(#2f6bd8, #9fc4ff);")
  );
}

function backgroundBlend(): string {
  const frame: Frame = { ...SCENE, height: 190 };
  const hatch = Array.from({ length: 9 }, (_, i) => `M${150 + i * 10} 70L${150} ${70 + i * 10}M${230} ${70 + i * 10}L${150 + i * 10} 150`).join("");
  return (
    stage(frame, `<rect class="edge" x="60" y="30" width="170" height="120"/><rect class="edge" x="150" y="70" width="170" height="90"/>` + path("tint", `M150 70H230V150H150Z${hatch}`)) +
    says("background-blend-mode: multiply;")
  );
}

// --- the camera: around its target, at a distance, at an angle

const VIEW: Frame = { width: 380, height: 230, scale: 38, x: 190, y: 170 };
const TARGET: Vec3 = [0, 0.3, 0];
const eyeAt = (around: number, above: number, distance: number): Vec3 => [
  TARGET[0] + distance * Math.cos((above * PI) / 180) * Math.sin((around * PI) / 180),
  TARGET[1] + distance * Math.sin((above * PI) / 180),
  TARGET[2] + distance * Math.cos((above * PI) / 180) * Math.cos((around * PI) / 180),
];
const dotAt = (frame: Frame, p: Vec3, kind = "dot", r = 4.5) => {
  const [x, y] = place(p, frame, REST_VIEW);
  return `<circle class="${kind}" cx="${round(x)}" cy="${round(y)}" r="${r}"/>`;
};

function camera(subject: string): string {
  const base = lines(together(floor(1.2, 0.6), moved(box(0.3, 0.3, 0.3), [0, 0.3, 0])), VIEW);
  const height = 2.6 * Math.sin((25 * PI) / 180) + TARGET[1];
  const radius = 2.6 * Math.cos((25 * PI) / 180);
  const orbit = ringPoints([0, height, 0], radius);
  const eye = eyeAt(40, 25, 2.6);
  const travel = (points: Vec3[], kind: string) => `<g class="travels ${kind}" style="offset-path: path('${route(VIEW, points)}')"><circle class="dot" r="4.5"/></g>`;
  if (subject === "camera-spin") {
    return stage(VIEW, base + path("ghost", route(VIEW, orbit, true)) + travel(orbit, "rides slow")) + says("camera-spin: 12s;");
  }
  if (subject === "controls") {
    const [x, y] = place(eyeAt(100, 25, 2.6), VIEW, REST_VIEW);
    return (
      stage(VIEW, base + path("ghost", route(VIEW, orbit, true)) + travel(ringPoints([0, height, 0], radius, -30, 100), "fixed") + text(x + 26, y, "orbit") + path("mark", route(VIEW, [eyeAt(-70, 25, 1.5), eyeAt(-70, 25, 2.6)])) + text(place(eyeAt(-70, 25, 2.6), VIEW, REST_VIEW)[0] - 22, place(eyeAt(-70, 25, 2.6), VIEW, REST_VIEW)[1] - 6, "zoom")) +
      says("controls: orbit zoom;")
    );
  }
  if (subject === "camera-distance") {
    const way = [eyeAt(40, 25, 1.3), eyeAt(40, 25, 3)];
    return stage(VIEW, base + path("guide", route(VIEW, [TARGET, way[1]])) + travel(way, "fixed")) + between("camera-distance: 4;", "camera-distance: 12;", "3.6s");
  }
  if (subject === "camera-target") {
    const other: Vec3 = [0, 1.5, 0];
    const look = (target: Vec3) => path("tint", route(VIEW, [eye, target])) + dotAt(VIEW, target);
    return stage(VIEW, base + dotAt(VIEW, eye, "edge") + fade(look(TARGET), true) + fade(look(other))) + between("camera-target: 0 0.5 0;", "camera-target: 0 1.5 0;");
  }
  // camera-angle: around the vertical axis from the front, then above the horizon
  const ground = ringPoints([0, 0, 0], radius);
  const foot: Vec3 = [eye[0], 0, eye[2]];
  const [ax, ay] = place(ringPoints([0, 0, 0], radius, 0, 40)[24], VIEW, REST_VIEW);
  const [bx, by] = place([foot[0], eye[1] / 2, foot[2]], VIEW, REST_VIEW);
  return (
    stage(
      VIEW,
      base +
        path("ghost", route(VIEW, ground, true)) +
        path("guide", route(VIEW, [TARGET, eye])) +
        path("tint", route(VIEW, ringPoints([0, 0, 0], radius, 0, 40))) +
        path("tint", route(VIEW, [foot, eye])) +
        dotAt(VIEW, eye) +
        text(ax - 8, ay + 14, "40deg", "axis-label lit") +
        text(bx + 26, by, "25deg", "axis-label lit"),
    ) + says("camera-angle: 40deg 25deg;")
  );
}

// --- the pixels of the render

const curve = (x: number) => 104 - Math.sqrt(Math.max(0, 76 * 76 - (x - 104) * (x - 104)));
const smooth = `M${Array.from({ length: 26 }, (_, k) => `${28 + k * 3} ${round(curve(28 + k * 3))}`).join("L")}`;
const stairs = (step: number) => {
  let d = `M28 ${Math.round(curve(28) / step) * step}`;
  for (let x = 28; x < 100; x += step) d += `H${x + step}V${Math.round(curve(x + step) / step) * step}`;
  return d;
};
const grid = (step: number) => path("ground", Array.from({ length: Math.floor(76 / step) + 1 }, (_, i) => `M${28 + i * step} 28V104M28 ${28 + i * step}H104`).join(""));

const dpr = () => cells("figure-steps", [["dpr: 1;", grid(19) + path("tint", stairs(19))], ["dpr: 2;", grid(9.5) + path("tint", stairs(9.5))]], CELL);
const shapeRendering = () => cells("figure-steps", [["shape-rendering: auto;", path("tint", stairs(9.5))], ["shape-rendering: geometricPrecision;", path("tint", smooth)]], CELL);

// --- distances: what GSS measures to draw a scene, and what joins two objects

const boxAt = (cx: number, cy: number, half: number) => (x: number, y: number) => {
  const [dx, dy] = [Math.abs(x - cx) - half, Math.abs(y - cy) - half];
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
};
const discAt = (cx: number, cy: number, radius: number) => (x: number, y: number) => Math.hypot(x - cx, y - cy) - radius;
const AREA: [number, number, number, number] = [0, 0, 132, 132];

function view(): string {
  const solids = together(moved(box(0.3, 0.3, 0.3), [-0.3, 0, 0.2]), moved(ball(REST_VIEW, 0.38), [0.32, 0.05, -0.2]));
  const [square, disc] = [boxAt(50, 72, 22), discAt(84, 60, 24)];
  const distance = (x: number, y: number) => Math.min(square(x, y), disc(x, y));
  const rings = [7, 14, 21, 28].map((level, i) => `<g class="ripples" style="--i: ${i}">${path("guide", isolines(distance, level, AREA))}</g>`).join("");
  return cells("figure-steps", [["view: shaded;", lines(solids, CELL)], ["view: distance;", path("edge", isolines(distance, 0, AREA)) + rings]], CELL);
}

function operation(): string {
  const [square, disc] = [boxAt(54, 72, 24), discAt(80, 58, 26)];
  const both = `<rect class="ghost" x="30" y="48" width="48" height="48"/><circle class="ghost" cx="80" cy="58" r="26"/>`;
  const result = (f: (x: number, y: number) => number) => both + path("tint", isolines(f, 0, AREA, 2));
  return cells(
    "figure-steps",
    [
      ["operation: union;", result((x, y) => Math.min(square(x, y), disc(x, y)))],
      ["operation: subtract;", result((x, y) => Math.max(square(x, y), -disc(x, y)))],
      ["operation: intersect;", result((x, y) => Math.max(square(x, y), disc(x, y)))],
    ],
    CELL,
  );
}

function blend(): string {
  const frame: Frame = { ...SCENE, height: 200 };
  const [one, two] = [discAt(150, 104, 44), discAt(236, 100, 34)];
  const joined = (k: number) => (x: number, y: number) => {
    const [a, b] = [one(x, y), two(x, y)];
    const h = k ? Math.max(k - Math.abs(a - b), 0) / k : 0;
    return Math.min(a, b) - h * h * k * 0.25;
  };
  const area: [number, number, number, number] = [80, 30, 300, 180];
  return stage(frame, fade(path("edge", isolines(joined(0), 0, area, 2)), true) + fade(path("tint", isolines(joined(40), 0, area, 2)))) + between("blend: 0;", "blend: 0.4;");
}

// --- how an object shows

function opacity(): string {
  const frame: Frame = { ...SCENE, scale: 86, x: 190, y: 112 };
  const cube = moved(box(0.36, 0.36, 0.36), [0.36, 0, -0.5]);
  const sphere = moved(ball(REST_VIEW, 0.5), [-0.12, 0, 0.3]);
  const opaque = lines(together(cube, sphere), frame);
  const clear = lines(cube, frame) + `<g class="faint">${lines(sphere, frame)}</g>`;
  return stage(frame, fade(opaque, true) + fade(clear)) + between("opacity: 1;", "opacity: 0.4;");
}

function blendMode(): string {
  const frame: Frame = { ...SCENE, height: 210 };
  const discs: [number, number, string][] = [
    [160, 84, "#ff5a5a"],
    [220, 84, "#5aff8a"],
    [190, 134, "#5a8aff"],
  ];
  const all = (x: number, y: number) => Math.max(...discs.map(([cx, cy]) => Math.hypot(x - cx, y - cy) - 48));
  return (
    stage(frame, discs.map(([cx, cy, stroke]) => `<circle cx="${cx}" cy="${cy}" r="48" style="stroke: ${stroke}"/>`).join("") + path("edge", isolines(all, 0, [130, 60, 250, 160], 2))) +
    says("mix-blend-mode: screen;")
  );
}

function filter(): string {
  const frame: Frame = { ...CELL, scale: 60 };
  const sphere = lines(ball(REST_VIEW, 0.6), frame);
  // Grains, the same at every build
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const grains = Array.from({ length: 60 }, () => `<circle class="dot" cx="${round(16 + next() * 100)}" cy="${round(16 + next() * 100)}" r="0.8"/>`).join("");
  return cells(
    "figure-steps",
    [
      ["filter: blur(4px);", `<g style="filter: blur(2.5px)">${sphere}</g>`],
      ["filter: bloom();", `<g class="tinted" style="filter: drop-shadow(0 0 5px #ff5a36) drop-shadow(0 0 2px #ff5a36)">${sphere}</g>`],
      ["filter: hue-rotate(160deg);", `<g class="tinted" style="filter: hue-rotate(160deg)">${sphere}</g>`],
      ["filter: grain();", sphere + `<g class="flickers">${grains}</g>`],
    ],
    frame,
  );
}

// transform-origin: the cube turns around its left bottom edge, not around its center
function transformOrigin(): string {
  const frame: Frame = { width: 380, height: 250, scale: 56, x: 190, y: 128 };
  const from: Vec3 = [0.42, 0.42, 0];
  const { cube, axis } = spinDrawing("z", 24, frame, REST_VIEW, from);
  const drawing = path("hidden", cube.hidden) + path("line", cube.visible, ' pathLength="1"') + path("axis-behind", axis.hidden) + path("axis-front", axis.visible) + dotAt(frame, [0, 0, 0]);
  return stage(frame, drawing, ` data-spin="z" data-from="${from.join(" ")}" data-frame="${frame.scale} ${frame.x} ${frame.y}"`) + says("transform-origin: left bottom;");
}

// cursor: the pointer changes when it is over the object
function cursor(): string {
  const frame: Frame = { ...SCENE, height: 200, scale: 80, x: 160, y: 104 };
  const arrow = path("edge arrow", "M0 0V17L4.5 13L7.5 20L10.5 18.6L7.6 12H13Z");
  const hand = path("tint hand", "M4 10V2.5a2 2 0 0 1 4 0V8l5.5 1.2a2 2 0 0 1 1.5 2V14a6 6 0 0 1-6 6H8a5 5 0 0 1-4-2L.6 13.4a1.5 1.5 0 0 1 2.3-2Z");
  return stage(frame, lines(box(0.4, 0.4, 0.4), frame) + `<g transform="translate(160 100)"><g class="points">${arrow}${hand}</g></g>`) + says("cursor: pointer;");
}

// --- outline: a line around the object

const OUTLINED: Frame = { ...SCENE, height: 210, scale: 96, x: 190, y: 106 };
const around = (frame: Frame, gap: number, more = "") => `<circle class="tint"${more} cx="${frame.x}" cy="${frame.y}" r="${round(0.6 * frame.scale + gap)}"/>`;
const outlinedBall = (frame: Frame) => lines(ball(REST_VIEW, 0.6), frame);

const outline = () => stage(OUTLINED, outlinedBall(OUTLINED) + around(OUTLINED, 9)) + says("outline: 0.03 solid #ff5a36;");
const outlineColor = () =>
  stage(OUTLINED, outlinedBall(OUTLINED) + `<g class="hued">${around(OUTLINED, 9)}</g>`) + playing(["outline-color: #ff5a36;", "outline-color: rgb(79 140 255);", "outline-color: mediumseagreen;"]);
const outlineOffset = () => stage(OUTLINED, outlinedBall(OUTLINED) + fade(around(OUTLINED, 2), true) + fade(around(OUTLINED, 18))) + between("outline-offset: 0;", "outline-offset: 0.15;");
const SMALL: Frame = { ...CELL, scale: 56 };
const outlineWidth = () =>
  cells(
    "figure-steps",
    [
      ["outline-width: thin;", outlinedBall(SMALL) + around(SMALL, 8)],
      ["outline-width: medium;", outlinedBall(SMALL) + around(SMALL, 8, ' style="stroke-width: 2"')],
      ["outline-width: thick;", outlinedBall(SMALL) + around(SMALL, 9, ' style="stroke-width: 4"')],
    ],
    SMALL,
  );
const outlineStyle = () =>
  cells(
    "figure-steps",
    [
      ["outline-style: solid;", outlinedBall(SMALL) + around(SMALL, 8)],
      ["outline-style: dashed;", outlinedBall(SMALL) + around(SMALL, 8, ' style="stroke-dasharray: 7 7"')],
      ["outline-style: dotted;", outlinedBall(SMALL) + around(SMALL, 8, ' style="stroke-dasharray: 0.1 6; stroke-width: 2"')],
      ["outline-style: double;", outlinedBall(SMALL) + around(SMALL, 6) + around(SMALL, 11)],
    ],
    SMALL,
  );

const SCENES: Record<string, (subject: string) => string> = {
  light,
  intensity,
  ambient,
  shadows,
  fog,
  floor: floorFigure,
  background,
  "background-blend-mode": backgroundBlend,
  "camera-target": camera,
  "camera-distance": camera,
  "camera-angle": camera,
  "camera-spin": camera,
  controls: camera,
  dpr,
  "shape-rendering": shapeRendering,
  view,
  operation,
  blend,
  opacity,
  "mix-blend-mode": blendMode,
  filter,
  "transform-origin": transformOrigin,
  cursor,
  outline,
  "outline-width": outlineWidth,
  "outline-style": outlineStyle,
  "outline-color": outlineColor,
  "outline-offset": outlineOffset,
};
export const scenes = (subject: string) => SCENES[subject](subject);
export const SCENE_PAGES = Object.keys(SCENES);
