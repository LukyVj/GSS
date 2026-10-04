import type { Token } from "./tokenizer";

// The root: the whole file
export type Stylesheet = {
  scene: SceneElement[];
  rules: Rule[];
  keyframes: Keyframes[]; // all the @keyframes blocks
  properties: PropertyRule[]; // the @property rules (decision 105)
  panels: PanelRule[]; // the @property-panel rules (decision 128)
};

// @property-panel { display: open; }
export type PanelRule = {
  at: Token; // the @property-panel keyword (for the errors)
  descriptors: Declaration[];
};

// @property --speed { syntax: "<number>"; inherits: false; initial-value: 4; }
export type PropertyRule = {
  name: Token; // the IDENT after @property, as written (for the errors)
  descriptors: Declaration[];
};

// A line of @scene: cube.corner * 4;
export type SceneElement = {
  tag: string; // "cube"
  id: string | null; // "hero", or null if there is no
  classes: string[]; // ["corner"]
  count: number; // 4 (1 by default)
  children?: SceneElement[]; // for groups
};

// A rule: torus#hero { radius: 1 0.28; }
export type Rule = {
  selector: Token[]; // for now, we keep the raw tokens
  declarations: Declaration[];
  media?: string; // inside @media (max-width: 600px) { … }: the query, as text
};

// A declaration: radius: 1 0.28;
export type Declaration = {
  property: string; // "radius"
  value: Token[]; // [NUMBER 1, NUMBER 0.28]
  important?: boolean; // false (optional)
};

// @keyframes float { from { … } to { … } }
export type Keyframes = {
  name: string; // "float"
  frames: Keyframe[];
};

// from { translate: 0 1 0; }
export type Keyframe = {
  offsets: Token[]; // [IDENT from], [PERCENTAGE 50], or [0%, 100%] without the comma
  declarations: Declaration[];
};
