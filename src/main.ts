import gssSource from "./scene.gss?raw";
import { createRenderer } from "./runtime/renderer";
import { connectEditor } from "./runtime/editor";

// The home page: the editor on the left, the scene on the right
const renderer = createRenderer(document.querySelector<HTMLCanvasElement>("#scene")!);

connectEditor(
  {
    textarea: document.querySelector<HTMLTextAreaElement>("#code")!,
    status: document.querySelector<HTMLElement>("#status")!,
    error: document.querySelector<HTMLElement>("#error")!,
  },
  renderer,
  gssSource,
);
