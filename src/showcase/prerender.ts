import { highlightCode } from "../docs/highlight-code";
import { escapeHtml } from "../docs/escape";
import { encodeCode } from "../runtime/share";
import {
  USE_CASES,
  EMBED_SNIPPETS,
  INSPIRATION,
  STUDIES,
  type UseCase,
  type Inspiration,
} from "./content";

// HTML of the showcase grids, built as strings so Vite can inject it at build time.

const snippet = (lang: "gss" | "html" | "js", text: string) =>
  `<pre class="snippet"><code class="gss">${highlightCode(lang, text)}</code></pre>`;

// <script> text must not contain a literal </script>
function scriptText(text: string): string {
  return text.replace(/<\/(script)/gi, "<\\/$1");
}

// The studies viewer: the first study and the list, ready before studies.ts mounts it
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
    <div class="statusbar" id="study-statusbar">
      <span class="dot" aria-hidden="true"></span>
      <span id="study-status" role="status">preparing the study…</span>
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

export function renderShotHtml(entry: Inspiration, playgroundHref: string): string {
  const preview = escapeHtml(entry.code.split("\n").slice(0, 14).join("\n"));
  return `<a class="shot" href="${escapeHtml(playgroundHref)}">
    <div class="art">
      <img src="/showcase/${escapeHtml(entry.slug)}.jpg" alt="${escapeHtml(entry.title)}" loading="lazy" />
      <pre class="fallback" hidden>${preview}</pre>
    </div>
    <footer><span class="name">${escapeHtml(entry.title)}</span><span class="go">open ↗</span></footer>
  </a>`;
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

  const gallery = (
    await Promise.all(
      INSPIRATION.map(async (entry) => renderShotHtml(entry, await playgroundOf(entry.code))),
    )
  ).join("");
  if (!out.includes('<div class="grid gallery" id="gallery"></div>')) {
    throw new Error('prerender showcase: missing #gallery');
  }
  out = out.replace(
    '<div class="grid gallery" id="gallery"></div>',
    `<div class="grid gallery" id="gallery">${gallery}</div>`,
  );

  return out;
}
