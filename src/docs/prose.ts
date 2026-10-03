import { escapeHtml } from "./escape";

// The texts of the registry are plain text, where code sits between backticks, like Markdown:
// "`none` turns the sun off". The docs show that code as <code>; a property name alone takes
// its syntax colour, like `material` in the prose of DESIGN.md.
export function renderProse(text: string, properties: ReadonlySet<string>): string {
  return text
    .split("`")
    .map((part, i) => {
      if (i % 2 === 0) return escapeHtml(part);
      const code = escapeHtml(part);
      return properties.has(part)
        ? `<code><span class="gss-property">${code}</span></code>`
        : `<code>${code}</code>`;
    })
    .join("");
}

// The same text without its backticks: the tooltip of the editor is plain text
export function plainText(text: string): string {
  return text.replaceAll("`", "");
}
