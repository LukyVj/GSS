import type { SceneElement } from "../syntax/ast";

// A real object in the scene, after expansion
export type SceneInstance = {
  tag: string;
  id: string | null;
  classes: string[];
  index: number; // its number among the drawn objects, from 1 (the material id of the shader)
  siblingIndex: number; // its position among its siblings, from 1, like CSS sibling-index()
  siblingCount: number; // how many siblings it has, itself included, like CSS sibling-count()
  groups: SceneInstance[];
};

// Keep the structural nodes separately from the drawable objects. Empty groups
// still occupy a sibling position, but never receive a shader/material index.
const structures = new WeakMap<SceneInstance[], SceneInstance[]>();

export function sceneNodes(instances: SceneInstance[]): SceneInstance[] {
  return (
    structures.get(instances) ?? [
      ...new Set(instances.flatMap((o) => [...o.groups, o])),
    ]
  );
}

export function expandScene(elements: SceneElement[]): SceneInstance[] {
  const instances: SceneInstance[] = [];
  const nodes: SceneInstance[] = [];

  // Reads a list of elements. "groups" = the groups we are currently inside
  function walk(elements: SceneElement[], groups: SceneInstance[]): void {
    // Siblings = everything in the same @scene block or group, multiplied ones counted one by one
    const siblingCount = elements.reduce(
      (sum, element) => sum + element.count,
      0,
    );
    let siblingIndex = 0;
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
          siblingIndex: ++siblingIndex,
          siblingCount,
          groups,
        };

        nodes.push(instance);
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
  structures.set(instances, nodes);
  return instances;
}
