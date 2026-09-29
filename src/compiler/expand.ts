import type { SceneElement } from "./ast";

// A real object in the scene, after expansion
export type SceneInstance = {
  tag: string;
  id: string | null;
  classes: string[];
  index: number; // its position in the scene, starting from 1: this will be sibling-index()
  groups: SceneInstance[];
};

export function expandScene(elements: SceneElement[]): SceneInstance[] {
  const instances: SceneInstance[] = [];

  // Reads a list of elements. "groups" = the groups we are currently inside
  function walk(elements: SceneElement[], groups: SceneInstance[]): void {
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

        const instance: SceneInstance = {
          tag: element.tag,
          id,
          classes: element.classes,
          index: 0, // a group is never drawn: it keeps 0
          groups,
        };

        if (element.children) {
          // a group: we go inside, one group deeper
          walk(element.children, [...groups, instance]);
        } else {
          instance.index = instances.length + 1;
          instances.push(instance);
        }
      }
    }
  }

  walk(elements, []);
  return instances;
}
