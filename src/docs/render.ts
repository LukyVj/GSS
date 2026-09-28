import type { PropertyDef, AtRuleDef } from "../compiler/registry";
import { formatGss } from "./format";
import { escapeHtml } from "./escape";
import { highlightGss } from "./highlight";

export { escapeHtml }; // the tests and other pages import it from here

// Each example in its own code block, indented, with a button to try it live.
// The button carries the code, so the page script needs nothing else.
function renderExamples(examples: string[]): string {
  return examples
    .map(
      (example) => `
      <div class="example">
        <pre><code class="gss">${highlightGss(formatGss(example))}</code></pre>
        <button type="button" class="try" data-example="${escapeHtml(example)}">Try it</button>
      </div>`,
    )
    .join("\n");
}

// ⬇️ YOUR MISSION: the HTML of one property
export function renderProperty(property: PropertyDef): string {
  const appliesTo =
    property.appliesTo === "object"
      ? "objects"
      : property.appliesTo === "scene"
        ? "the scene"
        : property.appliesTo.join(", ");

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
        <dt>Animatable</dt>
        <dd>${property.animatable ? "yes" : "no"}</dd>
      </dl>
      ${renderExamples(property.examples)}
    </article>`;
}

// The HTML of one at-rule. The anchor starts with "at-" so that @scene
// can never clash with a property called "scene".
export function renderAtRule(atRule: AtRuleDef): string {
  return `
    <article class="property" id="at-${escapeHtml(atRule.name)}">
      <h3><code>@${escapeHtml(atRule.name)}</code></h3>
      <p>${escapeHtml(atRule.description)}</p>
      <dl>
        <dt>Syntax</dt>
        <dd><code>${escapeHtml(atRule.syntax)}</code></dd>
      </dl>
      ${renderExamples(atRule.examples)}
    </article>`;
}

// One section of the page. The table of contents and the content
// are both built from this list, so they can never disagree.
type Section = {
  id: string;
  title: string;
  entries: { anchor: string; label: string; html: string }[];
};

function renderToc(sections: Section[]): string {
  const groups = sections.map(
    (section) => `
      <h3><a href="#${section.id}">${section.title}</a></h3>
      <ul>
        ${section.entries
          .map(
            (entry) =>
              `<li><a href="#${escapeHtml(entry.anchor)}"><code>${escapeHtml(entry.label)}</code></a></li>`,
          )
          .join("\n")}
      </ul>`,
  );
  return `
     <div class="toc-slot">
      <div class="toc" aria-label="Sommaire">
        <h2>Contents</h2>
        <nav class="toc-nav"> ${groups.join("\n")}</nav>
      </div>
    </div>`;
}

// The name of the scroll timeline of a section or an entry: "translate" → "--toc-translate"
export function timelineName(id: string): string {
  return `--toc-${id}`;
}

// Highlights the table of contents link of what is being read, in pure CSS.
// Each section and each entry exposes a view timeline, and its link in the table of contents
// follows it. Only the names are generated here, from the same list as the page, so a new
// property is highlighted without touching the CSS; the look lives in docs.html.
function renderTocTimelines(sections: Section[]): string {
  const ids = sections.flatMap((section) => [
    section.id,
    ...section.entries.map((entry) => entry.anchor),
  ]);
  const rules = ids.map(
    (id) =>
      `#${id} { view-timeline: ${timelineName(id)} block; }\n` +
      `.toc a[href="#${id}"] { animation-timeline: ${timelineName(id)}; }`,
  );
  return `
    <style>
      @supports (timeline-scope: --a) and (animation-timeline: view()) {
        /* The links and the sections are far apart: the root makes the names visible to both */
        :root { timeline-scope: ${ids.map(timelineName).join(", ")}; }
        ${rules.join("\n        ")}
      }
    </style>`;
}

function renderSection(section: Section): string {
  return `
    <section id="${section.id}">
      <h2>${section.title}</h2>
      ${section.entries.map((entry) => entry.html).join("\n")}
    </section>`;
}

// The whole page: a table of contents, then at-rules, object properties and scene properties
export function renderDocs(
  properties: PropertyDef[],
  atRules: AtRuleDef[] = [],
): string {
  const propertyEntries = (belongs: (property: PropertyDef) => boolean) =>
    properties.filter(belongs).map((property) => ({
      anchor: property.name,
      label: property.name,
      html: renderProperty(property),
    }));

  const sections: Section[] = [
    {
      id: "at-rules",
      title: "At-rules",
      entries: atRules.map((atRule) => ({
        anchor: `at-${atRule.name}`,
        label: `@${atRule.name}`,
        html: renderAtRule(atRule),
      })),
    },
    {
      id: "object-properties",
      title: "Object properties",
      entries: propertyEntries((property) => property.appliesTo !== "scene"),
    },
    {
      id: "scene-properties",
      title: "Scene properties",
      entries: propertyEntries((property) => property.appliesTo === "scene"),
    },
  ];

  return `
    <header>
      <h1>GSS — GPU Style Sheets</h1>
      <p>Language reference, generated from the registry.</p>
    </header>
    ${renderToc(sections)}
    ${renderTocTimelines(sections)}
    ${sections.map(renderSection).join("\n")}`;
}
