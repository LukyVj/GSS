// Off screen, a scene sleeps: no frames, no GPU, and the clock waits (the animation resumes
// where it was). mount() does it (embed/runtime.ts), and so do the renders of the site that
// scroll with their page: the live demo of the home page and the Try it of the docs.
// pause() and play() are the page's: a scene the page paused stays asleep back on screen.

// Calls change(true or false) when the canvas comes on screen or leaves it; returns how to stop
export function watchScreen(canvas: HTMLCanvasElement, change: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const observer = new IntersectionObserver((entries) => {
    change(entries.some((entry) => entry.isIntersecting));
  });
  observer.observe(canvas);
  return () => observer.disconnect();
}

export function sleepOffscreen(
  canvas: HTMLCanvasElement,
  view: { pause(): void; play(): void },
  watch = watchScreen,
) {
  let visible = true;
  let paused = false; // by the page, with pause(): the screen does not wake it up
  const update = () => (visible && !paused ? view.play() : view.pause());

  const unwatch = watch(canvas, (next) => {
    visible = next;
    update();
  });

  // Too heavy for the computer (decision 142): the view stopped; coming back on screen does
  // not wake it up, only play() from the page
  const onHeavy = () => {
    paused = true;
  };
  canvas.addEventListener("gss-too-heavy", onHeavy);

  return {
    pause() {
      paused = true;
      update();
    },
    play() {
      paused = false;
      update();
    },
    // The canvas goes: stop watching it
    stop() {
      unwatch();
      canvas.removeEventListener("gss-too-heavy", onHeavy);
    },
  };
}
