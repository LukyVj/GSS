// The single source of truth for GSS features.
// Every property must be registered here: the documentation is generated
// from this list, and every example is compiled by the tests.

export type PropertyDef = {
  name: string; // "rotate-x"
  appliesTo: "object" | "scene"; // styles an object, or the scene itself
  syntax: string; // CSS-like value syntax, e.g. "<angle>"
  initial: string; // the value used when the property is not set
  description: string; // one or two sentences
  examples: string[]; // complete GSS sources, compiled by the tests
};

export const PROPERTIES: PropertyDef[] = [
  {
    name: "translate",
    appliesTo: "object",
    syntax: "<number>{3}",
    initial: "0 0 0",
    description:
      "Moves the object along the x, y and z axes. The y axis points up, and the floor is at y = 0.",
    examples: ["@scene { cube; } cube { translate: 0 0.5 0; }"],
  },
  {
    name: "color",
    appliesTo: "object",
    syntax: "<hex-color>",
    initial: "#e6e6e6",
    description: "Sets the base color of the object's surface.",
    examples: ["@scene { sphere; } sphere { color: #ff5a36; }"],
  },
  {
    name: "rotate-x",
    appliesTo: "object",
    syntax: "<angle>",
    initial: "0deg",
    description: "Rotates the object around the x axis.",
    examples: ["@scene { cube; } cube { rotate-x: 45deg; }"],
  },
  {
    name: "rotate-y",
    appliesTo: "object",
    syntax: "<angle>",
    initial: "0deg",
    description: "Rotates the object around the y axis.",
    examples: ["@scene { cube; } cube { rotate-y: 45deg; }"],
  },
  {
    name: "rotate-z",
    appliesTo: "object",
    syntax: "<angle>",
    initial: "0deg",
    description: "Rotates the object around the z axis.",
    examples: ["@scene { cube; } cube { rotate-z: 45deg; }"],
  },
  {
    name: "scale",
    appliesTo: "object",
    syntax: "<number>",
    initial: "1.0",
    description: "Scales the object along the x, y and z axes.",
    examples: ["@scene { cube; } cube { scale: 2.0; }"],
  },
  {
    name: "floor",
    appliesTo: "scene",
    syntax: "<hex-color>",
    initial: "#e8e3db",
    description:
      "Sets the color of the floor, an infinite plane at y = 0 that is lit like the objects.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { floor: #1a1a1f; }",
    ],
  },
  {
    name: "background",
    appliesTo: "scene",
    syntax: "<hex-color>",
    initial: "#080808",
    description:
      "Sets the color of the background, visible wherever there is no object and no floor.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { background: #42429f; }",
    ],
  },
];
