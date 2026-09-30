import type {
  PropertyDef,
  AtRuleDef,
  SelectorDef,
  ShapeDef,
  FunctionDef,
} from "../compiler/registry";
import { formatGss } from "./format";
import { escapeHtml } from "./escape";
import { highlightGss } from "./highlight";
import { highlightSyntax } from "./highlight-code";
import { GETTING_STARTED, type GuideEntry } from "./guide";

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
        <dd><code class="gss syntax">${highlightSyntax(property.syntax)}</code></dd>
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
        <dd><code class="gss syntax">${highlightSyntax(atRule.syntax)}</code></dd>
      </dl>
      ${renderExamples(atRule.examples)}
    </article>`;
}

// The HTML of one selector. Its anchor is not its name: "*" or ".class" cannot be an id
export function renderSelector(selector: SelectorDef): string {
  return `
    <article class="property" id="${escapeHtml(selector.anchor)}">
      <h3><code>${escapeHtml(selector.name)}</code></h3>
      <p>${escapeHtml(selector.description)}</p>
      <dl>
        <dt>Specificity</dt>
        <dd>${escapeHtml(selector.specificity)}</dd>
      </dl>
      ${renderExamples(selector.examples)}
    </article>`;
}

// The HTML of one math function (or of a family: sin(), cos(), tan())
export function renderFunction(fn: FunctionDef): string {
  return `
    <article class="property" id="${escapeHtml(fn.anchor)}">
      <h3><code>${escapeHtml(fn.name)}</code></h3>
      <p>${escapeHtml(fn.description)}</p>
      <dl>
        <dt>Syntax</dt>
        <dd><code class="gss syntax">${highlightSyntax(fn.syntax)}</code></dd>
        <dt>Computed</dt>
        <dd>at compile time, once per object</dd>
      </dl>
      ${renderExamples(fn.examples)}
    </article>`;
}

// The HTML of one shape. Its own properties come from the registry (appliesTo),
// so a new shape property shows up here without touching this list.
export function renderShape(
  shape: ShapeDef,
  properties: PropertyDef[],
): string {
  const own = properties.filter(
    (property) =>
      Array.isArray(property.appliesTo) &&
      (property.appliesTo as string[]).includes(shape.name),
  );
  const links = own
    .map(
      (property) =>
        `<a href="#${escapeHtml(property.name)}"><code>${escapeHtml(property.name)}</code></a>`,
    )
    .join(", ");
  // A group only takes a few properties: they are listed instead of "every object property"
  const takes = (shape.takes ?? [])
    .map(
      (name) =>
        `<a href="#${escapeHtml(name)}"><code>${escapeHtml(name)}</code></a>`,
    )
    .join(", ");
  const propertyList = shape.takes
    ? `<dt>Takes</dt>
        <dd>${takes}</dd>`
    : `<dt>Own properties</dt>
        <dd>${links || "none"}</dd>
        <dt>Also</dt>
        <dd><a href="#object-properties">every object property</a></dd>`;
  return `
    <article class="property" id="shape-${escapeHtml(shape.name)}">
      <h3><code>${escapeHtml(shape.name)}</code></h3>
      <p>${escapeHtml(shape.description)}</p>
      <dl>
        ${propertyList}
      </dl>
      ${renderExamples(shape.examples)}
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
      <div class="toc" aria-label="Contents">
        <h2><button type="button" class="toc-toggle" aria-expanded="false">Contents</button></h2>
        <div id="docsearch"></div>
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

// One hand-written entry of "Getting started"
function renderGuideEntry(entry: GuideEntry): string {
  const paragraphs = (list: string[] = []) =>
    // a block of code (<pre>) is not a paragraph: it goes in as it is
    list
      .map((text) => (text.startsWith("<pre") ? text : `<p>${text}</p>`))
      .join("\n      ");
  return `
    <article class="guide" id="${escapeHtml(entry.anchor)}">
      <h3>${escapeHtml(entry.label)}</h3>
      ${paragraphs(entry.paragraphs)}
      ${entry.example ? renderExamples([entry.example]) : ""}
      ${paragraphs(entry.after)}
    </article>`;
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
  selectors: SelectorDef[] = [],
  shapes: ShapeDef[] = [],
  functions: FunctionDef[] = [],
): string {
  const propertyEntries = (belongs: (property: PropertyDef) => boolean) =>
    properties.filter(belongs).map((property) => ({
      anchor: property.name,
      label: property.name,
      html: renderProperty(property),
    }));

  const sections: Section[] = [
    {
      id: "getting-started",
      title: "Getting started",
      entries: GETTING_STARTED.map((entry) => ({
        anchor: entry.anchor,
        label: entry.label,
        html: renderGuideEntry(entry),
      })),
    },
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
      id: "selectors",
      title: "Selectors and cascade",
      entries: selectors.map((selector) => ({
        anchor: selector.anchor,
        label: selector.name,
        html: renderSelector(selector),
      })),
    },
    {
      id: "values",
      title: "Values and math",
      entries: functions.map((fn) => ({
        anchor: fn.anchor,
        label: fn.name,
        html: renderFunction(fn),
      })),
    },
    {
      id: "shapes",
      title: "Shapes",
      entries: shapes.map((shape) => ({
        anchor: `shape-${shape.name}`,
        label: shape.name,
        html: renderShape(shape, properties),
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
      <p class="tagline">A CSS-like language for 3D scenes, compiled to a GPU shader.</p>
    </header>
    ${renderToc(sections)}
    ${renderTocTimelines(sections)}
    ${sections.map(renderSection).join("\n")}`;
}
