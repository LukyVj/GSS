// Native details/summary provides keyboard activation and expanded-state
// announcements, including without JavaScript. Remember each group's choice
// for this tab; a deep link always reveals the group of the page being read.
export function enableTocGroups(root: HTMLElement): (link: HTMLElement | null) => void {
  const groups = [...root.querySelectorAll<HTMLDetailsElement>(".toc-group")];
  const key = "gss-docs-groups";
  let saved: Record<string, boolean> = {};
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      saved = parsed as Record<string, boolean>;
    }
  } catch { /* Storage can be disabled; the disclosures still work. */ }

  for (const group of groups) {
    const id = group.dataset.group!;
    if (typeof saved[id] === "boolean") group.open = saved[id];
    group.addEventListener("toggle", () => {
      saved[id] = group.open;
      try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch { /* optional */ }
    });
  }

  return (link) => {
    const active = link?.closest<HTMLDetailsElement>(".toc-group");
    for (const group of groups) group.toggleAttribute("data-current", group === active);
    if (active) active.open = true;
  };
}
