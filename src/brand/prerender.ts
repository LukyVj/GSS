import { DOC_GROUPS } from "../docs/navigation";
import { navIcon, navIconFile, navIconMotion } from "../docs/nav-icons";
import { escapeHtml } from "../docs/escape";

// Fills the doc icons of the brand page at build (and in dev) from the icons of the docs
// sidebar, so the two never differ. Each link holds its file, so there is no copy to keep.

const PLACE = '<div class="grid doc-icons" id="doc-icons"></div>';

// "Lighting and fog" → "docs-lighting-and-fog.svg"
export function iconFileName(title: string): string {
  return `docs-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.svg`;
}

export function prerenderBrandHtml(html: string): string {
  if (!html.includes(PLACE)) throw new Error(`prerender brand: expected ${PLACE}`);
  const tiles = [...DOC_GROUPS]
    .sort((a, b) => a.order - b.order)
    .map(
      (group) => `
          <figure class="tile doc-icon" style="margin: 0">
            <div class="art">${navIcon(group.id, "large")}${navIcon(group.id, "small")}</div>
            <footer>
              <span class="name">${escapeHtml(group.title)}</span>
              <a href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(navIconFile(group.id))}" download="${iconFileName(group.title)}">svg</a>
            </footer>
          </figure>`,
    )
    .join("");
  const motion = `<style>${navIconMotion(".doc-icon:hover")}</style>`;
  return html.replace(PLACE, `${motion}\n        ${PLACE.replace("></div>", `>${tiles}\n        </div>`)}`);
}
