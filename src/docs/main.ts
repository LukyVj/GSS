import { PROPERTIES, AT_RULES } from "../compiler/registry";
import { renderDocs } from "./render";

document.querySelector<HTMLElement>("#docs")!.innerHTML =
  renderDocs(PROPERTIES, AT_RULES);
