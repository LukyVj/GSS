// Turns a docs article (the visible page) into Markdown, for LLMs and for reading
// the source. Chrome we inject (.crumbs, .pager, .copy-page, live playground) is skipped,
// and so is a live demo: the page shows its code too.

const SKIP = new Set(["page-bar", "crumbs", "pager", "copy-page", "playground", "variables-demo", "editor-pocket"]);

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE;
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!isElement(node)) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "code") return `\`${node.textContent ?? ""}\``;
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    const text = [...node.childNodes].map(inlineMarkdown).join("");
    return href ? `[${text}](${href})` : text;
  }
  if (tag === "em" || tag === "i") {
    return `*${[...node.childNodes].map(inlineMarkdown).join("")}*`;
  }
  if (tag === "b" || tag === "strong") {
    return `**${[...node.childNodes].map(inlineMarkdown).join("")}**`;
  }
  return [...node.childNodes].map(inlineMarkdown).join("");
}

function fenceLanguage(pre: HTMLElement): string {
  const code = pre.querySelector("code");
  const classes = code?.className ?? "";
  if (/\bgss\b/.test(classes)) return "gss";
  if (/\b(js|javascript)\b/.test(classes)) return "js";
  if (/\bts\b/.test(classes)) return "ts";
  if (/\bhtml\b/.test(classes)) return "html";
  return "";
}

function fencedCode(pre: HTMLElement): string {
  // Prefer the raw example on the Try button: highlighted spans are noisier
  const raw = pre.closest(".example")?.querySelector<HTMLButtonElement>("button.try")?.dataset.example;
  const body = (raw ?? pre.textContent ?? "").replace(/\n$/, "");
  const lang = fenceLanguage(pre);
  return "```" + lang + "\n" + body + "\n```";
}

function definitionList(dl: HTMLElement): string {
  const rows: string[] = [];
  let key = "";
  for (const child of dl.children) {
    if (child.tagName === "DT") {
      key = (child.textContent ?? "").trim();
    } else if (child.tagName === "DD" && key) {
      const value = inlineMarkdown(child).trim();
      rows.push(`- **${key}:** ${value}`);
      key = "";
    }
  }
  return rows.join("\n");
}

function blockToMarkdown(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "h3") {
    const title = (el.textContent ?? "").trim();
    return title ? `# ${title}` : "";
  }
  if (tag === "h4") {
    const title = inlineMarkdown(el).trim();
    return title ? `## ${title}` : "";
  }
  if (tag === "p") return inlineMarkdown(el).trim();
  // What a page folds is read like the rest: its text, without the label of the fold
  if (tag === "details") {
    return [...el.children]
      .filter((child) => child.tagName !== "SUMMARY")
      .map((child) => blockToMarkdown(child as HTMLElement))
      .filter(Boolean)
      .join("\n\n");
  }
  // A figure, in words: its label, then the names it draws
  if (tag === "figure") {
    const names = [...el.querySelectorAll("li")].map((item) => `\`${(item.textContent ?? "").trim()}\``);
    const label = el.getAttribute("aria-label") ?? "";
    return [label && `**${label}:**`, names.join(", ")].filter(Boolean).join(" ");
  }
  if (tag === "dl") return definitionList(el);
  if (tag === "pre") return fencedCode(el);
  if (el.classList.contains("example")) {
    const pre = el.querySelector<HTMLElement>(":scope > pre");
    return pre ? fencedCode(pre) : "";
  }
  // Guide entries can put a bare <pre> (or a bold lead) as a direct child; an example
  // sits in a block with its name and its sentence
  if (tag === "div" || tag === "section") {
    return [...el.children]
      .filter((child) => ![...child.classList].some((name) => SKIP.has(name)))
      .map((child) => blockToMarkdown(child as HTMLElement))
      .filter(Boolean)
      .join("\n\n");
  }
  return inlineMarkdown(el).trim();
}

export function articleToMarkdown(article: HTMLElement): string {
  const blocks: string[] = [];
  for (const child of article.children) {
    if (!(child instanceof HTMLElement)) continue;
    if ([...child.classList].some((name) => SKIP.has(name))) continue;
    const md = blockToMarkdown(child);
    if (md) blocks.push(md);
  }
  return blocks.join("\n\n").trim() + "\n";
}
