// Render on demand (decision 134): a frame is drawn only when what it shows can have changed.
// What a frame shows comes from what the shader reads: the size of the canvas, the time when
// the scene moves with it, the camera, how far each :hover and :active has glided, the
// timelines, the variables of @property, and the images. When they are all the same as for
// the last frame drawn, the canvas keeps that frame and the GPU rests.

export type Demand = {
  // Is this state not the one of the last frame drawn? Then it becomes that one.
  need(state: ArrayLike<number>): boolean;
  // Something the state does not hold changed (a new scene): the next frame is drawn
  forget(): void;
};

export function createDemand(): Demand {
  let last: number[] | null = null;
  return {
    need(state) {
      if (last && last.length === state.length) {
        let same = true;
        for (let i = 0; i < state.length && same; i++) same = state[i] === last[i]; // NaN: never the same
        if (same) return false;
      }
      last = Array.from(state);
      return true;
    },
    forget() {
      last = null;
    },
  };
}

// Does the image change with time alone? The shader of the scene, or of one of its passes,
// reads iTime somewhere other than where it declares it
export function movesWithTime(scene: { shader: string; passes?: { shader: string }[] }): boolean {
  return [scene.shader, ...(scene.passes ?? []).map((pass) => pass.shader)].some(
    (shader) => (shader.match(/\biTime\b/g) ?? []).length > (shader.match(/uniform\s+float\s+iTime\s*;/g) ?? []).length,
  );
}
