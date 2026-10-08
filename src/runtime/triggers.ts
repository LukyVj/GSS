// A state that starts an animation (decision 141): once a slot of uHover[] is
// triggered, it stays at 1 until its animation ends, button up or pointer gone, and
// uStart[] tells the shader when it started. A new trigger restarts it, like CSS when
// a class is taken off and put back.
import type { Trigger } from "../compiler";

export function createTriggers(triggers: Trigger[], slots: number) {
  const held = new Float32Array(slots); // the targets, with the held slots at 1
  const starts = new Float32Array(triggers.length); // uStart[]: seconds of iTime
  const previous = new Float32Array(slots); // the raw targets of the last update
  const until = new Map<number, number>(); // slot → when its hold ends (Infinity: never)

  return {
    // targets: 0 or 1 for each slot, from the pointer (pointerValues);
    // now: the time of the shader, in seconds (iTime)
    update(targets: Float32Array, now: number): { targets: Float32Array; starts: Float32Array } {
      held.set(targets);
      for (const trigger of triggers) {
        const { slot, start, hold } = trigger;
        // The state begins: the animation starts now, and the slot holds
        if (targets[slot] === 1 && previous[slot] !== 1) {
          starts[start] = now;
          until.set(slot, hold === null ? Infinity : now + hold);
        }
        const end = until.get(slot);
        if (end !== undefined && now < end) held[slot] = 1;
      }
      previous.set(targets);
      return { targets: held, starts };
    },
    // A new scene: nothing is held, nothing has started
    reset() {
      held.fill(0);
      starts.fill(0);
      previous.fill(0);
      until.clear();
    },
  };
}
