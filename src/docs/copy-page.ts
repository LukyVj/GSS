import { escapeHtml } from "./escape";
import { articleToMarkdown } from "./to-markdown";

// The "copy page" control on each docs entry: copy Markdown for LLMs, or open
// the same source in a new tab (as Markdown / as plain text).

type Action = "copy" | "view-md" | "view-text";

const ACTIONS: { action: Action; label: string }[] = [
  { action: "copy", label: "copy page as markdown for llms" },
  { action: "view-md", label: "view as markdown" },
  { action: "view-text", label: "open this page as plain text" },
];

function openBlob(text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  window.open(url, "_blank", "noopener,noreferrer");
  // Keep the blob alive long enough for the new tab to load it
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openMarkdownView(markdown: string): void {
  // text/markdown is often downloaded; an HTML shell keeps it readable in the tab
  openBlob(
    `<!doctype html><meta charset="utf-8"><title>Markdown</title><pre style="box-sizing:border-box;margin:0;padding:24px;max-width:72rem;white-space:pre-wrap;font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(markdown)}</pre>`,
    "text/html",
  );
}

async function run(action: Action, markdown: string, trigger: HTMLButtonElement): Promise<void> {
  if (action === "copy") {
    await navigator.clipboard.writeText(markdown);
    const previous = trigger.textContent;
    trigger.textContent = "copied";
    setTimeout(() => {
      trigger.textContent = previous;
    }, 1600);
    return;
  }
  if (action === "view-md") {
    openMarkdownView(markdown);
    return;
  }
  openBlob(markdown, "text/plain");
}

export function mountCopyPage(article: HTMLElement): HTMLElement {
  const root = document.createElement("div");
  root.className = "copy-page";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "copy-page-trigger";
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.textContent = "copy page ▾";

  const menu = document.createElement("div");
  menu.className = "copy-page-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  for (const item of ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-page-item";
    button.setAttribute("role", "menuitem");
    button.textContent = item.label;
    button.addEventListener("click", async () => {
      close();
      await run(item.action, articleToMarkdown(article), trigger);
    });
    menu.append(button);
  }

  const onPointer = (event: Event) => {
    if (!root.contains(event.target as Node)) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  function open(): void {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
  }

  function close(): void {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onPointer);
    document.removeEventListener("keydown", onKey);
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) open();
    else close();
  });

  root.append(trigger, menu);
  return root;
}
