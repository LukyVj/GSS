import "../styles/gss-code.css";
import "../embed/element"; // <gss-scene>: the site uses its own embed (decision 63)
import "./studies"; // the studies viewer, at the top of the page (decision 119)
import { connectArchiveView } from "./archive-view";

// The studies, use cases, embed ways and the archive are prerendered
// (src/showcase/prerender.ts). This script registers <gss-scene>, runs the studies
// viewer, and connects the grid / list switch of the archive (decision 172).

const archive = document.querySelector<HTMLElement>("#scenes");
if (archive) connectArchiveView(archive);
