// hover-distance() and hover-direction() glide (decision 216): the place they measure from
// moves from the object hovered before to the one hovered now, and an object under the
// pointer fades in and out, with the transition of the objects that read them. The shader
// gets uPointer: [the object now, the one before, how far the place glided from one to the
// other, how present an object under the pointer is], 0 to 1 for the last two.
import type { Transition } from "../compiler/features/transition";
import { ease } from "./easing";

export function createPointer(transition: Transition | null) {
  let now = 0; // the object the place glides to, the last one hovered
  let before = 0;
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
  return {
    // hovered: the id under the pointer (0: none); at: the time in ms
    update(hovered: number, at: number, instant = false): Float32Array {
      present = presentFrom + (presentTo - presentFrom) * progress(faded, at, instant); // where it is now
      if (hovered !== 0 && hovered !== now) {
        // from nothing, the place starts where it arrives
        moved = present > 0 ? at : -Infinity;
        before = present > 0 ? now : hovered;
        now = hovered;
      }
      const target = hovered === 0 ? 0 : 1;
      if (target !== presentTo) {
        presentFrom = present;
        presentTo = target;
        faded = at;
      }
      present = presentFrom + (presentTo - presentFrom) * progress(faded, at, instant);
      return Float32Array.of(now, before, progress(moved, at, instant), present);
    },
  };
}
