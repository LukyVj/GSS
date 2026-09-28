import "../styles/gss-code.css";
import { PROPERTIES, AT_RULES } from "../compiler/registry";
import { renderDocs } from "./render";
import { enableTryIt } from "./playground";

const docs = document.querySelector<HTMLElement>("#docs")!;
docs.innerHTML = renderDocs(PROPERTIES, AT_RULES);
enableTryIt(docs);
