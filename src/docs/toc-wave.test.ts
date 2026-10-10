// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { currentPart, followParts, waveAt, REST, PITCH } from "./toc-wave";

// "On this page" follows the reader (decision 184): the part being read is the current one,
// and lines in front of the links grow toward it, like a sound wave.
describe("the part being read", () => {
  // where the top of each part is, from the top of the window
  it("is the last part whose top has passed the reading line", () => {
    expect(currentPart([-400, 80, 600], 240)).toBe(1);
    expect(currentPart([-400, -80, 200], 240)).toBe(2);
  });

  it("is none before the first part is reached", () => {
    expect(currentPart([300, 700], 240)).toBe(-1);
    expect(currentPart([], 240)).toBe(-1);
  });
});

describe("the wave", () => {
  const ys = Array.from({ length: 21 }, (_, k) => k * PITCH);

  it("rests short and even when no part is being read", () => {
    expect(waveAt(ys, [])).toEqual(ys.map(() => REST));
  });

  it("peaks where the current part is, and falls on both sides of it", () => {
    const wave = waveAt(ys, [{ y: 60, height: 1 }]);
    expect(wave[10]).toBe(1);
    for (let k = 10; k + 1 < wave.length; k++) expect(wave[k + 1]).toBeLessThan(wave[k]);
    for (let k = 10; k > 0; k--) expect(wave[k - 1]).toBeLessThan(wave[k]);
    // the same on both sides, and back to rest far from the peak
    expect(wave[7]).toBeCloseTo(wave[13]);
    expect(wave[0]).toBeCloseTo(REST, 1);
  });

  // Lucas: "au hover d'un autre lien, un deuxième peak apparaît"
  it("grows a second peak, lower, where a link is hovered, and keeps the first", () => {
    const wave = waveAt(ys, [
      { y: 24, height: 1 },
      { y: 96, height: 0.7 },
    ]);
    expect(wave[4]).toBe(1);
    expect(wave[16]).toBeCloseTo(REST + (1 - REST) * 0.7);
    // a valley between the two
    expect(wave[10]).toBeLessThan(wave[16]);
    expect(wave[10]).toBeLessThan(wave[4]);
  });

  it("never goes over a full line where two peaks meet", () => {
    for (const length of waveAt(ys, [{ y: 60, height: 1 }, { y: 66, height: 1 }])) expect(length).toBeLessThanOrEqual(1);
  });
});

describe("the menu", () => {
  // A list of three links, each row 24px high, and the three parts they lead to
  function menu(tops: number[]) {
    const holder = document.createElement("div");
    const list = document.createElement("ul");
    const targets = tops.map((_, i) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#part-${i}`;
      item.append(link);
      list.append(item);
      Object.defineProperty(item, "offsetTop", { value: i * 24 });
      Object.defineProperty(item, "offsetHeight", { value: 24 });
      const target = document.createElement("div");
      target.id = `part-${i}`;
      target.getBoundingClientRect = () => ({ top: tops[i] }) as DOMRect;
      return target;
    });
    Object.defineProperty(list, "offsetHeight", { value: tops.length * 24 });
    holder.append(list);
    return { holder, list, targets, links: [...list.querySelectorAll("a")] };
  }
  const lengths = (holder: HTMLElement) => [...holder.querySelectorAll<HTMLElement>(".wave i")].map((line) => +line.style.getPropertyValue("--now"));
  const hovered = (holder: HTMLElement) => [...holder.querySelectorAll<HTMLElement>(".wave i")].map((line) => +line.style.getPropertyValue("--hover"));

  it("draws its lines in front of the links, hidden from a screen reader, one every few pixels down the list", () => {
    const { holder, list, targets } = menu([100, 900, 1700]);
    followParts(list, targets, { line: () => 240 });
    const wave = holder.querySelector(".wave")!;
    expect(wave.getAttribute("aria-hidden")).toBe("true");
    expect(wave.nextElementSibling).toBe(list);
    expect(wave.querySelectorAll("i").length).toBe((3 * 24) / PITCH + 1);
  });

  it("marks the link of the part being read, and puts the peak in front of it", () => {
    const { holder, list, targets, links } = menu([-900, 100, 900]);
    followParts(list, targets, { line: () => 240 });
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, "location", null]);
    const wave = lengths(holder);
    expect(wave.indexOf(Math.max(...wave))).toBe((24 + 12) / PITCH); // the middle of the second row
    expect(Math.max(...wave)).toBe(1);
  });

  it("follows the reader: read again after a scroll, the peak moves to the next part", () => {
    const tops = [-100, 500, 1300];
    const { holder, list, targets, links } = menu(tops);
    const follow = followParts(list, targets, { line: () => 240 });
    expect(links[0].getAttribute("aria-current")).toBe("location");
    tops[0] = -700;
    tops[1] = -100;
    tops[2] = 700;
    follow.read();
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, "location", null]);
    expect(lengths(holder).indexOf(1)).toBe((24 + 12) / PITCH);
  });

  it("grows a second peak in front of a link under the pointer, and lets it go when the pointer leaves", () => {
    const { holder, list, targets, links } = menu([-100, 500, 1300]);
    followParts(list, targets, { line: () => 240 });
    expect(Math.max(...hovered(holder))).toBe(0);
    links[2].dispatchEvent(new Event("pointerenter"));
    const second = hovered(holder);
    expect(second.indexOf(Math.max(...second))).toBe((48 + 12) / PITCH);
    expect(lengths(holder).indexOf(1)).toBe(12 / PITCH); // the first peak stays
    links[2].dispatchEvent(new Event("pointerleave"));
    expect(Math.max(...hovered(holder))).toBe(0);
  });

  it("does the same for a link reached with the keyboard", () => {
    const { holder, list, targets, links } = menu([-100, 500, 1300]);
    followParts(list, targets, { line: () => 240 });
    links[1].dispatchEvent(new Event("focus"));
    expect(hovered(holder).indexOf(Math.max(...hovered(holder)))).toBe((24 + 12) / PITCH);
    links[1].dispatchEvent(new Event("blur"));
    expect(Math.max(...hovered(holder))).toBe(0);
  });

  // A part too near the end of the page never reaches the reading line: its link was
  // followed, so it is the one being read until the reader scrolls
  it("holds the part a link was followed to, until the reader scrolls away", () => {
    const { list, targets, links } = menu([-100, 300, 500]);
    let scrolled = 0;
    const follow = followParts(list, targets, { line: () => 240, scrolled: () => scrolled });
    follow.hold("part-2");
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, null, "location"]);
    follow.read();
    expect(links[2].getAttribute("aria-current")).toBe("location");
    scrolled = 40;
    follow.read();
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual(["location", null, null]);
  });

  it("draws its lines once: following the same list again does not add a second wave", () => {
    const { holder, list, targets } = menu([-100, 500]);
    followParts(list, targets, { line: () => 240 });
    followParts(list, targets, { line: () => 240 });
    expect(holder.querySelectorAll(".wave").length).toBe(1);
  });
});
