import { escapeHtml } from "../docs/escape";
import { docEntries } from "../docs/start-screen";
import changelog from "../../CHANGELOG.md?raw";

// The changelog page (changelog.html): CHANGELOG.md, written into the page when it is
// prerendered. The file only uses a little Markdown: titles, lists, paragraphs, and code,
// links, bold and italic inside a line.

// Code, links, bold and italic in one line of the file. Code and links are set aside first,
// so the underscores of a URL or of code are never read as italic.
function inline(text: string): string {
  const kept: string[] = [];
  const keep = (html: string) => `\u0000${kept.push(html) - 1}\u0000`;
  let out = text.replace(/`([^`]+)`/g, (_match, code: string) => keep(`<code>${escapeHtml(code)}</code>`));
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) =>
    keep(`<a href="${escapeHtml(url)}">${inline(label)}</a>`),
  );
  out = escapeHtml(out)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)]|$)/g, "$1<em>$2</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_match, i: string) => kept[Number(i)]);
}

// "A change. More about it." → ["A change.", "More about it."]: the first sentence ends at a
// period followed by a space, outside code and the URL of a link. null: one sentence only
function firstSentence(text: string): [string, string | null] {
  let code = false;
  let url = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "`") code = !code;
    else if (!code && char === "(" && text[i - 1] === "]") url++;
    else if (!code && char === ")" && url > 0) url--;
    else if (!code && url === 0 && /[.!?]/.test(char) && text[i + 1] === " ")
      return [text.slice(0, i + 1), text.slice(i + 2).trim() || null];
  }
  return [text, null];
}

// The pages of the docs, by anchor: a change whose element has a page leads there
let anchors: Set<string> | null = null;
function docAnchors(): Set<string> {
  anchors ??= new Set(docEntries().map((entry) => entry.anchor));
  return anchors;
}

// Elements whose page has another name, written as code or as words
const ALIASES: Record<string, string> = {
  "<gss-scene>": "embedding",
  "mount()": "embedding",
  "currentColor": "fn-currentcolor",
  "conic-gradient()": "fn-gradients",
  "Attribute selectors": "selector-attribute",
  Nesting: "selector-nesting",
  Combinators: "selector-child",
  Gradients: "fn-gradients",
  Embedding: "embedding",
  "VS Code extension": "editor-support",
};

// The page of the docs of an element: `content` → content, `@mixin` → at-mixin,
// `noise()` → fn-noise, `::face()` and `:hover` → selector-face and selector-hover.
// The first element when there are several (`@mixin`, `@apply`); null: no page
export function docAnchor(scope: string): string | null {
  if (ALIASES[scope]) return ALIASES[scope];
  const code = /`([^`]+)`/.exec(scope)?.[1];
  if (!code) return null;
  const name = code.split(/[\s:(]/).filter(Boolean)[0] ?? "";
  const bare = code.replace(/^:+/, "").replace(/\(.*$/, "");
  const alias = ALIASES[code];
  if (alias) return alias;
  const candidates = code.startsWith("@")
    ? [`at-${code.slice(1)}`]
    : code.startsWith(":")
      ? [`selector-${bare}`]
      : [name, `fn-${bare}`, `shape-${name}`];
  return candidates.find((anchor) => docAnchors().has(anchor)) ?? null;
}

// One change of the list, as one line, like the changelogs of Vite or Tailwind: the element
// it is about ("- **`content`**: …") in the first column, its first sentence in the second.
// What follows the first sentence stays in CHANGELOG.md; when the element has a page in the
// docs, the line leads there.
function change(text: string): string {
  const scope = /^\*\*(.+?)\*\*:\s+/.exec(text);
  const label = `<span class="scope">${scope ? inline(scope[1]) : ""}</span>`;
  const [first] = firstSentence(scope ? text.slice(scope[0].length) : text);
  const what = `<span class="what">${inline(first)}</span>`;
  const anchor = scope ? docAnchor(scope[1]) : null;
  return anchor
    ? `<li><a class="row" href="./docs.html#${anchor}">${label}${what}<span class="go" aria-hidden="true">→</span></a></li>`
    : `<li><div class="row">${label}${what}</div></li>`;
}

// "## [0.0.7] — 2026-10-23" → the version and its date; "## Unreleased" → no date
function releaseTitle(line: string): { id: string; name: string; date: string | null } {
  const title = line.slice(3).trim();
  const match = /^\[?([^\]\s]+)\]?(?:\s+—\s+(\S+))?/.exec(title)!;
  const name = match[1];
  return { id: name.toLowerCase(), name, date: match[2] ?? null };
}

// The versions of the file, newest first: each one a section with its anchor (#0.0.7).
// What comes before the first version (the title and the introduction) and the link
// definitions at the end stay out; so does an Unreleased with nothing under it.
export function renderChangelog(markdown: string = changelog): string {
  const sections: string[] = [];
  let body: string[] | null = null;
  let head = "";
  let list = false;
  let item: string | null = null; // the change being read: a line, and the lines that go on
  const flush = () => {
    if (item !== null) body!.push(change(item));
    item = null;
  };
  const close = () => {
    flush();
    if (list) body!.push("</ul>");
    list = false;
  };
  const finish = () => {
    if (!body) return;
    close();
    if (body.length > 0) sections.push(`${head}\n${body.join("\n")}\n</section>`);
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      finish();
      const { id, name, date } = releaseTitle(line);
      // A timeline of the page per version, for the cloud of points beside it to follow
      // (animation-timeline: --v0-0-7): while the version crosses a line at 40% of the
      // window. In the style attribute, read even where the browser does not know it.
      const timeline = `--${/^\d/.test(id) ? "v" : ""}${id.replaceAll(".", "-")}`;
      head = `<section class="release" id="${escapeHtml(id)}" style="view-timeline-name: ${escapeHtml(timeline)}; view-timeline-inset: 40% 59%">\n<h2><a href="#${escapeHtml(id)}">${escapeHtml(name)}</a>${date ? ` <time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>` : ""}</h2>`;
      body = [];
      continue;
    }
    if (!body) continue; // the title and the introduction of the file
    if (/^\[[^\]]+\]:\s/.test(line)) continue; // a link definition
    if (line === "") {
      close();
      continue;
    }
    if (line.startsWith("### ")) {
      close();
      body.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      flush();
      if (!list) body.push("<ul>");
      list = true;
      item = line.slice(2);
    } else if (list) {
      item = `${item ?? ""} ${line.trim()}`;
    } else if (body.at(-1)?.startsWith("<p>")) {
      body[body.length - 1] = body[body.length - 1].replace(/<\/p>$/, ` ${inline(line)}</p>`);
    } else {
      body.push(`<p>${inline(line)}</p>`);
    }
  }
  finish();
  return sections.join("\n\n");
}

const PLACE = '<div class="changelog" id="changelog"></div>';

export function prerenderChangelogHtml(html: string): string {
  if (!html.includes(PLACE)) throw new Error(`prerender changelog: expected ${PLACE}`);
  return html.replace(PLACE, `<div class="changelog" id="changelog">\n${renderChangelog()}\n</div>`);
}
