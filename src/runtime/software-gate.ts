import { SOFTWARE_NOTICE, SOFTWARE_PLAY, softwareRendering } from "./software";

// The pages of the site: without a GPU, the render waits behind a button (decision 137).
// The renderer is made, the code compiles and the editor shows it, but no frame is drawn
// until the click; the notice lies over the canvas. With a GPU, nothing waits.
export function softwareGate(canvas: HTMLCanvasElement, view: { pause(): void; play(): void }): void {
  if (!softwareRendering()) return;
  view.pause();
  const gate = document.createElement("div");
  gate.className = "software-gate";
  const notice = document.createElement("p");
  notice.textContent = SOFTWARE_NOTICE;
  const play = document.createElement("button");
  play.type = "button";
  play.className = "button";
  play.textContent = SOFTWARE_PLAY;
  gate.append(notice, play);
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
  play.addEventListener("click", () => {
    resized.disconnect();
    gate.remove();
    view.play();
  }, { once: true });
}
