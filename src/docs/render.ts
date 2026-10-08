import {
  PROPERTIES,
  type PropertyDef,
  type AtRuleDef,
  type SelectorDef,
  type ShapeDef,
  type FunctionDef,
  type Example,
  type Note,
  type Value,
} from "../compiler/registry/registry";
import { formatGss } from "./format";
import { escapeHtml } from "./escape";
import { highlightGss } from "./highlight";
import { renderProse } from "./prose";
import { highlightCode, highlightSyntax } from "./highlight-code";
import { groupEntries, qualified, QUALIFIERS } from "./navigation";
import { navIcon, navIconMotion } from "./nav-icons";
import { GETTING_STARTED, INSTALLATION, type GuideEntry } from "./guide";
import { chapterAnchor, exampleAnchor } from "./anchors";
import { newestVersion } from "./news";
import { VERSION } from "../version";

export { escapeHtml }; // the tests and other pages import it from here

// The prose of the registry: its code between backticks, a property name in its colour
const PROPERTY_NAMES = new Set(PROPERTIES.map((property) => property.name));
const prose = (text: string) => renderProse(text, PROPERTY_NAMES);

// Each example in its own code block, indented, with a button to try it live, under its
// name and the sentence that says what it shows, like the examples of a popular language.
// The button carries the code (and the HTML of element(#id)), so the page script needs nothing else.
// Each one has the anchor of "On this page", for the links and the search.
function renderExamples(page: string, examples: Example[]): string {
  return examples
    .map(
      (example, i) => `
      <div class="example-part" id="${escapeHtml(exampleAnchor(page, i))}">${example.name ? `
        <h4 class="example-name">${escapeHtml(example.name)}</h4>` : ""}${example.text ? `
        <p class="example-text">${prose(example.text)}</p>` : ""}
        <div class="example">
          <pre><code class="gss">${highlightGss(formatGss(example.code))}</code></pre>${example.html ? `\n          <pre><code class="html">${highlightCode("html", example.html)}</code></pre>` : ""}
          <button type="button" class="try" data-example="${escapeHtml(example.code)}"${example.html ? ` data-html="${escapeHtml(example.html)}"` : ""}>Try it</button>
        </div>
      </div>`,
    )
    .join("\n");
}

// A callout under the description, when the entry has one
function renderNote(note: Note | undefined): string {
  if (!note) return "";
  return `
      <aside class="callout">
        <p><span class="keyword">note</span> <strong>${escapeHtml(note.title)}</strong> ${prose(note.text)}</p>
      </aside>`;
}

// The title of a page; "light (sun)" when another entry has the same name
// The version that added a page, beside its title (decision 159): an attribute the CSS of the
// docs shows, so the text of the title, what the search reads, stays the name of the page
const dated = (since: string) => ` data-since="${escapeHtml(since)}"`;

function renderTitle(anchor: string, name: string, since: string): string {
  const qualifier = QUALIFIERS[anchor];
  return `<h3${dated(since)}><code>${escapeHtml(name)}</code>${qualifier ? ` <small>(${escapeHtml(qualifier)})</small>` : ""}</h3>`;
}

// Under the table of the entry: what each value does, then a paragraph, when the entry has them
function renderValues(page: string, { values, valuesTitle = "Values", details }: {
  values?: Value[];
  valuesTitle?: string;
  details?: string;
}): string {
  const table = values?.length
    ? `
      <h4 id="${escapeHtml(chapterAnchor(page, valuesTitle))}">${escapeHtml(valuesTitle)}</h4>
      <dl class="values">${values
        .map(
          ([value, text]) => `
        <dt><code class="gss syntax">${highlightSyntax(value)}</code></dt>
        <dd>${prose(text)}</dd>`,
        )
        .join("")}
      </dl>`
    : "";
  return table + (details ? `
      <p>${prose(details)}</p>` : "");
}

// ⬇️ YOUR MISSION: the HTML of one property
export function renderProperty(property: PropertyDef): string {
  const appliesTo =
    property.appliesTo === "object"
      ? "objects"
      : property.appliesTo === "scene"
        ? "the scene"
        : property.appliesTo === "everywhere"
          ? "the scene, objects and groups"
          : property.appliesTo.join(", ");

  return `
    <article class="property" id="${escapeHtml(property.name)}">
      ${renderTitle(property.name, property.name, property.since)}
      <p>${prose(property.description)}</p>${renderNote(property.note)}
      <dl>
        <dt>Syntax</dt>
        <dd><code class="gss syntax">${highlightSyntax(property.syntax)}</code></dd>
        <dt>Initial value</dt>
        <dd><code>${escapeHtml(property.initial)}</code></dd>
        <dt>Applies to</dt>
        <dd>${appliesTo}</dd>
        <dt>Animatable</dt>
        <dd>${property.animatable ? "yes" : "no"}</dd>
      </dl>${renderValues(property.name, property)}
      ${renderExamples(property.name, property.examples)}
    </article>`;
}

// The HTML of one at-rule. The anchor starts with "at-" so that @scene
// can never clash with a property called "scene".
export function renderAtRule(atRule: AtRuleDef): string {
  const see = (atRule.see ?? [])
    .map((page) => `<a href="#${escapeHtml(page.anchor)}">${escapeHtml(page.label)}</a>`)
    .join(", ");
  return `
    <article class="property" id="at-${escapeHtml(atRule.name)}">
      <h3${dated(atRule.since)}><code>@${escapeHtml(atRule.name)}</code></h3>
      <p>${prose(atRule.description)}</p>
      <dl>
        <dt>Syntax</dt>
        <dd><code class="gss syntax">${highlightSyntax(atRule.syntax)}</code></dd>${
          see ? `
        <dt>See also</dt>
        <dd>${see}</dd>` : ""}
      </dl>${renderValues(`at-${atRule.name}`, atRule)}
      ${renderExamples(`at-${atRule.name}`, atRule.examples)}
    </article>`;
}

// The HTML of one selector. Its anchor is not its name: "*" or ".class" cannot be an id
export function renderSelector(selector: SelectorDef): string {
  return `
    <article class="property" id="${escapeHtml(selector.anchor)}">
      <h3${dated(selector.since)}><code>${escapeHtml(selector.name)}</code></h3>
      <p>${prose(selector.description)}</p>
      <dl>
        <dt>Specificity</dt>
        <dd>${prose(selector.specificity)}</dd>
      </dl>${renderValues(selector.anchor, selector)}
      ${renderExamples(selector.anchor, selector.examples)}
    </article>`;
}

// The HTML of one math function (or of a family: sin(), cos(), tan())
export function renderFunction(fn: FunctionDef): string {
  return `
    <article class="property" id="${escapeHtml(fn.anchor)}">
      <h3${dated(fn.since)}><code>${escapeHtml(fn.name)}</code></h3>
      <p>${prose(fn.description)}</p>${renderNote(fn.note)}
      <dl>
        <dt>Syntax</dt>
        <dd><code class="gss syntax">${highlightSyntax(fn.syntax)}</code></dd>
        <dt>Computed</dt>
        <dd>${prose(fn.computed ?? "at compile time, once per object")}</dd>
      </dl>${renderValues(fn.anchor, fn)}
      ${renderExamples(fn.anchor, fn.examples)}
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
        <dd><a href="#object-properties">geometry properties</a></dd>`;
  return `
    <article class="property" id="shape-${escapeHtml(shape.name)}">
      ${renderTitle(`shape-${shape.name}`, shape.name, shape.since)}
      <p>${prose(shape.description)}</p>
      <dl>
        ${propertyList}
      </dl>${renderValues(`shape-${shape.name}`, shape)}
      ${renderExamples(`shape-${shape.name}`, shape.examples)}
    </article>`;
}

// One section of the page. The table of contents and the content
// are both built from this list, so they can never disagree.
type Section = {
  id: string;
  title: string;
  category?: string;
  entries: { anchor: string; label: string; html: string; since?: string }[];
};

// fresh: the newest version that is out (news.ts); its pages say "new in v0.0.5" in the contents, and
// their group shows a dot, so a folded group says it holds one
function renderToc(sections: Section[], fresh: string | null): string {
  const isNew = (entry: { since?: string }) => fresh !== null && entry.since === fresh;
  const groups = sections.map(
    (section, i) => `
      ${section.category !== sections[i - 1]?.category ? `<h3 class="toc-category">${escapeHtml(section.category ?? "Reference")}</h3>` : ""}
      <details class="toc-group" data-group="${escapeHtml(section.id)}"${section.id === "getting-started" ? " open" : ""}>
        <summary>
          ${navIcon(section.id, "toc-icon", true)}<span class="toc-group-title">${escapeHtml(section.title)}</span>${
            section.entries.some(isNew) ? `\n          <span class="toc-group-new" title="New in ${escapeHtml(fresh!)}" aria-hidden="true"></span>` : ""
          }
          <span class="toc-group-count" aria-hidden="true">${section.entries.length}</span>
          <svg class="toc-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="m6 4 4 4-4 4" /></svg>
        </summary>
      <ul>
        ${section.entries
          .map(
            (entry) =>
              `<li><a href="#${escapeHtml(entry.anchor)}"><code>${escapeHtml(entry.label)}</code>${isNew(entry) ? `<span class="toc-new">new in v${escapeHtml(fresh!)}</span>` : ""}</a></li>`,
          )
          .join("\n")}
      </ul>
      </details>`,
  );
  return `
     <div class="toc-slot">
      <div class="toc" aria-label="Contents">
        <h2><button type="button" class="toc-toggle" aria-expanded="false">Contents</button></h2>
        <div id="docsearch"></div>
        <nav class="toc-nav"> ${groups.join("\n")}</nav>
        <style>${navIconMotion(".toc-group > summary:is(:hover, :focus-visible)")}</style>
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
  // A chapter gets the anchor "On this page" gives it, from the text of its title
  const chapter = (html: string) =>
    html.replace(/^<h4>(.*)<\/h4>$/s, (_, title: string) => {
      const text = title
        .replace(/<[^>]*>/g, "")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&amp;", "&")
        .trim();
      return `<h4 id="${escapeHtml(chapterAnchor(entry.anchor, text))}">${title}</h4>`;
    });
  const paragraphs = (list: string[] = []) =>
    // a block of code (<pre>), a live demo or a table (<div>), a chapter (<h4>) or a paragraph
    // that has its own class (<p>) is not wrapped in a paragraph: it goes in as it is
    list
      .map((text) => (/^<(pre|div|h4|p)\b/.test(text) ? chapter(text) : `<p>${text}</p>`))
      .join("\n      ");
  return `
    <article class="guide" id="${escapeHtml(entry.anchor)}">
      <h3${dated(entry.since)}>${escapeHtml(entry.label)}</h3>
      ${paragraphs(entry.paragraphs)}
      ${entry.example ? renderExamples(entry.anchor, [{ code: entry.example }]) : ""}
      ${paragraphs(entry.after)}
    </article>`;
}

function renderSection(section: Section): string {
  return `
    <section id="${section.id}" data-category="${escapeHtml(section.category ?? "")}">
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
  published = VERSION, // the version that is out: its pages say "new" in the contents
): string {
  const propertyEntries = (belongs: (property: PropertyDef) => boolean) =>
    properties.filter(belongs).map((property) => ({
      anchor: property.name,
      label: property.name,
      since: property.since,
      html: renderProperty(property),
    }));

  const original: Section[] = [
    {
      id: "getting-started",
      title: "Getting started",
      entries: [...GETTING_STARTED, ...INSTALLATION].map((entry) => ({
        anchor: entry.anchor,
        label: entry.label,
        since: entry.since,
        html: renderGuideEntry(entry),
      })),
    },
    {
      id: "at-rules",
      title: "At-rules",
      entries: atRules.map((atRule) => ({
        anchor: `at-${atRule.name}`,
        label: `@${atRule.name}`,
        since: atRule.since,
        html: renderAtRule(atRule),
      })),
    },
    {
      id: "selectors",
      title: "Selectors and cascade",
      entries: selectors.map((selector) => ({
        anchor: selector.anchor,
        label: selector.name,
        since: selector.since,
        html: renderSelector(selector),
      })),
    },
    {
      id: "values",
      title: "Values and math",
      entries: functions.map((fn) => ({
        anchor: fn.anchor,
        label: fn.name,
        since: fn.since,
        html: renderFunction(fn),
      })),
    },
    {
      id: "shapes",
      title: "Shapes",
      entries: shapes.map((shape) => ({
        anchor: `shape-${shape.name}`,
        label: shape.name,
        since: shape.since,
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

  const sections = groupEntries(
    original.flatMap((section) => section.entries).map((entry) => ({
      ...entry,
      label: qualified(entry.anchor, entry.label),
    })),
  );

  return `
    <header>
      <h1>GSS — GPU Style Sheets</h1>
      <p class="tagline">A CSS-like language for 3D scenes, compiled to a GPU shader.</p>
    </header>
    ${renderToc(sections, newestVersion(sections.flatMap((section) => section.entries.map((entry) => entry.since)), published))}
    ${renderTocTimelines(sections)}
    ${sections.map(renderSection).join("\n")}`;
}
