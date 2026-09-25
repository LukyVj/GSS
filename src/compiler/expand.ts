import type { SceneElement } from "./ast";

// Un objet réel de la scène, après dépliage
export type SceneInstance = {
  tag: string;
  id: string | null;
  classes: string[];
  index: number; // sa position dans la scène, à partir de 1 : ce sera sibling-index()
};

export function expandScene(elements: SceneElement[]): SceneInstance[] {
  const instances: SceneInstance[] = [];

  for (const element of elements) {
    for (let n = 1; n <= element.count; n++) {
      let id: string | null;
      if (element.id === null) {
        id = null; // pas d'id : on n'en invente pas
      } else if (element.count === 1) {
        id = element.id; // un seul objet : on garde "hero"
      } else {
        id = `${element.id}-${n}`; // plusieurs : "hero-1", "hero-2"...
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
