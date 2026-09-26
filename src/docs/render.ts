import type { PropertyDef } from "../compiler/registry";

// Makes a text safe to insert in HTML: "<angle>" must be shown, not read as a tag.
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ⬇️ YOUR MISSION: the HTML of one property
export function renderProperty(property: PropertyDef): string {
  const appliesTo = property.appliesTo === "object" ? "objects" : "the scene";

  const examples = property.examples
    .map((example) => `<pre><code>${escapeHtml(example)}</code></pre>`)
    .join("\n");

  return `
    <article class="property" id="${escapeHtml(property.name)}">
      <h3><code>${escapeHtml(property.name)}</code></h3>
      <p>${escapeHtml(property.description)}</p>
      <dl>
        <dt>Syntax</dt>
        <dd><code>${escapeHtml(property.syntax)}</code></dd>
        <dt>Initial value</dt>
        <dd><code>${escapeHtml(property.initial)}</code></dd>
        <dt>Applies to</dt>
        <dd>${appliesTo}</dd>
      </dl>
      ${examples}
    </article>`;
}

// The whole page: one section for object properties, one for scene properties
export function renderDocs(properties: PropertyDef[]): string {
  const section = (title: string, appliesTo: PropertyDef["appliesTo"]) => `
    <section>
      <h2>${title}</h2>
      ${properties
        .filter((property) => property.appliesTo === appliesTo)
        .map(renderProperty)
        .join("\n")}
    </section>`;

  return `
    <header>
      <h1>GSS — GPU Style Sheets</h1>
      <p>Property reference, generated from the registry.</p>
    </header>
    ${section("Object properties", "object")}
    ${section("Scene properties", "scene")}`;
}
