import { HEAVY_NOTICE, SOFTWARE_NOTICE, SOFTWARE_PLAY, softwareRendering } from "./software";

// The pages of the site: a render that would freeze the page waits behind a button.
// Without a GPU (decision 137), the renderer is made, the code compiles and the editor shows
// it, but no frame is drawn until the click. With a GPU too slow for the scene (decision 142),
// the view stops on its own after a second or two of frozen frames, and the same notice comes.
// The notice lies over the canvas; its button draws the scene anyway. Returns how to take the
// gate away, for a page that replaces the canvas.
export function renderGate(canvas: HTMLCanvasElement, view: { pause(): void; play(): void }): () => void {
  const software = softwareRendering();
  let close = () => {};
  // Without a GPU, the reader already chose to wait: a slow frame does not stop the scene
  const onHeavy = () => {
    if (software) view.play();
    else close = gate(canvas, HEAVY_NOTICE, () => view.play());
  };
  canvas.addEventListener("gss-too-heavy", onHeavy);
  if (software) {
    view.pause();
    close = gate(canvas, SOFTWARE_NOTICE, () => view.play());
  }
  return () => {
    canvas.removeEventListener("gss-too-heavy", onHeavy);
    close();
  };
}

function gate(canvas: HTMLCanvasElement, text: string, play: () => void): () => void {
  const gate = document.createElement("div");
  gate.className = "software-gate";
  const notice = document.createElement("p");
  notice.textContent = text;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button";
  button.textContent = SOFTWARE_PLAY;
  gate.append(notice, button);
  // A sibling of the canvas: the same offset parent, so its box is the canvas's box
  const place = () => {
    gate.style.left = `${canvas.offsetLeft}px`;
    gate.style.top = `${canvas.offsetTop}px`;
    gate.style.width = `${canvas.offsetWidth}px`;
    gate.style.height = `${canvas.offsetHeight}px`;
  };
  const resized = new ResizeObserver(place);
  resized.observe(canvas);
  canvas.after(gate);
  place();
  const close = () => {
    resized.disconnect();
    gate.remove();
  };
  button.addEventListener("click", () => {
    close();
    play();
  }, { once: true });
  return close;
}
