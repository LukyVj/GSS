import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { recordExtractor, type DocSearchRecord } from "./crawler";
import { prerenderDocsHtml } from "./prerender";

// The page the crawler reads: the docs as built, without their script
const page = prerenderDocsHtml(readFileSync(new URL("../../docs.html", import.meta.url), "utf8"));
const url = new URL("https://www.gss-lang.dev/docs");
const extract = () => recordExtractor({ $: load(page), url });
const records = extract();
const byAnchor = (anchor: string) => records.find((record) => record.anchor === anchor);

describe("the records of the docs search", () => {
  // The crawler drops a page that gives more than 750 records, and the reference is one page
  it("stay far under the 750 records the crawler takes from one page", () => {
    expect(records.length).toBeGreaterThan(300);
    expect(records.length).toBeLessThanOrEqual(600);
  });

  it("each weigh less than 10 KB, the most a record can weigh", () => {
    const heavy = records.filter((record) => JSON.stringify(record).length > 10_000);
    expect(heavy.map((record) => record.anchor)).toEqual([]);
  });

  it("give each page of the docs one record, under the title of its group", () => {
    const $ = load(page);
    const pages = $("#docs > section > article")
      .map((_, article) => ({
        id: $(article).attr("id"),
        group: $(article).parent().children("h2").text().trim(),
        title: $(article).children("h3").text().replace(/\s+/g, " ").trim(),
      }))
      .get();
    expect(pages.length).toBeGreaterThan(100);
    for (const { id, group, title } of pages) {
      expect(byAnchor(id!), id).toMatchObject({ type: "lvl1", hierarchy: { lvl0: group, lvl1: title, lvl2: null } });
    }
    expect(byAnchor("light")!.hierarchy.lvl1).toBe("light (sun)");
  });

  it("land on an anchor of the page, once each", () => {
    const $ = load(page);
    const anchors = $("[id]").map((_, element) => $(element).attr("id")).get();
    const count = (id: string) => anchors.filter((other) => other === id).length;
    for (const record of records) {
      expect(count(record.anchor), record.anchor).toBe(1);
      expect(record.url).toBe(`https://www.gss-lang.dev/docs#${record.anchor}`);
      expect(record.url_without_anchor).toBe("https://www.gss-lang.dev/docs");
    }
    const ids = records.map((record) => record.objectID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keep the lead of a page with the page", () => {
    expect(byAnchor("material")!.content).toMatch(/^Sets how the surface of the object reacts to light\./);
  });

  it("give each named example its own record: its name, then its sentence", () => {
    const metal = records.find((record) => record.hierarchy.lvl1 === "material" && record.hierarchy.lvl2 === "metal()");
    expect(metal).toMatchObject({ type: "lvl2", anchor: "material--example-2" });
    expect(metal!.content).toContain("gold, chrome, and a rougher metal(0.7)");
  });

  it("put the values of a page in one record, shown by the words found", () => {
    expect(byAnchor("material--values")).toMatchObject({ type: "content", hierarchy: { lvl2: "Values" } });
    expect(byAnchor("material--values")!.content).toContain("matte() Scatters the light only, like chalk");
  });

  it("read what a page folds, without the label of the fold", () => {
    expect(byAnchor("opacity")!.content).toContain("a sphere at 50% looks like a bubble");
    expect(records.map((record) => record.content).join(" ")).not.toContain("More details");
  });

  it("do not read the figures: a drawing, and the code it plays", () => {
    expect(byAnchor("selector-type")!.content).not.toContain("torus");
    expect(byAnchor("translate")!.content).not.toContain("translate: 1.5 0 0");
  });

  it("give each chapter of a guide its own record", () => {
    expect(byAnchor("embedding--from-a-script")).toMatchObject({
      type: "lvl2",
      hierarchy: { lvl1: "Embedding a scene", lvl2: "From a script" },
    });
    expect(byAnchor("embedding--from-a-script")!.content).toContain("fires load");
  });

  it("read no code, no script and nothing outside the pages", () => {
    const text = records.map((record) => `${record.content} ${Object.values(record.hierarchy).join(" ")}`).join(" ");
    expect(text).not.toContain("radius: 0.6; material: gold;"); // the code of an example
    expect(text).not.toContain("initial-value: 1"); // the scene of the live demo
    expect(text).not.toContain("Initial value");
    const groups = new Set(load(page)("#docs > section > h2").map((_, h2) => load(h2).text().trim()).get());
    expect(records.every((record) => groups.has(record.hierarchy.lvl0!))).toBe(true);
  });

  it("are read the same once the page script has run", () => {
    const $ = load(page);
    $("#docs > section > article").first().prepend('<div class="page-bar">Start here / Why GSS</div>').append('<nav class="pager">next →</nav>');
    expect(recordExtractor({ $, url })).toEqual(records);
  });
});

// The crawler runs the extractor alone, pasted in its editor: the script prints it as JavaScript
describe("the extractor to paste into the crawler", () => {
  it("runs alone and gives the same records", () => {
    const script = fileURLToPath(new URL("../../scripts/docsearch-extractor.mjs", import.meta.url));
    const source = execFileSync(process.execPath, [script], { encoding: "utf8" });
    expect(source).toMatch(/^\(\{ \$, url \}\) => \{/);
    const pasted = new Function(`return (${source})`)() as typeof recordExtractor;
    expect(pasted({ $: load(page), url }) as DocSearchRecord[]).toEqual(extract());
  });

  // The editor of the crawler parses ES2019: `??` and `?.` are a parsing error there
  it("has no syntax newer than ES2019", () => {
    const script = fileURLToPath(new URL("../../scripts/docsearch-extractor.mjs", import.meta.url));
    const source = execFileSync(process.execPath, [script], { encoding: "utf8" });
    expect(source).not.toMatch(/\?\?|\?\./);
  });
});
