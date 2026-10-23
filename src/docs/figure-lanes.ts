import { cells, path, says, stage, text } from "./figure-kit";
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

// animation-range and its two halves. The way of view() has three parts: the scene comes into
// the page, is all in it, goes out of it. Each part is drawn as the page with the scene at
// that part; the ones the animation plays on are in signal, over the range, and the end of
// the range the property sets is named in signal.
const PARTS = ["entry", "contain", "exit"] as const;
const RANGES: Record<string, { code: string; from: number; to: number; sets: ("start" | "end")[] }> = {
  "animation-range": { code: "animation-range: entry;", from: 0, to: 1, sets: ["start", "end"] },
  "animation-range-start": { code: "animation-range-start: contain;", from: 1, to: 3, sets: ["start"] },
  "animation-range-end": { code: "animation-range-end: contain;", from: 0, to: 2, sets: ["end"] },
};

export function range(subject: string): string {
  const { code, from, to, sets } = RANGES[subject];
  const frame: Frame = { width: 380, height: 212, scale: 1, x: 0, y: 0 };
  const [left, width, top, page, scene] = [25, 110, 64, { width: 74, height: 56 }, { width: 44, height: 26 }];
  const edge = (n: number) => left + n * width;
  // Where the top of the scene is, from the top of the page: in the middle of each part, and
  // how far it goes each way from there
  const middles = [page.height - scene.height / 2, (page.height - scene.height) / 2, -scene.height / 2];
  const sways = [scene.height / 2, (page.height - scene.height) / 2, scene.height / 2];
  const parts = PARTS.map((name, n) => {
    const played = n >= from && n < to;
    const x = edge(n) + (width - page.width) / 2;
    const inset = (page.width - scene.width) / 2;
    const moving = (content: string) => `<g class="sways" style="--sway: ${sways[n]}px">${content}</g>`;
    const box = (kind: string, ox: number, oy: number) => `<rect class="${kind}" x="${ox + inset}" y="${oy + middles[n]}" width="${scene.width}" height="${scene.height}"/>`;
    return (
      text(edge(n) + width / 2, top - 46, name, `lane-label middle${played ? " lit" : ""}`) +
      // the scene where the page does not show it, then the part the page shows, cut at its edges
      moving(box("ghost", x, top)) +
      `<rect class="edge" x="${x}" y="${top}" width="${page.width}" height="${page.height}"/>` +
      `<svg class="window" aria-hidden="true" x="${x}" y="${top}" width="${page.width}" height="${page.height}">${moving(box(played ? "tint" : "guide", 0, 0))}</svg>`
    );
  }).join("");
  // The way, with the range on it and its two ends
  const y = top + page.height + 36;
  const end = (name: "start" | "end", x: number) =>
    sets.includes(name)
      ? `<circle class="dot" cx="${x}" cy="${y}" r="4.5"/>` + text(x, y + 20, name, "axis-label lit")
      : `<circle class="guide hollow" cx="${x}" cy="${y}" r="3.5"/>` + text(x, y + 20, name, "lane-label middle");
  const way =
    path("guide", `M${edge(0)} ${y}H${edge(3)}`) +
    path("ground", [0, 1, 2, 3].map((n) => `M${edge(n)} ${y - 5}v10`).join("")) +
    path("tint thick", `M${edge(from)} ${y}H${edge(to)}`) +
    end("start", edge(from)) +
    end("end", edge(to));
  return stage(frame, parts + way) + says(code);
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

// offset-rotate: the object turns the way the line goes, or keeps the angle it is given. Each
// on its own path: the object at five places of it, and once more, moving.
export function offsetRotate(): string {
  const frame: Frame = { width: 190, height: 132, scale: 1, x: 0, y: 0 };
  const line = "M22 92C52 4 82 4 96 64S140 124 168 38";
  const arrow = "M-9 -7L9 0L-9 7Z";
  const along = (fixed: boolean) => {
    const turn = fixed ? " fixed" : "";
    const places = [0, 25, 50, 75, 100].map((at) => `<g class="placed${turn}" style="offset-path: path('${line}'); offset-distance: ${at}%">${path("guide", arrow)}</g>`).join("");
    return path("ghost", line) + places + `<g class="travels${turn}" style="offset-path: path('${line}')">${path("tint", arrow)}</g>`;
  };
  return cells("figure-steps", [["offset-rotate: auto;", along(false)], ["offset-rotate: 0deg;", along(true)]], frame);
}
