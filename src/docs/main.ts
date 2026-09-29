import "../styles/tokens.css";
import "../styles/gss-code.css";
import {
  PROPERTIES,
  AT_RULES,
  SELECTORS,
  SHAPE_DOCS,
  FUNCTIONS,
} from "../compiler/registry";
import { renderDocs } from "./render";
import { enableTryIt } from "./playground";
import { enablePages } from "./pages";

const docs = document.querySelector<HTMLElement>("#docs")!;
docs.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
enableTryIt(docs);
enablePages(docs);
