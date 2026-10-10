import "../styles/gss-code.css";
import { enableTryIt } from "./playground";
import { enablePages } from "./pages";
import { mountSearch } from "./search-box";
import { enableVariableDemos } from "./variables-demo";
import { enableFigures } from "./figure-motion";
import "../embed/element"; // <gss-scene>, for the live demo of "Set variables from JavaScript"

// The reference HTML is injected at build / in dev by src/vite/prerender-site.ts.
// This script only wires the interactive bits (hash pages, Try it, live demos, DocSearch).
const docs = document.querySelector<HTMLElement>("#docs")!;
enableTryIt(docs);
enablePages(docs);
enableVariableDemos(docs);
enableFigures(docs);
mountSearch();
