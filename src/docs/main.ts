import "../styles/gss-code.css";
import { enableTryIt } from "./playground";
import { enablePages } from "./pages";
import { mountSearch } from "./search-box";

// The reference HTML is injected at build / in dev by src/vite/prerender-site.ts.
// This script only wires the interactive bits (hash pages, Try it, DocSearch).
const docs = document.querySelector<HTMLElement>("#docs")!;
enableTryIt(docs);
enablePages(docs);
mountSearch();
