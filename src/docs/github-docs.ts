import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
import { renderDocs } from "./render";
import { articleToMarkdown } from "./to-markdown";
import { EMBED_SNIPPETS } from "../embed/snippets";

// The docs on GitHub: the reference of the site as Markdown, one page per section of its
// contents, and an index (docs/README.md, the page GitHub shows for the folder). A reader who
// lands on the repository can start there without opening the site.
// Built from the HTML of the site, so it needs a DOM: its test writes the files
// (`npm run docs:github`) and fails when they are out of date.

const SITE = "https://www.gss-lang.dev";
const DOCS_URL = `${SITE}/docs`;
const NOTICE = "<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->";

type Page = { file: string; id: string; title: string; category: string; entries: HTMLElement[] };

// The name of an entry in a list, once prepared: its code is already between backticks
const entryLabel = (entry: HTMLElement) => entry.querySelector("h3")?.textContent?.trim() ?? entry.id;

// Each anchor of the pages → its page, and whether it is the whole page (a section)
type Target = { file: string; section: boolean };

// What the site shows around the content (links, buttons, callouts) becomes what GitHub shows
function prepare(entry: HTMLElement, page: Page, targets: Map<string, Target>): void {
  for (const link of entry.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = link.getAttribute("href")!;
    if (href.startsWith("#")) {
      // An entry of another page goes to that page; a section, to the top of its page;
      // an anchor the pages do not have (a chapter, an example), to the site
      const target = targets.get(href.slice(1));
      link.setAttribute(
        "href",
        !target ? `${DOCS_URL}${href}` : target.section ? target.file : target.file === page.file ? href : `${target.file}${href}`,
      );
    } else if (!/^[a-z]+:/i.test(href)) {
      link.setAttribute("href", new URL(href, DOCS_URL).href);
    }
  }
  // A title in code stays in code, like the contents of the site
  entry.querySelectorAll("h3 code").forEach((code) => code.replaceWith(`\`${code.textContent}\``));
  // The site colours the snippets of the three ways to embed a scene with the GSS colours:
  // GitHub colours each one in its own language
  entry.querySelectorAll<HTMLElement>("pre > code.gss").forEach((code) => {
    const snippet = EMBED_SNIPPETS.find((way) => way.code === code.textContent);
    if (snippet) code.className = snippet.lang;
  });
  // GitHub cannot run an example: no "Try it", and each block of code (GSS, then its HTML) is shown
  entry.querySelectorAll("button.try").forEach((button) => button.remove());
  entry.querySelectorAll<HTMLElement>(".example").forEach((example) => example.replaceWith(...example.children));
  // A callout of the site is an alert of GitHub
  entry.querySelectorAll<HTMLElement>("aside.callout").forEach((callout) => {
    callout.querySelector(".keyword")?.remove();
    const p = entry.ownerDocument.createElement("p");
    p.innerHTML = `[!NOTE] ${callout.querySelector("p")?.innerHTML.trim() ?? ""}`;
    callout.replaceWith(p);
  });
}

function pageMarkdown(page: Page, next: Page | undefined): string {
  const entries = page.entries.map((entry) => `<a name="${entry.id}"></a>\n\n${articleToMarkdown(entry, 2).trim()}`);
  const markdown = [
    NOTICE,
    `[Documentation](README.md) · ${page.category}`,
    `# ${page.title}`,
    `Every example of this page, to edit live: [gss-lang.dev/docs](${DOCS_URL}#${page.id}).`,
    ...entries,
    next ? `---\n\nNext: [${next.title}](${next.file})` : `---\n\nBack to the [documentation](README.md).`,
  ].join("\n\n");
  return (
    markdown
      // GitHub colours GSS as CSS
      .replace(/^```gss$/gm, "```css")
      .replace(/^\[!NOTE\] (.*)$/gm, "> [!NOTE]\n> $1") + "\n"
  );
}

function indexMarkdown(pages: Page[]): string {
  const lines = [
    NOTICE,
    "# GSS documentation",
    "GSS (GPU Style Sheets) writes 3D scenes in CSS: shapes declared in `@scene`, styled with selectors, " +
      "the cascade and `@keyframes`, and compiled into one shader for WebGL2 and WebGPU.",
    `New to GSS? Start with [${pages[0].title}](${pages[0].file}), then [${pages[1].title}](${pages[1].file}). ` +
      `The same pages, with every example to edit live, are on [gss-lang.dev/docs](${DOCS_URL}).`,
  ];
  pages.forEach((page, i) => {
    if (page.category !== pages[i - 1]?.category) lines.push(`## ${page.category}`);
    const item = `- [${page.title}](${page.file}): ${page.entries.map(entryLabel).join(", ")}`;
    // One list per category: its items follow each other
    if (page.category === pages[i - 1]?.category) lines[lines.length - 1] += `\n${item}`;
    else lines.push(item);
  });
  return lines.join("\n\n") + "\n";
}

// The pages, by file name: the index first, then the sections in the order of the site
export function githubDocs(): Map<string, string> {
  const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
  const doc = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html");
  const pages: Page[] = [...doc.querySelectorAll<HTMLElement>("main > section")].map((section) => ({
    file: `${section.id}.md`,
    id: section.id,
    title: section.querySelector("h2")?.textContent?.trim() ?? section.id,
    category: section.dataset.category || "Reference",
    entries: [...section.querySelectorAll<HTMLElement>(":scope > article")],
  }));

  const targets = new Map<string, Target>();
  for (const page of pages) {
    targets.set(page.id, { file: page.file, section: true });
    for (const entry of page.entries) targets.set(entry.id, { file: page.file, section: false });
  }
  for (const page of pages) for (const entry of page.entries) prepare(entry, page, targets);

  const docs = new Map([["README.md", indexMarkdown(pages)]]);
  pages.forEach((page, i) => docs.set(page.file, pageMarkdown(page, pages[i + 1])));
  return docs;
}
