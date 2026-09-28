import "../styles/gss-code.css";
import {
  PROPERTIES,
  AT_RULES,
  SELECTORS,
  SHAPE_DOCS,
} from "../compiler/registry";
import { renderDocs } from "./render";
import { enableTryIt } from "./playground";

const docs = document.querySelector<HTMLElement>("#docs")!;
docs.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS);
enableTryIt(docs);
