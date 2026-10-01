import { encodeCode } from "../runtime/share";
import { mountCopyPage } from "./copy-page";
import { closePlayground } from "./playground";

// The docs show one entry at a time, like pages (design/reference/png/03-docs.png):
// the contents on the left, the entry in the middle, "On this page" on the right.
// The whole reference stays in the HTML (links, find in page, tests): the hash picks the page.

export type PageIndex = { sections: { id: string; entries: string[] }[] };

// The page to show for a hash, and where to scroll in it.
// "#material" → material; "#material--example-2" → material, at its second example;
// a section ("#shapes") → its first entry; anything else → the very first entry.
export function resolvePage(hash: string, index: PageIndex): { page: string; target: string | null } {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const entries = index.sections.flatMap((section) => section.entries);
  if (entries.includes(id)) return { page: id, target: null };
  const [base] = id.split("--");
  if (entries.includes(base)) return { page: base, target: id };
  const section = index.sections.find((section) => section.id === id);
  return { page: section?.entries[0] ?? entries[0], target: null };
}

// The entries before and after, across sections: the reading order of the whole reference
export function neighbors(page: string, index: PageIndex): { previous?: string; next?: string } {
  const entries = index.sections.flatMap((section) => section.entries);
  const at = entries.indexOf(page);
  return { previous: entries[at - 1], next: entries[at + 1] };
}

// ----- In the page -----

const titleOf = (article: HTMLElement) => article.querySelector("h3")?.textContent?.trim() ?? article.id;

function link(href: string, text: string, className?: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  if (className) a.className = className;
  return a;
}

// Gives the parts of an entry an anchor, and returns them for "On this page"
function partsOf(article: HTMLElement): { id: string; label: string }[] {
  const parts: { id: string; label: string }[] = [];
  const table = article.querySelector<HTMLElement>(":scope > dl");
  if (table) {
    const first = table.querySelector("dt")?.textContent?.toLowerCase() ?? "details";
    table.id = `${article.id}--${first.replaceAll(" ", "-")}`;
    parts.push({ id: table.id, label: first });
  }
  const examples = [...article.querySelectorAll<HTMLElement>(":scope > .example")];
  examples.forEach((example, i) => {
    example.id = `${article.id}--example-${i + 1}`;
    parts.push({ id: example.id, label: examples.length > 1 ? `example ${i + 1}` : "example" });
  });
  return parts;
}

export function enablePages(root: HTMLElement): void {
  root.classList.add("paged");
  const sections = [...root.querySelectorAll<HTMLElement>(":scope > section")];
  const index: PageIndex = {
    sections: sections.map((section) => ({
      id: section.id,
      entries: [...section.querySelectorAll<HTMLElement>(":scope > article")].map((a) => a.id),
    })),
  };
  const header = root.querySelector<HTMLElement>(":scope > header");
  const firstPage = index.sections[0]?.entries[0];

  const aside = document.createElement("aside");
  aside.className = "on-this-page";
  aside.setAttribute("aria-label", "On this page");
  const inner = document.createElement("div"); // sticky, while the aside runs the full height
  aside.append(inner);
  root.append(aside);

  // The contents fold away on a small screen
  const toc = root.querySelector<HTMLElement>(".toc");
  const toggle = root.querySelector<HTMLButtonElement>(".toc-toggle");
  toggle?.addEventListener("click", () => {
    const open = toc!.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  let shown: string | null = null;

  async function show(): Promise<void> {
    const { page, target } = resolvePage(location.hash, index);
    const article = document.getElementById(page)!;
    const section = article.closest("section")!;

    if (page !== shown) {
      closePlayground(); // a live example must not keep running on a hidden page
      shown = page;
      for (const other of sections) other.hidden = other !== section;
      for (const other of root.querySelectorAll<HTMLElement>("article")) other.hidden = other !== article;
      if (header) header.hidden = page !== firstPage;

      // Contents: the current page
      for (const a of root.querySelectorAll(".toc a[aria-current]")) a.removeAttribute("aria-current");
      const currentLink = root.querySelector<HTMLElement>(`.toc a[href="#${CSS.escape(page)}"]`);
      currentLink?.setAttribute("aria-current", "page");
      // Keep it in view in the scrolling contents (the toc is sticky, so it is the offset parent)
      if (toc && currentLink && toc.scrollHeight > toc.clientHeight) {
        toc.scrollTop = currentLink.offsetTop - toc.clientHeight / 2;
      }
      toc?.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");

      // Breadcrumb + copy page: "object properties / material" · copy page ▾
      root.querySelector(".page-bar")?.remove();
      const bar = document.createElement("div");
      bar.className = "page-bar";
      const crumbs = document.createElement("div");
      crumbs.className = "crumbs";
      const current = document.createElement("span");
      current.textContent = titleOf(article);
      crumbs.append(`${section.querySelector("h2")?.textContent?.toLowerCase() ?? ""} / `, current);
      bar.append(crumbs, mountCopyPage(article));
      article.prepend(bar);

      // Previous / next
      root.querySelector(".pager")?.remove();
      const { previous, next } = neighbors(page, index);
      const pager = document.createElement("nav");
      pager.className = "pager";
      pager.setAttribute("aria-label", "Previous and next");
      if (previous) pager.append(link(`#${previous}`, `← ${titleOf(document.getElementById(previous)!)}`, "previous"));
      if (next) pager.append(link(`#${next}`, `${titleOf(document.getElementById(next)!)} →`, "next"));
      article.append(pager);

      // On this page
      const parts = partsOf(article);
      const title = document.createElement("div");
      title.className = "label";
      title.textContent = "On this page";
      const list = document.createElement("ul");
      for (const part of parts) {
        const item = document.createElement("li");
        item.append(link(`#${part.id}`, part.label));
        list.append(item);
      }
      inner.replaceChildren(...(parts.length ? [title, list] : []));
      const example = article.querySelector<HTMLButtonElement>(".example .try")?.dataset.example;
      if (example) inner.append(link(`./playground.html${await encodeCode(example)}`, "try it in the playground →", "to-playground"));

      document.title = `${titleOf(article)} — GSS`;
    }

    if (target) document.getElementById(target)?.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", show);
  show();
}
