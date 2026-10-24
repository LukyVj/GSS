// hover-distance() and hover-direction() measure from the point under the pointer (decision
// 217), and glide (decision 216): the place moves to the point under the pointer from where it
// is, and the pointer fades in and out over the canvas, with the transition of the objects that
// read them. The shader gets uPointer: [the pixel of the place, x and y, how far along its ray,
// how present the pointer is, 0 to 1]; it casts the ray of that pixel itself.
import type { Transition } from "../compiler/features/transition";
import { ease } from "./easing";

// A pixel of the canvas, y up like the picking pass, and how far along its ray
export type PointerTarget = [x: number, y: number, depth: number];

export function createPointer(transition: Transition | null) {
  let from: PointerTarget = [0, 0, 0]; // where the place glides from and to
  let to: PointerTarget | null = null;
  let moved = -Infinity; // when the place started to glide, in ms
  let present = 0; // the presence, and where it glides from and to
  let presentFrom = 0;
  let presentTo = 0;
  let faded = -Infinity;
  // how far a glide that started at `start` has gone, eased
  const progress = (start: number, at: number, instant: boolean) => {
    if (!transition || instant) return 1;
    const t = transition.duration > 0 ? (at - start - transition.delay * 1000) / (transition.duration * 1000) : Number(at - start >= transition.delay * 1000);
    return ease(transition.easing, t);
  };
  const place = (at: number, instant: boolean): PointerTarget => {
    if (!to) return from;
    const k = progress(moved, at, instant);
    return [0, 1, 2].map((i) => from[i] + (to![i] - from[i]) * k) as PointerTarget;
  };
  return {
    // target: the point under the pointer (null: the pointer is not over the canvas); at: the time in ms
    update(target: PointerTarget | null, at: number, instant = false): Float32Array {
      present = presentFrom + (presentTo - presentFrom) * progress(faded, at, instant); // where it is now
      if (target && (!to || target.some((v, i) => v !== to![i]))) {
        // from nothing, the place starts where it arrives; else from where it is, like CSS
        from = present > 0 ? place(at, instant) : target;
        moved = present > 0 ? at : -Infinity;
        to = target;
      }
      const presence = target ? 1 : 0;
      if (presence !== presentTo) {
        presentFrom = present;
        presentTo = presence;
        faded = at;
      }
      present = presentFrom + (presentTo - presentFrom) * progress(faded, at, instant);
      return Float32Array.of(...place(at, instant), present);
    },
  };
}
