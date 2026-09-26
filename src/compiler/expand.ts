import type { SceneElement } from "./ast";

// A real object in the scene, after expansion
export type SceneInstance = {
  tag: string;
  id: string | null;
  classes: string[];
  index: number; // its position in the scene, starting from 1: this will be sibling-index()
};

export function expandScene(elements: SceneElement[]): SceneInstance[] {
  const instances: SceneInstance[] = [];

  for (const element of elements) {
    for (let n = 1; n <= element.count; n++) {
      let id: string | null;
      if (element.id === null) {
        id = null; // no id: we don't invent one
      } else if (element.count === 1) {
        id = element.id; // one object: we keep "hero"
      } else {
        id = `${element.id}-${n}`; // several: "hero-1", "hero-2"...
      }
      instances.push({
        tag: element.tag,
        id,
        classes: element.classes,
        index: instances.length + 1,
      });
    }
  }

  return instances;
}
