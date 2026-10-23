import { escapeHtml } from "../docs/escape";
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
  const close = () => {
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
      head = `<section class="release" id="${escapeHtml(id)}">\n<h2><a href="#${escapeHtml(id)}">${escapeHtml(name)}</a>${date ? ` <time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>` : ""}</h2>`;
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
      if (!list) body.push("<ul>");
      list = true;
      body.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (list) {
      body[body.length - 1] = body[body.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
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
