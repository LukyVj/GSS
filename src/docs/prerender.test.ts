import { describe, it, expect } from "vitest";
import { prerenderDocsHtml } from "./prerender";

describe("prerenderDocsHtml", () => {
  it("fills #docs with the reference", () => {
    const html = prerenderDocsHtml('<main id="docs"></main>');
    expect(html).toContain('id="material"');
    expect(html).toContain('id="why-gss"');
    expect(html).toMatch(/<main id="docs">[\s\S]+<\/main>/);
  });

  it("refuses a shell that is already filled", () => {
    expect(() => prerenderDocsHtml('<main id="docs"><p>x</p></main>')).toThrow(
      /expected <main id="docs"><\/main>/,
    );
  });
});
