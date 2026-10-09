import { highlightCode } from "../docs/highlight-code";
import { escapeHtml } from "../docs/escape";
import { encodeCode } from "../runtime/share";
import { compareVersions } from "../docs/news";
import { VERSION } from "../version";
import { USE_CASES, EMBED_SNIPPETS, STUDIES, type UseCase } from "./content";
import { ARCHIVE, type ArchiveEntry } from "./archive";

// HTML of the showcase grids, built as strings so Vite can inject it at build time.

const snippet = (lang: "gss" | "html" | "js", text: string) =>
  `<pre class="snippet"><code class="gss">${highlightCode(lang, text)}</code></pre>`;

// <script> text must not contain a literal </script>
function scriptText(text: string): string {
  return text.replace(/<\/(script)/gi, "<\\/$1");
}

// The studies viewer: the first study and the list, ready before studies.ts mounts it.
// The viewer shows the poster of the study and a play button until the reader asks for it.
export function renderLabHtml(playgroundHref: string): string {
  const [first] = STUDIES;
  const list = STUDIES.map(
    (study, i) =>
      `<li><button type="button" data-study="${escapeHtml(study.key)}" aria-pressed="${i === 0}"><span class="n">${String(i + 1).padStart(2, "0")}</span>${escapeHtml(study.name)}</button></li>`,
  ).join("");
  const features = first.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
  return `<article class="study" aria-labelledby="study-title">
    <p class="eyebrow" id="study-eyebrow">${escapeHtml(first.eyebrow)}</p>
    <h3 id="study-title">${escapeHtml(first.title)}</h3>
    <p class="lead" id="study-description">${escapeHtml(first.description)}</p>
    <ul class="features" id="study-features" aria-label="What it uses">${features}</ul>
    <div class="actions">
      <a class="button primary" id="study-edit" href="${escapeHtml(playgroundHref)}">open in the playground →</a>
      <a class="reference" id="study-reference" target="_blank" rel="noopener noreferrer" hidden></a>
    </div>
    <nav class="studies" aria-label="Choose a study">
      <p class="eyebrow">Studies</p>
      <ol>${list}</ol>
    </nav>
  </article>
  <div class="viewport">
    <canvas aria-label="The study, rendered live with GSS"></canvas>
    <img class="poster" id="study-poster" src="/showcase/${escapeHtml(first.key)}.jpg" alt="" />
    <button type="button" class="play" id="study-play" aria-label="Play ${escapeHtml(first.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg></button>
    <div class="statusbar" id="study-statusbar">
      <span class="dot" aria-hidden="true"></span>
      <span id="study-status" role="status">paused · press play</span>
      <span class="spacer"></span>
      <span id="study-hint">${escapeHtml(first.hint)}</span>
    </div>
  </div>`;
}

export function renderCaseHtml(useCase: UseCase, playgroundHref: string): string {
  const features = useCase.features
    .map(
      ([label, anchor]) =>
        `<a class="feature" href="./docs.html#${escapeHtml(anchor)}"><code>${escapeHtml(label)}</code></a>`,
    )
    .join("");
  return `<article class="case" id="${escapeHtml(useCase.slug)}">
  <gss-scene><script type="text/gss">${scriptText(useCase.scene)}</script></gss-scene>
  <div class="text">
    <h3>${escapeHtml(useCase.title)}</h3>
    <p class="pitch">${escapeHtml(useCase.pitch)}</p>
    ${snippet(useCase.snippet.lang, useCase.snippet.code)}
    <p class="links"><a class="open" href="${escapeHtml(playgroundHref)}">open in playground ↗</a><span>uses</span>${features}</p>
  </div>
</article>`;
}

export function renderWaysHtml(): string {
  return EMBED_SNIPPETS.map(
    (way) => `
    <div class="way">
      <header><b>${escapeHtml(way.title)}</b><span>${escapeHtml(way.who)}</span></header>
      ${snippet(way.lang, way.code)}
    </div>`,
  ).join("");
}

// The archive (decision 172): every scene of the page, as a grid of cards or a list. Each
// shows its capture (or the first lines of its code), the version it came with, what it is
// and the features it uses; a card shows the first six. A study opens in the viewer above.
const CARD_FEATURES = 6;

function renderEntryHtml(entry: ArchiveEntry, href: string, newest: string | null): string {
  const preview = escapeHtml(entry.code.split("\n").slice(0, 14).join("\n"));
  const link = entry.study
    ? `href="#${escapeHtml(entry.study)}" data-open-study="${escapeHtml(entry.study)}"`
    : `href="${escapeHtml(href)}"`;
  const fresh = entry.since === newest;
  const since = `<span class="since${fresh ? " new" : ""}" title="${fresh ? "New in" : "Since"} GSS ${escapeHtml(entry.since)}">v${escapeHtml(entry.since)}</span>`;
  const features = entry.features
    .map((feature) => `<li><a href="./docs.html#${escapeHtml(feature.anchor)}"><code>${escapeHtml(feature.label)}</code></a></li>`)
    .join("");
  const more = entry.features.length > CARD_FEATURES ? `<li class="more">+${entry.features.length - CARD_FEATURES}</li>` : "";
  return `<li class="entry">
      <a class="art" ${link} tabindex="-1" aria-hidden="true">
        <img src="/showcase/${escapeHtml(entry.slug)}.jpg" alt="" loading="lazy" />
        <pre class="fallback" hidden>${preview}</pre>
      </a>
      <div class="text">
        <a class="name" ${link}><h3>${escapeHtml(entry.name)}</h3></a>
        <p class="description">${escapeHtml(entry.description)}</p>
        ${features ? `<ul class="uses" aria-label="Uses">${features}${more}</ul>` : ""}
      </div>
      <p class="meta">${since}<span class="go">${entry.study ? "study ↑" : "open ↗"}</span></p>
    </li>`;
}

export function renderArchiveHtml(entries: { entry: ArchiveEntry; href: string }[], published = VERSION): string {
  // The newest version with scenes that is out: theirs say "new"
  const newest = entries
    .map(({ entry }) => entry.since)
    .filter((since) => compareVersions(since, published) <= 0)
    .reduce<string | null>((top, since) => (top === null || compareVersions(since, top) > 0 ? since : top), null);
  return `<div class="toolbar">
      <p class="count">${entries.length} scenes, newest first</p>
      <div class="views" role="group" aria-label="Show the archive as">
        <button type="button" data-view="grid" aria-pressed="true">grid</button>
        <button type="button" data-view="list" aria-pressed="false">list</button>
      </div>
    </div>
    <ol class="entries">${entries.map(({ entry, href }) => renderEntryHtml(entry, href, newest)).join("")}</ol>`;
}

export async function prerenderShowcaseHtml(html: string): Promise<string> {
  const playgroundOf = async (source: string) => `./playground.html${await encodeCode(source)}`;

  let out = html;
  const lab = '<div class="lab" id="lab"></div>';
  if (!out.includes(lab)) {
    throw new Error("prerender showcase: missing #lab");
  }
  out = out.replace(
    lab,
    `<div class="lab" id="lab">${renderLabHtml(await playgroundOf(STUDIES[0].scene))}</div>`,
  );

  for (const audience of ["designers", "creative coders", "developers"] as const) {
    const cases = (
      await Promise.all(
        USE_CASES.filter((useCase) => useCase.audience === audience).map(async (useCase) =>
          renderCaseHtml(useCase, await playgroundOf(useCase.scene)),
        ),
      )
    ).join("");
    const needle = `<div class="grid" data-audience="${audience}"></div>`;
    if (!out.includes(needle)) {
      throw new Error(`prerender showcase: missing ${needle}`);
    }
    out = out.replace(needle, `<div class="grid" data-audience="${audience}">${cases}</div>`);
  }

  const ways = renderWaysHtml();
  if (!out.includes('<div class="grid ways" id="ways"></div>')) {
    throw new Error('prerender showcase: missing #ways');
  }
  out = out.replace(
    '<div class="grid ways" id="ways"></div>',
    `<div class="grid ways" id="ways">${ways}</div>`,
  );

  const archive = renderArchiveHtml(
    await Promise.all(ARCHIVE.map(async (entry) => ({ entry, href: await playgroundOf(entry.code) }))),
  );
  const shell = '<div class="archive" id="scenes"></div>';
  if (!out.includes(shell)) {
    throw new Error("prerender showcase: missing #scenes");
  }
  out = out.replace(shell, `<div class="archive" id="scenes" data-view="grid">${archive}</div>`);

  return out;
}
