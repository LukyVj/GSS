import type { Token } from "./tokenizer";

// La racine : tout le fichier
export type Stylesheet = {
  scene: SceneElement[]; // le contenu de @scene
  rules: Rule[]; // toutes les règles de style
};

// Une ligne de @scene : cube.corner * 4;
export type SceneElement = {
  tag: string; // "cube"
  id: string | null; // "hero", ou null s'il n'y en a pas
  classes: string[]; // ["corner"]
  count: number; // 4 (1 par défaut)
};

// Une règle : torus#hero { radius: 1 0.28; }
export type Rule = {
  selector: Token[]; // pour l'instant, on garde les tokens bruts
  declarations: Declaration[];
};

// Une déclaration : radius: 1 0.28;
export type Declaration = {
  property: string; // "radius"
  value: Token[]; // [NUMBER 1, NUMBER 0.28]
};
