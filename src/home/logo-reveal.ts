import { mount, type EmbeddedScene } from "../embed";
import heroLogo from "./hero-logo.gss?raw";

export type LogoReveal = {
  setValue(next: number): void;
  destroy(): void;
};

const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// SVG in front, living GSS behind; a bar reveals the shader.
export function createLogoReveal(
  svg: SVGSVGElement,
  { initial = 50 }: { initial?: number } = {},
): LogoReveal {
  const root = document.createElement("div");
  root.className = "gss-compare";

  root.innerHTML = `
    <canvas
      class="gss-compare__canvas"
      aria-hidden="true"
    ></canvas>

    <div class="gss-compare__front"></div>
    <div class="gss-compare__divider"></div>

    <button
      type="button"
      class="gss-compare__handle"
      role="slider"
      aria-label="Proportion of the logo shown in GSS"
      aria-orientation="horizontal"
      aria-valuemin="0"
      aria-valuemax="100"
    >↔</button>

    <span class="gss-compare__label gss-compare__label--gss">GSS · live</span>
    <span class="gss-compare__label gss-compare__label--svg">SVG · flat</span>
    <span class="gss-compare__hint">drag to reveal the shader</span>
  `;

  svg.before(root);
  root.querySelector(".gss-compare__front")!.append(svg);

  let scene: EmbeddedScene;

  try {
    scene = mount(
      root.querySelector("canvas")!,
      heroLogo,
      { controls: false },
    );
  } catch (error) {
    root.replaceWith(svg);
    throw error;
  }

  const handle = root.querySelector("button")!;
  const events = new AbortController();
  const options = { signal: events.signal };

  let value = initial;
  let pointer: number | null = null;
  let intro: number | null = null;
  let interacting = false;

  function setValue(next: number): void {
    value = Math.max(0, Math.min(100, next));
    root.style.setProperty("--split", `${value}%`);

    handle.setAttribute("aria-valuenow", String(Math.round(value)));
    handle.setAttribute(
      "aria-valuetext",
      `${Math.round(value)} % GSS, ${Math.round(100 - value)} % SVG`,
    );

    if (value === 0) scene.pause();
    else scene.play();
  }

  function markInteracting(): void {
    if (interacting) return;
    interacting = true;
    root.classList.add("is-interacting");
    if (intro !== null) {
      cancelAnimationFrame(intro);
      intro = null;
    }
  }

  function updateFromPointer(event: PointerEvent): void {
    const bounds = root.getBoundingClientRect();
    if (bounds.width > 0) {
      setValue(((event.clientX - bounds.left) / bounds.width) * 100);
    }
  }

  root.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.isPrimary || event.button !== 0 || pointer !== null) return;

      markInteracting();
      pointer = event.pointerId;
      root.classList.add("is-dragging");
      root.setPointerCapture(pointer);
      handle.focus({ preventScroll: true });
      updateFromPointer(event);
    },
    options,
  );

  root.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerId === pointer) updateFromPointer(event);
    },
    options,
  );

  function stopDragging(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;

    const id = pointer;
    pointer = null;
    root.classList.remove("is-dragging");

    if (root.hasPointerCapture(id)) root.releasePointerCapture(id);
  }

  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    root.addEventListener(type, stopDragging, options);
  }

  handle.addEventListener(
    "keydown",
    (event) => {
      const step = event.shiftKey ? 10 : 1;
      const values: Record<string, number> = {
        ArrowLeft: value - step,
        ArrowDown: value - step,
        ArrowRight: value + step,
        ArrowUp: value + step,
        Home: 0,
        End: 100,
      };

      if (!(event.key in values)) return;

      markInteracting();
      event.preventDefault();
      setValue(values[event.key]!);
    },
    options,
  );

  // Cinematic intro: peek the living GSS, then rest where both read at once.
  function playIntro(): void {
    if (prefersReducedMotion()) {
      setValue(initial);
      return;
    }

    const start = performance.now();
    const from = 10;
    const peak = 88;
    const settle = initial;
    const outMs = 1600;
    const backMs = 1100;
    const holdMs = 350;

    const ease = (t: number) => 1 - (1 - t) ** 3;

    const tick = (now: number) => {
      if (interacting) return;

      const elapsed = now - start;
      if (elapsed < outMs) {
        setValue(from + (peak - from) * ease(elapsed / outMs));
      } else if (elapsed < outMs + holdMs) {
        setValue(peak);
      } else if (elapsed < outMs + holdMs + backMs) {
        const t = (elapsed - outMs - holdMs) / backMs;
        setValue(peak + (settle - peak) * ease(t));
      } else {
        setValue(settle);
        intro = null;
        return;
      }

      intro = requestAnimationFrame(tick);
    };

    setValue(from);
    intro = requestAnimationFrame(tick);
  }

  // Start once the hero is on screen, so the sweep isn't missed above the fold.
  const reveal = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      reveal.disconnect();
      playIntro();
    },
    { threshold: 0.45 },
  );
  reveal.observe(root);

  function destroy(): void {
    events.abort();
    reveal.disconnect();
    if (intro !== null) cancelAnimationFrame(intro);
    scene.destroy();
    root.replaceWith(svg);
  }

  // Too heavy for this computer (decision 142): the SVG stays alone, as without a GPU
  root.querySelector("canvas")!.addEventListener("gss-too-heavy", destroy, options);

  return { setValue, destroy };
}
