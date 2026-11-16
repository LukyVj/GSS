import { describe, it, expect } from "vitest";

// The footer of every page of the site links what a visitor looks for at the bottom of a page
const pages = import.meta.glob<string>("../../{index,docs,showcase,brand,changelog,privacy,about,contact}.html", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the footer of every page", () => {
  it("has the eight pages of the site", () => {
    expect(Object.keys(pages)).toHaveLength(8);
  });

  for (const [path, html] of Object.entries(pages)) {
    const footer = html.slice(html.lastIndexOf("<footer"));
    it(`links about, contact and privacy (${path.replace("../../", "")})`, () => {
      expect(footer).toContain('<a href="./about.html">about</a>');
      expect(footer).toContain('<a href="./contact.html">contact</a>');
      expect(footer).toContain('<a href="./privacy.html">privacy</a>');
    });
  }
});

// Agents check these pages before they trust a site: each says enough to be read alone
describe("the pages about, contact and privacy", () => {
  for (const page of ["about", "contact", "privacy"]) {
    it(`have at least 500 characters of text (${page})`, () => {
      const html = pages[`../../${page}.html`] ?? "";
      const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
      const text = main.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      expect(text.length).toBeGreaterThan(500);
      expect(html).toContain(`<link rel="canonical" href="https://www.gss-lang.dev/${page}" />`);
    });
  }
});
