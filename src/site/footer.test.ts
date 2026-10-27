import { describe, it, expect } from "vitest";

// The footer of every page of the site links what a visitor looks for at the bottom of a page
const pages = import.meta.glob<string>("../../{index,docs,showcase,brand,changelog,privacy}.html", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the footer of every page", () => {
  it("has the six pages of the site", () => {
    expect(Object.keys(pages)).toHaveLength(6);
  });

  for (const [path, html] of Object.entries(pages)) {
    const footer = html.slice(html.lastIndexOf("<footer"));
    it(`links about, contact and privacy (${path.replace("../../", "")})`, () => {
      expect(footer).toContain('docs.html#why-gss">about</a>');
      // The docs answer their hash with a page of the reference: there, contact opens the issues
      const contact = path.includes("docs") ? "https://github.com/LukyVj/GSS/issues" : "#contact";
      expect(footer).toContain(`<a href="${contact}">contact</a>`);
      expect(footer).toContain('<a href="./privacy.html">privacy</a>');
      expect(footer).toMatch(/class="contact" id="contact"/);
    });
  }
});
