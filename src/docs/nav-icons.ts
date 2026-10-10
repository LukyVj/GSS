// The icon of each group of the docs sidebar, by the id of the group (DOC_GROUPS): the inside
// of a 16 × 16 SVG drawn with a 1.25 stroke in currentColor, so an icon takes the colour of the
// text next to it. A face or a part is filled at 35 %. The brand page shows them and offers them
// to download, from here too.
const F = 'fill="currentColor" stroke="none"';
const SOFT = 'fill="currentColor" fill-opacity=".35" stroke="none"';

export const NAV_ICONS: Record<string, string> = {
  // Start here
  "getting-started": `<rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5"/><path class="m" d="M6.5 5.4v5.2L10.75 8z" ${F}/>`,
  installation: `<path class="m" d="M8 1.75v7.5M5 6.25l3 3 3-3"/><path class="n" d="M2.25 10v2.5c0 .7.55 1.25 1.25 1.25h9c.7 0 1.25-.55 1.25-1.25V10"/>`,
  // Language
  "at-rules": `<circle cx="8" cy="8" r="2.25"/><path d="M10.25 5.75V8.9a1.6 1.6 0 0 0 3.2 0V8a5.45 5.45 0 1 0-2.2 4.4"/>`,
  selectors: `<circle class="m" cx="8" cy="8" r="4.75"/><path class="m" d="M8 1.25v3M8 11.75v3M1.25 8h3M11.75 8h3"/><circle class="n" cx="8" cy="8" r="1.1" ${F}/>`,
  combinators: `<rect x="5.5" y="1.75" width="5" height="3.5" rx="1"/><path d="M8 5.25v2.5"/><path class="m" pathLength="1" d="M4 10.25v-2.5h8v2.5"/><rect x="1.5" y="10.25" width="5" height="3.75" rx="1"/><rect class="n" x="9.5" y="10.25" width="5" height="3.75" rx="1" ${SOFT}/><rect x="9.5" y="10.25" width="5" height="3.75" rx="1"/>`,
  "pseudo-classes": `<path class="m" d="M6.25 4.75v9l2.3-2.1 1.55 3.25 1.45-.7-1.55-3.2h3.15z"/><path class="n" d="M6.25 1v1.5M2.25 4.75h1.5M3.4 1.9l1 1M9.1 1.9l-1 1"/>`,
  "variables-conditions": `<circle cx="4" cy="12.5" r="1.5"/><circle cx="4" cy="3.5" r="1.5"/><circle class="n" cx="12" cy="3.5" r="1.5" ${F}/><path d="M4 5v6"/><path class="m" pathLength="1" d="M5.4 11.6C8.6 10.4 12 8.6 12 5"/>`,
  values: `<path class="m" d="M4.5 2.25v4.5M2.25 4.5h4.5"/><path d="M9.25 4.5h4.5"/><path class="n" d="M2.9 9.9l3.2 3.2M6.1 9.9l-3.2 3.2"/><path d="M9.25 10.25h4.5M9.25 12.75h4.5"/>`,
  // Structure
  shapes: `<path d="M8 8 2.8 5 8 2l5.2 3z" ${SOFT}/><path d="M8 2l5.2 3v6L8 14l-5.2-3V5z"/><path d="M2.8 5 8 8l5.2-3M8 8v6"/>`,
  "object-properties": `<rect class="m" x="2" y="5.75" width="8.25" height="8.25" rx="1"/><path d="M2 2.75h8.25M2 1.75v2M10.25 1.75v2M13.25 5.75V14M12.25 5.75h2M12.25 14h2"/>`,
  combinations: `<path class="o" d="M8 4.25a4.25 4.25 0 0 1 0 7.5 4.25 4.25 0 0 1 0-7.5z" ${SOFT}/><circle class="m" cx="5.75" cy="8" r="4.25"/><circle class="n" cx="10.25" cy="8" r="4.25"/>`,
  // Appearance
  colors: `<path d="M8 1.5S3.5 6.5 3.5 9.75a4.5 4.5 0 0 0 9 0C12.5 6.5 8 1.5 8 1.5z"/><path d="M5.9 10.1a2.2 2.2 0 0 0 1.75 2.1"/>`,
  "color-functions": `<path d="M8 8V1.75a6.25 6.25 0 0 1 5.41 9.375z" ${SOFT}/><circle cx="8" cy="8" r="6.25"/><path d="M8 8V1.75M8 8l5.41 3.125M8 8l-5.41 3.125"/>`,
  gradients: `<rect x="1.75" y="1.75" width="12.5" height="12.5" rx="1.5"/>` +
    [[4.5, 4.5], [4.5, 6.83], [4.5, 9.17], [4.5, 11.5], [6.83, 5.67], [6.83, 10.33], [9.17, 8], [11.5, 4.5]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".8" ${F}/>`).join(""),
  materials: `<circle cx="8" cy="8" r="6.25"/><g class="m"><ellipse cx="5.6" cy="5.4" rx="1.5" ry="1" transform="rotate(-40 5.6 5.4)" ${F}/></g><path class="n" d="M12.4 9.2a4.6 4.6 0 0 1-3.4 3.6"/>`,
  textures: `<path d="M2 6h4V2H3a1 1 0 0 0-1 1zM10 6h4V3a1 1 0 0 0-1-1h-3zM6 10h4V6H6zM2 10v3a1 1 0 0 0 1 1h3v-4zM10 10v4h3a1 1 0 0 0 1-1v-3z" ${SOFT}/><rect x="2" y="2" width="12" height="12" rx="1"/>`,
  text: `<rect x="2" y="2" width="12" height="12" rx="1"/><path class="m" d="M5.25 5.5h5.5M8 5.5v5.25"/>`,
  filters: `<circle cx="8" cy="8" r="6.25"/><path class="m" d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" ${F}/>`,
  masks: `<path class="m" d="M3.5 1.75h9c1 0 1.75.75 1.75 1.75v9c0 1-.75 1.75-1.75 1.75h-9c-1 0-1.75-.75-1.75-1.75v-9c0-1 .75-1.75 1.75-1.75zM8 3.75a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 1 0 0-8.5z" fill-rule="evenodd" ${SOFT}/><rect x="1.75" y="1.75" width="12.5" height="12.5" rx="1.75"/><circle class="n" cx="8" cy="8" r="4.25"/>`,
  // Motion
  transforms: `<rect class="n" x="2" y="7" width="7" height="7" rx="1" opacity=".4"/><rect class="m" x="6.25" y="2.75" width="7" height="7" rx="1" transform="rotate(15 9.75 6.25)"/>`,
  animations: `<path class="o" d="M4 5.5 6.5 8 4 10.5 1.5 8z"/><path class="n" d="M12 5.5 14.5 8 12 10.5 9.5 8z" ${F}/><path d="M6.5 8h3"/><path d="M1.5 13.5h13" opacity=".45"/><path class="m" pathLength="1" d="M4 13.5h8"/>`,
  easings: `<path d="M1.75 12.75C7.25 12.75 8.75 3.25 14.25 3.25"/><path d="M1.75 12.75h5.5M14.25 3.25h-5.5" opacity=".5"/><circle cx="7.25" cy="12.75" r="1.1" ${F}/><circle cx="8.75" cy="3.25" r="1.1" ${F}/><circle class="m" r="1.25" opacity="0" ${F}/>`,
  // Scene
  camera: `<path class="n" d="M2.75 5h2l1.25-1.75h4L11.25 5h2c.55 0 1 .45 1 1v6.75c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1z"/><circle class="m" cx="8" cy="9.25" r="2.4"/>`,
  "scene-properties": `<g class="m"><circle cx="8" cy="6.25" r="2.25"/><path d="M8 2.5V1M10.65 3.6l1.06-1.06M5.35 3.6 4.29 2.54M11.75 6.25h1.5M4.25 6.25h-1.5"/></g><path class="n" d="M2.25 11h11.5"/><path class="o" d="M4.25 13.75h7.5"/>`,
  rendering: `<circle class="o" cx="8" cy="8" r="1.6" ${F}/><circle class="m" cx="8" cy="8" r="4"/><circle class="n" cx="8" cy="8" r="6.5" opacity=".45"/>`,
};

const DRAWING =
  'viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"';

// In a page, beside the title that says the same thing: hidden from screen readers.
// A group without an icon gets nothing.
// With a glint, a copy of the drawing lies over it, seen only through a band of a mask that
// the page sweeps across the icon (.glint-band): the glint lights the strokes and nothing else,
// and the copy plays the motion of the icon too, since its parts have the same classes.
export function navIcon(id: string, className = "toc-icon", glint = false): string {
  const body = NAV_ICONS[id];
  if (!body) return "";
  const mask = `nav-glint-${id}`;
  const over = glint
    ? `<defs><linearGradient id="${mask}-band" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset=".4" stop-color="#000"/><stop offset=".47" stop-color="#fff"/><stop offset=".53" stop-color="#fff"/><stop offset=".6" stop-color="#000"/></linearGradient>` +
      `<mask id="${mask}" maskUnits="userSpaceOnUse" x="-2" y="-2" width="20" height="20">` +
      `<rect class="glint-band" x="-2" y="-2" width="20" height="20" fill="url(#${mask}-band)"/></mask></defs>` +
      `<g class="glint" mask="url(#${mask})">${body}</g>`
    : "";
  return `<svg class="${className}" data-icon="${id}" ${DRAWING} aria-hidden="true" focusable="false">${body}${over}</svg>`;
}

// The icon as a file of its own
export function navIconFile(id: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${DRAWING}>${NAV_ICONS[id]}</svg>\n`;
}

// What each icon does when the pointer comes over it, played once: a part of the icon (by its
// class; none is the whole icon) and its keyframes. A part that turns or grows says around what,
// in the units of the drawing (16 × 16) or around itself.
export type IconMotion = { part?: string; frames: string; ms: number; delay?: number; ease?: string; style?: string };
const AT = (x: number, y: number) => `transform-origin: ${x}px ${y}px;`;
const OWN = "transform-box: fill-box; transform-origin: center;";
const DRAW = "from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; }";

export const NAV_ICON_MOTION: Record<string, IconMotion[]> = {
  // The triangle pushes forward, like a play button pressed
  "getting-started": [{ part: ".m", frames: "40% { transform: translateX(1.75px); } 70% { transform: translateX(-0.5px); }", ms: 450 }],
  // The arrow drops into the tray, which gives a little
  installation: [
    { part: ".m", frames: "45% { transform: translateY(2.25px); } 75% { transform: translateY(-0.5px); }", ms: 500 },
    { part: ".n", frames: "45%, 55% { transform: translateY(0.75px); }", ms: 500 },
  ],
  // The @ wobbles
  "at-rules": [{ frames: "25% { transform: rotate(-18deg); } 55% { transform: rotate(10deg); } 80% { transform: rotate(-4deg); }", ms: 600 }],
  // The sight closes on its target
  selectors: [
    { part: ".m", frames: "45% { transform: scale(0.75); } 75% { transform: scale(1.06); }", ms: 500, style: AT(8, 8) },
    { part: ".n", frames: "45% { transform: scale(1.6); }", ms: 500, style: AT(8, 8) },
  ],
  // The bracket draws from one child to the other, then the chosen one fills
  combinators: [
    { part: ".m", frames: DRAW, ms: 450, ease: "ease-out" },
    { part: ".n", frames: "from { opacity: 0; } to { opacity: 1; }", ms: 250, delay: 350 },
  ],
  // The cursor clicks, the rays flash
  "pseudo-classes": [
    { part: ".m", frames: "35% { transform: scale(0.82); }", ms: 400, style: AT(6.25, 4.75) },
    { part: ".n", frames: "0%, 30% { opacity: 0; transform: scale(0.4); } 100% { opacity: 1; transform: none; }", ms: 500, style: AT(6.25, 4.75) },
  ],
  // The branch grows from the trunk, and its end lights up
  "variables-conditions": [
    { part: ".m", frames: DRAW, ms: 400, ease: "ease-out" },
    { part: ".n", frames: "from { transform: scale(0); } 70% { transform: scale(1.3); } to { transform: none; }", ms: 300, delay: 350, style: AT(12, 3.5) },
  ],
  // The plus and the times turn a quarter, each its way
  values: [
    { part: ".m", frames: "to { transform: rotate(90deg); }", ms: 450, style: AT(4.5, 4.5) },
    { part: ".n", frames: "to { transform: rotate(-90deg); }", ms: 450, style: AT(4.5, 11.5) },
  ],
  // The cube hops
  shapes: [{ frames: "35% { transform: translateY(-2.5px) rotate(-6deg); } 70% { transform: none; } 85% { transform: translateY(-0.5px); }", ms: 550 }],
  // The square grows from its corner, inside its measures
  "object-properties": [{ part: ".m", frames: "45% { transform: scale(1.12); } 75% { transform: scale(0.97); }", ms: 500, style: "transform-box: fill-box; transform-origin: 0% 100%;" }],
  // The two circles pull apart and meet again
  combinations: [
    { part: ".m", frames: "50% { transform: translateX(-1.5px); }", ms: 550 },
    { part: ".n", frames: "50% { transform: translateX(1.5px); }", ms: 550 },
    { part: ".o", frames: "50% { opacity: 0; }", ms: 550 },
  ],
  // The drop falls and splashes
  colors: [{ frames: "30% { transform: translateY(-1.5px) scale(0.92, 1.1); } 60% { transform: scale(1.12, 0.86); } 80% { transform: scale(0.97, 1.04); }", ms: 600, style: "transform-origin: 50% 90%;" }],
  // The wheel turns once
  "color-functions": [{ frames: "to { transform: rotate(360deg); }", ms: 700 }],
  // The grain flickers, dot by dot
  gradients: [
    { part: "circle:nth-of-type(3n+1)", frames: "50% { opacity: 0.15; }", ms: 400 },
    { part: "circle:nth-of-type(3n+2)", frames: "50% { opacity: 0.15; }", ms: 400, delay: 120 },
    { part: "circle:nth-of-type(3n)", frames: "50% { opacity: 0.15; }", ms: 400, delay: 240 },
  ],
  // The glint slides on the sphere
  materials: [
    { part: ".m", frames: "50% { transform: translate(1.75px, 1.25px); }", ms: 600 },
    { part: ".n", frames: "50% { opacity: 0.3; }", ms: 600 },
  ],
  // The tile flips over
  textures: [{ frames: "to { transform: rotateY(180deg); }", ms: 500 }],
  // The letter is stamped on the face
  text: [{ part: ".m", frames: "40% { transform: scale(0.65); } 70% { transform: scale(1.12); }", ms: 450, style: AT(8, 8) }],
  // The filled half swings to the other side and back
  filters: [{ part: ".m", frames: "50% { transform: scaleX(-1); }", ms: 650, style: AT(8, 8) }],
  // The mask fades while its hole opens
  masks: [
    { part: ".m", frames: "50% { opacity: 0; }", ms: 600 },
    { part: ".n", frames: "50% { transform: scale(1.2); }", ms: 600, style: AT(8, 8) },
  ],
  // The square turns a quarter more, its ghost shows where it was
  transforms: [
    { part: ".m", frames: "from { transform: rotate(15deg); } to { transform: rotate(105deg); }", ms: 600, style: AT(9.75, 6.25) },
    { part: ".n", frames: "50% { opacity: 1; }", ms: 600 },
  ],
  // The first keyframe beats, the progress runs, the last keyframe beats
  animations: [
    { part: ".o", frames: "40% { transform: scale(1.35); }", ms: 300, style: OWN },
    { part: ".m", frames: DRAW, ms: 450, ease: "linear" },
    { part: ".n", frames: "60% { transform: scale(1.35); }", ms: 300, delay: 400, style: OWN },
  ],
  // A dot rides the curve, with the easing it draws
  easings: [{
    part: ".m",
    frames: "from { offset-distance: 0%; opacity: 1; } 85% { offset-distance: 100%; opacity: 1; } to { offset-distance: 100%; opacity: 0; }",
    ms: 800,
    ease: "cubic-bezier(0.42, 0, 0.58, 1)",
    style: "offset-path: path('M1.75 12.75C7.25 12.75 8.75 3.25 14.25 3.25'); offset-rotate: 0deg;",
  }],
  // The shutter closes and opens
  camera: [
    { part: ".m", frames: "40% { transform: scale(0.5); } 75% { transform: scale(1.1); }", ms: 450, style: OWN },
    { part: ".n", frames: "40% { transform: translateY(0.5px); }", ms: 450 },
  ],
  // The sun sinks and rises again, the fog drifts
  "scene-properties": [
    { part: ".m", frames: "30% { transform: translateY(1.75px); opacity: 0.5; }", ms: 800 },
    { part: ".n", frames: "50% { transform: translateX(-1.5px); }", ms: 800 },
    { part: ".o", frames: "50% { transform: translateX(1.5px); }", ms: 800 },
  ],
  // The isolines spread from the dot, like the field around it
  rendering: [
    { part: ".o", frames: "40% { transform: scale(1.5); }", ms: 400, style: AT(8, 8) },
    { part: ".m", frames: "from { transform: scale(0.4); opacity: 0; }", ms: 500, style: AT(8, 8) },
    { part: ".n", frames: "from { transform: scale(0.6); opacity: 0; }", ms: 500, delay: 120, style: AT(8, 8) },
  ],
};

// The CSS of the motions, played when the pointer is over `on` (the summary of a group in the
// docs, a tile of the brand page). Nothing moves for people who ask for less motion.
export function navIconMotion(on: string): string {
  const rules = Object.entries(NAV_ICON_MOTION).flatMap(([id, parts]) =>
    parts.map((part, i) => {
      const name = `nav-${id}-${i}`;
      const target = `${on} [data-icon="${id}"]${part.part ? ` ${part.part}` : ""}`;
      const timing = `${part.ms}ms ${part.ease ?? "ease-in-out"} ${part.delay ?? 0}ms both`;
      return `@keyframes ${name} { ${part.frames} }\n${target} { animation: ${name} ${timing};${part.style ? ` ${part.style}` : ""} }`;
    }),
  );
  return `@media (prefers-reduced-motion: no-preference) {\n[data-icon] { overflow: visible; }\n${rules.join("\n")}\n}`;
}
