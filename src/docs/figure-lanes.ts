import { between, path, says, stage, text } from "./figure-kit";
import type { Frame } from "./hairline";

// The longhands of animation as lanes: one point per lane, moved by the very value the lane
// is named after, so the lanes can be compared.

type Lane = { label: string; style?: string; kind?: string };

const LANES: Record<string, { code: string; lanes: Lane[]; own?: boolean }> = {
  "animation-duration": {
    code: "animation-duration: 2s;",
    lanes: [
      { label: "1s", style: "animation-duration: 1s" },
      { label: "2s", style: "animation-duration: 2s" },
      { label: "4s", style: "animation-duration: 4s" },
    ],
  },
  "animation-delay": {
    code: "animation-delay: 1s;",
    lanes: [
      { label: "0s" },
      { label: "1s", style: "animation-delay: 1s" },
      { label: "-1s", style: "animation-delay: -1s" },
    ],
  },
  "animation-iteration-count": {
    code: "animation-iteration-count: 2;",
    lanes: [
      { label: "1", kind: "once" },
      { label: "2", kind: "twice" },
      { label: "infinite", style: "animation-duration: 1.5s" },
    ],
  },
  "animation-direction": {
    code: "animation-direction: alternate;",
    lanes: [
      { label: "normal" },
      { label: "reverse", style: "animation-direction: reverse" },
      { label: "alternate", style: "animation-direction: alternate" },
      { label: "alternate-reverse", style: "animation-direction: alternate-reverse" },
    ],
  },
  // The object has a place of its own, left of the animation: where is it before and after?
  "animation-fill-mode": {
    code: "animation-fill-mode: both;",
    own: true,
    lanes: [
      { label: "none", kind: "fill-none" },
      { label: "forwards", kind: "fill-forwards" },
      { label: "backwards", kind: "fill-backwards" },
      { label: "both", kind: "fill-both" },
    ],
  },
};

export function lanes(subject: string): string {
  const { code, lanes: list, own } = LANES[subject];
  const [start, end, gap] = [150, 340, 34];
  const frame: Frame = { width: 380, height: 34 + list.length * gap, scale: 1, x: 0, y: 0 };
  const drawn = list
    .map(({ label, style, kind }, i) => {
      const y = 30 + i * gap;
      return (
        text(start - (own ? 62 : 16), y, label, "lane-label") +
        path("guide", `M${start} ${y}H${end}`) +
        path("mark", `M${start} ${y - 5}v10M${end} ${y - 5}v10`) +
        (own ? `<circle class="ghost" cx="${start - 44}" cy="${y}" r="5"/>` : "") +
        `<g class="lane ${kind ?? ""}" style="--run: ${end - start}px; --own: ${-44}px;${style ? ` ${style}` : ""}"><circle class="dot" cx="${start}" cy="${y}" r="5"/></g>`
      );
    })
    .join("");
  return stage(frame, drawn) + says(code);
}
export const LANE_PAGES = Object.keys(LANES);

// animation-timeline: the page scrolls, and the animation is where the scroll is
export function scrollTimeline(): string {
  const frame: Frame = { width: 380, height: 200, scale: 1, x: 0, y: 0 };
  // A window on a long page: the page slides up behind it, the thumb slides down
  const page =
    `<rect class="edge" x="60" y="30" width="110" height="140"/>` +
    // an SVG inside the SVG cuts the page at the edges of the window, without an id: every id
    // of the docs is an anchor
    `<svg class="window" aria-hidden="true" x="60" y="30" width="110" height="140"><g class="scrolls-y" style="--run: -70px">${path("guide", [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `M12 ${18 + i * 26}h${i % 3 === 0 ? 50 : 78}`).join(""))}</g></svg>` +
    path("ground", "M178 30V170") +
    `<g class="scrolls-y" style="--run: 92px">${path("tint", "M178 32v44")}</g>`;
  const [start, end, y] = [220, 340, 100];
  const timeline =
    path("guide", `M${start} ${y}H${end}`) +
    path("mark", `M${start} ${y - 5}v10M${end} ${y - 5}v10`) +
    text(start, y + 20, "0%") +
    text(end, y + 20, "100%") +
    `<g class="scrolls-x" style="--run: ${end - start}px"><circle class="dot" cx="${start}" cy="${y}" r="5"/></g>`;
  return stage(frame, page + timeline) + says("animation-timeline: scroll();");
}

// animation-range and its two halves: the scene crosses the window, and the animation plays
// on a part of the way
const RANGES: Record<string, { code: string; kind: string; from: number; to: number }> = {
  "animation-range": { code: "animation-range: entry;", kind: "range-entry", from: 0, to: 0.31 },
  "animation-range-start": { code: "animation-range-start: contain;", kind: "range-from-contain", from: 0.31, to: 1 },
  "animation-range-end": { code: "animation-range-end: contain;", kind: "range-to-contain", from: 0, to: 0.69 },
};

export function range(subject: string): string {
  const { code, kind, from, to } = RANGES[subject];
  const frame: Frame = { width: 380, height: 220, scale: 1, x: 0, y: 0 };
  // The window, and the scene that comes in at the bottom and leaves at the top
  const crossing =
    `<rect class="edge" x="60" y="65" width="120" height="90"/>` +
    text(120, 52, "the page", "lane-label middle") +
    `<g class="crosses"><rect class="tint" x="85" y="155" width="70" height="40"/>${text(120, 175, "scene", "axis-label lit")}</g>`;
  // The whole way of view(), with its three named parts, and the part the animation plays on
  const [x, top, height] = [250, 30, 160];
  const part = (name: string, a: number, b: number) =>
    path("ground", `M${x - 6} ${top + a * height}h12`) + text(x + 34, top + ((a + b) / 2) * height, name, "lane-label middle");
  const way =
    path("guide", `M${x} ${top}V${top + height}`) +
    part("entry", 0, 0.31) +
    part("contain", 0.31, 0.69) +
    part("exit", 0.69, 1) +
    path("ground", `M${x - 6} ${top + height}h12`) +
    path("tint", `M${x - 10} ${top + from * height}V${top + to * height}`) +
    `<g class="ranges ${kind}" style="--run: ${height}px"><circle class="dot" cx="${x}" cy="${top}" r="5"/></g>`;
  return stage(frame, crossing + way) + says(code);
}
export const RANGE_PAGES = Object.keys(RANGES);

// offset-distance: three places on one line
export function offsetDistance(): string {
  const frame: Frame = { width: 380, height: 200, scale: 1, x: 0, y: 0 };
  const line = "M44 150C110 20 200 220 336 60";
  const at = ["0%", "50%", "100%"].map(
    (distance, i) =>
      `<g class="placed" style="offset-path: path('${line}'); offset-distance: ${distance}; --i: ${i}">${path("tint", "M-9 -7L9 0L-9 7Z")}</g>` +
      // its name stays upright: the same place on the line, without the turn
      `<g class="placed fixed" style="offset-path: path('${line}'); offset-distance: ${distance}"><text class="axis-label lit" y="-18">${distance}</text></g>`,
  );
  return stage(frame, path("ghost", line) + at.join("")) + says("offset-distance: 50%;");
}

// offset-rotate: the object turns the way the line goes, or keeps the angle it is given
export function offsetRotate(): string {
  const frame: Frame = { width: 380, height: 200, scale: 1, x: 0, y: 0 };
  const line = "M44 150C110 20 200 220 336 60";
  const arrow = path("tint", "M-9 -7L9 0L-9 7Z");
  const drawing =
    path("ghost", line) +
    `<g class="travels" style="offset-path: path('${line}')">${arrow}</g>` +
    `<g class="travels fixed" style="offset-path: path('${line}')">${path("edge", "M-9 -7L9 0L-9 7Z")}</g>`;
  return stage(frame, drawing) + between("offset-rotate: auto;", "offset-rotate: 0deg;", "3.6s");
}
