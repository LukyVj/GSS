import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { prerenderBrandHtml, iconFileName } from "./prerender";
import { DOC_GROUPS } from "../docs/navigation";
import { navIconFile, navIconMotion } from "../docs/nav-icons";
import { FILMS, FILM_BASE } from "./films";

describe("prerenderBrandHtml", () => {
  const html = prerenderBrandHtml(readFileSync("brand.html", "utf8"));

  it("shows every icon of the docs sidebar, under its name", () => {
    expect(html.match(/<figure class="tile doc-icon"/g)).toHaveLength(DOC_GROUPS.length);
    for (const group of DOC_GROUPS) expect(html).toContain(`<span class="name">${group.title}</span>`);
  });

  it("offers each icon as a file to download, named after its group", () => {
    for (const group of DOC_GROUPS) {
      const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(navIconFile(group.id))}`;
      expect(html).toContain(`href="${href}" download="${iconFileName(group.title)}"`);
    }
    expect(iconFileName("Variables and conditions")).toBe("docs-variables-and-conditions.svg");
    expect(iconFileName("At-rules")).toBe("docs-at-rules.svg");
  });

  it("plays the motion of an icon when the pointer is over its tile", () => {
    expect(html).toContain(`<style>${navIconMotion(".doc-icon:hover")}</style>`);
  });

  // The films, served from the media bucket: each one to play in place, its poster, and its
  // two cuts to download
  it("shows every film, newest first, with its poster and its two cuts", () => {
    expect(FILMS.map((film) => film.file)).toEqual(["gss-0.0.7", "gss-0.0.6", "gss-launch", "gss-teaser"]);
    expect(FILM_BASE).toBe("https://media.gss-lang.dev/films/");
    expect(html.match(/<figure class="tile film"/g)).toHaveLength(FILMS.length);
    for (const { file } of FILMS) {
      expect(html).toContain(`poster="${FILM_BASE}${file}.jpg"`);
      expect(html).toContain(`<source src="${FILM_BASE}${file}.mp4" type="video/mp4" />`);
      expect(html).toContain(`href="${FILM_BASE}${file}-vertical.mp4"`);
    }
    expect(html).toContain('preload="none"');
  });

  it("needs the place of the icons in the page", () => {
    expect(() => prerenderBrandHtml("<main></main>")).toThrow(/doc-icons/);
  });
});
