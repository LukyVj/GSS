import "../styles/gss-code.css";
import "../embed/element"; // <gss-scene>: the site uses its own embed (decision 63)

// Use cases, embed ways and the inspiration grid are prerendered
// (src/showcase/prerender.ts). This script only registers <gss-scene> and
// swaps a missing capture for the code preview.

for (const img of document.querySelectorAll<HTMLImageElement>("#gallery .shot img")) {
  img.addEventListener("error", () => {
    const art = img.parentElement;
    if (!art) return;
    const fallback = art.querySelector<HTMLElement>(".fallback");
    img.remove();
    if (fallback) fallback.hidden = false;
  });
}
