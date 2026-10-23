// "On this page" follows the reader (decision 184). The link of the part being read is the
// current one, and thin lines in front of the links grow toward it, like a sound wave with
// its peak there. A link under the pointer grows a second peak, lower.

export const PITCH = 6; // a line every 6px down the list
export const REST = 0.18; // the length of a line far from any peak, of a full one
const SPREAD = 14; // how wide a peak is, in px: it reaches a row above and a row below
const HOVERED = 0.7; // the height of the peak of a link under the pointer, of the current one
const ROW = 24; // the height of a line of text of the list

// The part being read: the last one whose top has passed the reading line. -1 before the first.
export function currentPart(tops: number[], line: number): number {
  let current = -1;
  tops.forEach((top, i) => {
    if (top <= line) current = i;
  });
  return current;
}

export type Peak = { y: number; height: number };

// How long each line is, from REST to 1, for lines at these heights: the highest of the peaks
// around it, each a bell
export function waveAt(ys: number[], peaks: Peak[]): number[] {
  return ys.map((y) => {
    const reach = Math.max(0, ...peaks.map((peak) => peak.height * Math.exp(-((y - peak.y) ** 2) / (2 * SPREAD ** 2))));
    return reach + REST * (1 - reach);
  });
}

export type Follow = {
  read(): void; // look again where the reader is: after a scroll, a resize
  hold(id: string): void; // a link was followed to this part: it is the one being read
};

type Options = {
  line?: () => number; // where the reading line is, from the top of the window
  scrolled?: () => number; // how far the page is scrolled
};

// Draws the wave in front of a list of links, and keeps it on the part being read. The
// targets are the parts the links lead to, in the order of the list.
export function followParts(list: HTMLElement, targets: HTMLElement[], options: Options = {}): Follow {
  const line = options.line ?? (() => window.innerHeight * 0.35);
  const scrolled = options.scrolled ?? (() => window.scrollY);
  const links = [...list.querySelectorAll<HTMLAnchorElement>("a")];

  // The lines: an element of no height right over the list, so a line placed at y stands at
  // y in the list
  let wave = list.previousElementSibling as HTMLElement | null;
  if (!wave?.classList.contains("wave")) {
    wave = document.createElement("div");
    wave.className = "wave";
    wave.setAttribute("aria-hidden", "true");
    list.before(wave);
  }
  wave.style.setProperty("--rest", String(REST));
  let lines: HTMLElement[] = [];
  let ys: number[] = [];

  // The middle of the first line of text of a row, from the top of the list: a long label
  // takes two lines
  const middle = (i: number) => {
    const item = links[i]?.closest("li");
    return item ? item.offsetTop - list.offsetTop + Math.min(item.offsetHeight || ROW, ROW) / 2 : 0;
  };
  const set = (name: string, lengths: number[]) => lines.forEach((tick, k) => tick.style.setProperty(name, String(+lengths[k].toFixed(3))));

  let current = -1;
  let hovered = -1;
  let held: { index: number; at: number } | null = null;

  function read(): void {
    if (held && Math.abs(scrolled() - held.at) >= 2) held = null;
    current = held ? held.index : currentPart(targets.map((target) => target.getBoundingClientRect().top), line());
    links.forEach((link, i) => (i === current ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current")));
    set("--now", waveAt(ys, current < 0 ? [] : [{ y: middle(current), height: 1 }]));
  }
  function hover(i: number): void {
    hovered = i;
    // only what the pointer adds: 0 everywhere when it is on no link, or on the current one
    const peaks = hovered < 0 || hovered === current ? [] : [{ y: middle(hovered), height: HOVERED }];
    set("--hover", waveAt(ys, peaks).map((length) => (length - REST) / (1 - REST)));
  }
  // As many lines as the list is high: again when a font loads and a label wraps
  function draw(): void {
    const count = Math.max(0, Math.floor((list.offsetHeight || links.length * ROW) / PITCH)) + 1;
    if (count !== lines.length) {
      ys = Array.from({ length: count }, (_, k) => k * PITCH);
      lines = ys.map((y) => {
        const tick = document.createElement("i");
        tick.style.top = `${y}px`;
        return tick;
      });
      wave!.replaceChildren(...lines);
    }
    read();
    hover(hovered);
  }

  links.forEach((link, i) => {
    for (const enter of ["pointerenter", "focus"]) link.addEventListener(enter, () => hover(i));
    for (const leave of ["pointerleave", "blur"]) link.addEventListener(leave, () => hover(-1));
  });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(draw).observe(list);
  draw();

  return {
    read,
    hold(id) {
      const index = targets.findIndex((target) => target.id === id);
      held = index < 0 ? null : { index, at: scrolled() };
      read();
    },
  };
}
