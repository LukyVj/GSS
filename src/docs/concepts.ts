// Four ideas of GSS drawn small, in the column "How GSS works" of the search: what a reader
// needs before the reference makes sense. Each one links to the page that says it in full.
// The drawings are true to the language: the specificities are those of the selectors pages,
// the axes those of translate, and the steps of the ray are a real sphere tracing.

export type Concept = { title: string; text: string; anchor: string; link: string; svg: string };

const svg = (label: string, body: string) =>
  `<svg class="gss-concept-svg" viewBox="0 0 260 100" role="img" aria-label="${label}">${body}</svg>`;

// @scene { group#lamp { sphere#shade; light#bulb; } }, as a tree
const TREE = svg(
  "A tree: @scene holds group#lamp, which holds sphere#shade and light#bulb",
  `<path class="c-line" d="M18 26v14h14M42 50v14h14M42 64v24h14" />
  <text x="12" y="20"><tspan class="c-at">@scene</tspan></text>
  <text x="36" y="44"><tspan class="c-tag">group</tspan><tspan class="c-id">#lamp</tspan></text>
  <text x="60" y="68"><tspan class="c-tag">sphere</tspan><tspan class="c-id">#shade</tspan></text>
  <text x="60" y="92"><tspan class="c-tag">light</tspan><tspan class="c-id">#bulb</tspan></text>
  <circle class="c-shape" cx="214" cy="46" r="20" />
  <circle class="c-dot" cx="214" cy="80" r="3" />
  <path class="c-ray" d="M214 88v6M206 80h-6M222 80h6M208 74l-4-4M220 74l4-4" />`,
);

// Three rules set the color of one sphere: the most specific wins
const CASCADE = svg(
  "Three rules color the same sphere: sphere counts 1, .glass 100, #ball 10000, so #ball wins",
  `<text class="c-label" x="10" y="12">selector</text><text class="c-label" x="150" y="12" text-anchor="end">specificity</text>
  <rect class="c-row" x="4" y="20" width="152" height="22" />
  <text x="12" y="35"><tspan class="c-tag">sphere</tspan></text><rect x="78" y="25" width="12" height="12" fill="#7cb4ff" /><text class="c-number" x="148" y="35" text-anchor="end">1</text>
  <rect class="c-row" x="4" y="46" width="152" height="22" />
  <text x="12" y="61"><tspan class="c-class">.glass</tspan></text><rect x="78" y="51" width="12" height="12" fill="#6fe0cf" /><text class="c-number" x="148" y="61" text-anchor="end">100</text>
  <rect class="c-row c-win" x="4" y="72" width="152" height="22" />
  <text x="12" y="87"><tspan class="c-id">#ball</tspan></text><rect x="78" y="77" width="12" height="12" fill="#ff5a36" /><text class="c-number" x="148" y="87" text-anchor="end">10000</text>
  <path class="c-line" d="M162 83h40" /><path class="c-line" d="M196 79l6 4-6 4" />
  <circle cx="226" cy="58" r="22" fill="#ff5a36" />`,
);

// x right, y up, z toward the viewer, the floor at y = 0, a cube of 1 on it
const SPACE = svg(
  "Axes: x to the right, y up, z toward the viewer; a cube sits on the floor at y = 0",
  `<path class="c-floor" d="M62 48H222L174 84H14Z" />
  <path class="c-axis" d="M118 66H206M118 66V14M118 66L88 88" />
  <path class="c-axis" d="M200 62l6 4-6 4M114 20l4-6 4 6M88 82v6h7" />
  <text class="c-label" x="211" y="70">x</text><text class="c-label" x="124" y="16">y</text><text class="c-label" x="78" y="96">z</text>
  <text class="c-label" x="22" y="80">y = 0</text>
  <path class="c-cube" d="M148 46h20v20h-20zM148 46l12-9h20l-12 9M168 66l12-9V37" />`,
);

// A ray walks by the distance to the nearest surface (two spheres and the floor), then hits
const STEPS: [number, number, number][] = [
  [14, 52, 36], [50, 51.6, 36.4], [86.4, 51.2, 14.7], [101.1, 51, 9.2], [110.3, 50.9, 9.7],
  [120, 50.8, 13.5], [133.5, 50.6, 22.4], [155.8, 50.4, 32.3],
];
const DISTANCE = svg(
  "A ray leaves the camera and steps toward a sphere; each step is a circle as wide as the distance to the nearest surface, and the circles shrink near the other sphere until the ray touches the first one",
  `<path class="c-floor-line" d="M0 88H260" />
  ${STEPS.map(([x, y, d]) => `<circle class="c-step" cx="${x}" cy="${y}" r="${d}" />`).join("")}
  <circle class="c-shape" cx="104" cy="26" r="16" /><circle class="c-shape" cx="210" cy="54" r="22" />
  <path class="c-ray-line" d="M14 52L188 50" />
  ${STEPS.map(([x, y]) => `<circle class="c-point" cx="${x}" cy="${y}" r="1.6" />`).join("")}
  <circle cx="188" cy="50" r="3" fill="#ff5a36" />`,
);

export const CONCEPTS: Concept[] = [
  {
    title: "Objects in @scene",
    text: "@scene lists the objects and nests them in groups, like the elements of a page. Rules then style them.",
    anchor: "at-scene",
    link: "@scene",
    svg: TREE,
  },
  {
    title: "The cascade",
    text: "A rule targets objects by shape, class or id. When two rules set the same property, the more specific one wins, like CSS.",
    anchor: "selector-type",
    link: "selectors",
    svg: CASCADE,
  },
  {
    title: "Space",
    text: "x points right, y up and z toward you. The floor is at y = 0, and lengths are in units of the scene.",
    anchor: "translate",
    link: "translate",
    svg: SPACE,
  },
  {
    title: "One shader, by distance",
    text: "The stylesheet becomes one shader. For each pixel, it walks a ray by the distance to the nearest surface, until it touches one.",
    anchor: "shape-cube",
    link: "shapes",
    svg: DISTANCE,
  },
];
