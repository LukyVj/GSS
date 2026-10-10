// The records of the docs search, read by the Algolia Crawler from the built /docs page.
// The crawler drops a page that gives more than 750 records, and the whole reference is one
// page: one record per page of the docs, and one per part of it (a titled example, the values,
// a chapter of a guide), keeps it far under, and lands each result on its part.
// - A page: its title, and its lead in `content`, what comes before its first part.
// - A titled example: its name, and its sentence in `content`.
// - The values: one record whose `content` is the table and the paragraph under it, so the
//   search shows the words it found; a chapter of a guide: its title, and its text.
// The crawler runs this function alone, pasted in its editor (`npm run docsearch:extractor`
// prints it as JavaScript): nothing from outside it, only the API of cheerio.
import type { CheerioAPI } from "cheerio";

type Level = "lvl0" | "lvl1" | "lvl2" | "lvl3" | "lvl4" | "lvl5" | "lvl6";

// The shape of a DocSearch record, the one the search box reads
export type DocSearchRecord = {
  objectID: string;
  url: string;
  url_without_anchor: string;
  anchor: string;
  type: "lvl1" | "lvl2" | "content";
  hierarchy: Record<Level, string | null>;
  content: string | null;
  weight: { pageRank: number; level: number; position: number };
};

export const recordExtractor = ({ $, url }: { $: CheerioAPI; url: URL }): DocSearchRecord[] => {
  const page = url.origin + url.pathname;
  const records: DocSearchRecord[] = [];
  const text = (selection: ReturnType<CheerioAPI>) => selection.text().replace(/\s+/g, " ").trim();

  // What is not read: code, the live demo, the table of an entry (syntax, initial value…),
  // and what the page script adds (breadcrumb, previous / next)
  $("#docs pre, #docs script, #docs button, #docs .variables-demo, #docs article > dl:not(.values)").remove();
  $("#docs .page-bar, #docs .pager").remove();
  // What a page folds is read, not the label of the fold
  $("#docs details.more > summary").remove();
  // The cells of a table, read apart: "matte() Scatters the light only"
  $("#docs dt, #docs dd, #docs li").append(" ");

  $("#docs > section").each((_, section) => {
    const group = text($(section).children("h2"));
    $(section)
      .children("article")
      .each((_, article) => {
        const title = text($(article).children("h3"));
        // The page, then its parts, in the order of the page; each one holds the text after it
        let part = { anchor: $(article).attr("id") ?? "", type: "lvl1" as DocSearchRecord["type"], name: null as string | null, texts: [] as string[] };
        const parts = [part];
        $(article)
          .children()
          .each((_, child) => {
            const $child = $(child);
            if ($child.is("h3")) return;
            const name = $child.is(".example-part") ? text($child.children(".example-name")) : $child.is("h4") ? text($child) : "";
            if (name && $child.attr("id")) {
              // The values are found by their words, a chapter or an example by its title
              const values = $child.is("h4") && $child.next().is("dl.values");
              part = { anchor: $child.attr("id")!, type: values ? "content" : "lvl2", name, texts: [] };
              parts.push(part);
              if ($child.is(".example-part")) part.texts.push(text($child.children(".example-text")));
              return;
            }
            if ($child.is(".example-part")) return; // an example without a name: only its code
            part.texts.push(text($child));
          });

        for (const { anchor, type, name, texts } of parts) {
          records.push({
            objectID: anchor,
            url: `${page}#${anchor}`,
            url_without_anchor: page,
            anchor,
            type,
            hierarchy: { lvl0: group, lvl1: title, lvl2: name, lvl3: null, lvl4: null, lvl5: null, lvl6: null },
            content: texts.filter(Boolean).join(" ") || null,
            weight: { pageRank: 0, level: type === "lvl1" ? 90 : type === "lvl2" ? 80 : 0, position: records.length },
          });
        }
      });
  });
  return records;
};
