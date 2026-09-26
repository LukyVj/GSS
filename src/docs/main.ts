import { PROPERTIES } from "../compiler/registry";
import { renderDocs } from "./render";

document.querySelector<HTMLElement>("#docs")!.innerHTML =
  renderDocs(PROPERTIES);
