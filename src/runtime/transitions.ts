// transition: each slot of uHover[] glides from 0 to 1 and back, instead of jumping.
// The shader already mixes rest and :hover with it (decision 62): only the number moves.
import type { Transition } from "../compiler/transition";
import { ease } from "./easing";

type Pair = { enter: Transition | null; leave: Transition | null };

type Glide = {
  from: number;
  to: number;
  start: number; // ms, when the transition starts (the delay included)
  duration: number; // ms
  transition: Transition;
};

export function createTransitions(pairs: Pair[]) {
  const values = new Float32Array(pairs.length); // what the shader gets
  const targets = new Float32Array(pairs.length); // 0 at rest, 1 hovered
  const glides: (Glide | null)[] = pairs.map(() => null);

  return {
    // targets: 0 or 1 for each slot (hoverValues); now: in ms;
    // instant: jump, when motion is reduced (prefers-reduced-motion)
    update(next: Float32Array, now: number, instant = false): Float32Array {
      pairs.forEach((pair, i) => {
        // 1. A new target: start from where the value is
        if (next[i] !== targets[i]) {
          targets[i] = next[i];
          const transition = next[i] > values[i] ? pair.enter : pair.leave;
          // Like CSS: going back halfway takes half the time
          const share = Math.abs(next[i] - values[i]);
          if (!transition || instant || share === 0) {
            values[i] = next[i];
            glides[i] = null;
          } else {
            const { duration, delay } = transition;
            glides[i] = {
              from: values[i],
              to: next[i],
              // a negative delay is shortened too, a positive one is kept (CSS)
              start: now + (delay < 0 ? delay * share : delay) * 1000,
              duration: duration * share * 1000,
              transition,
            };
          }
        }

        // 2. Move along the current glide
        const glide = glides[i];
        if (!glide) return;
        // 0 s after a delay: a jump once the delay is over
        const t =
          glide.duration > 0
            ? (now - glide.start) / glide.duration
            : Number(now >= glide.start);
        if (instant || t >= 1) {
          values[i] = glide.to;
          glides[i] = null;
          return;
        }
        values[i] =
          glide.from +
          (glide.to - glide.from) * ease(glide.transition.easing, t);
      });
      return values;
    },
  };
}
