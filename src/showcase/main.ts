import "../styles/gss-code.css";
import "../embed/element"; // <gss-scene>: the site uses its own embed (decision 63)
import { highlightCode } from "../docs/highlight-code";
import { escapeHtml } from "../docs/escape";
import { encodeCode } from "../runtime/share";
import {
  USE_CASES,
  EMBED_SNIPPETS,
  INSPIRATION,
  type UseCase,
} from "./content";

// showcase.html: the use cases by audience, the three ways to embed, the inspiration grid.

const code = (lang: "gss" | "html" | "js", text: string) =>
  `<pre class="snippet"><code class="gss">${highlightCode(lang, text)}</code></pre>`;

const playgroundLink = async (source: string) =>
  `./playground.html${await encodeCode(source)}`;

// ----- Use cases: a live <gss-scene>, then the words, the code, the docs it uses -----
function renderCase(useCase: UseCase): HTMLElement {
  const article = document.createElement("article");
  article.className = "case";
  article.id = useCase.slug;

  const scene = document.createElement("gss-scene");
  const source = document.createElement("script");
  source.type = "text/gss";
  source.textContent = useCase.scene;
  scene.append(source);

  const features = useCase.features
    .map(
      ([label, anchor]) =>
        `<a class="feature" href="./docs.html#${escapeHtml(anchor)}"><code>${escapeHtml(label)}</code></a>`,
    )
    .join("");

  const text = document.createElement("div");
  text.className = "text";
  text.innerHTML = `
    <h3>${escapeHtml(useCase.title)}</h3>
    <p class="pitch">${escapeHtml(useCase.pitch)}</p>
    ${code(useCase.snippet.lang, useCase.snippet.code)}
    <p class="links"><a class="open" href="./playground.html">open in playground ↗</a><span>uses</span>${features}</p>`;
  void playgroundLink(useCase.scene).then((href) => {
    text.querySelector<HTMLAnchorElement>(".open")!.href = href;
  });

  article.append(scene, text);
  return article;
}

for (const grid of document.querySelectorAll<HTMLElement>("[data-audience]")) {
  grid.append(
    ...USE_CASES.filter(
      (useCase) => useCase.audience === grid.dataset.audience,
    ).map(renderCase),
  );
}

// ----- On your site: the three ways -----
document.querySelector("#ways")!.innerHTML = EMBED_SNIPPETS.map(
  (way) => `
    <div class="way">
      <header><b>${escapeHtml(way.title)}</b><span>${escapeHtml(way.who)}</span></header>
      ${code(way.lang, way.code)}
    </div>`,
).join("");

// ----- Inspiration: a capture (npm run captures), or the code while there is none -----
const gallery = document.querySelector<HTMLElement>("#gallery")!;
for (const entry of INSPIRATION) {
  const card = document.createElement("a");
  card.className = "shot";
  card.href = "./playground.html";
  card.innerHTML = `
    <div class="art"><img src="/showcase/${entry.slug}.jpg" alt="${escapeHtml(entry.title)}" loading="lazy" /></div>
    <footer><span class="name">${escapeHtml(entry.title)}</span><span class="go">open ↗</span></footer>`;
  card.querySelector("img")!.addEventListener("error", (event) => {
    const art = (event.target as HTMLElement).parentElement!;
    art.innerHTML = `<pre>${escapeHtml(entry.code.split("\n").slice(0, 14).join("\n"))}</pre>`;
  });
  void playgroundLink(entry.code).then((href) => (card.href = href));
  gallery.append(card);
}
