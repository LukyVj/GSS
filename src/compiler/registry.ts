// The single source of truth for GSS features.
// Every property must be registered here: the documentation is generated
// from this list, and every example is compiled by the tests.

export type Shape = "cube" | "sphere" | "torus"; // Later "cone" | "cylinder" | "line" | "plane" | "mesh" ...

export type PropertyDef = {
  name: string;
  appliesTo: "object" | "scene" | Shape[]; // Shape[]: only these shapes
  syntax: string;
  initial: string;
  description: string;
  examples: string[];
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
    name: "size",
    appliesTo: ["cube"],
    syntax: "<number> | <number>{3}",
    initial: "1",
    description:
      "Sets the size of the cube along the x, y and z axes. One value makes a cube, three values make a box.",
    examples: ["@scene { cube; } cube { translate: 0 0.5 0; size: 2 1 1; }"],
  },
  {
    name: "corner-radius",
    appliesTo: ["cube"],
    syntax: "<number>",
    initial: "0.08",
    description: "Rounds the edges of the cube. 0 gives sharp edges.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; corner-radius: 0.3; }",
    ],
  },
  {
    name: "radius",
    appliesTo: ["sphere", "torus"],
    syntax: "<number>",
    initial: "0.5 (sphere), 1 (torus)",
    description:
      "Sets the radius of the sphere, or the radius of the torus ring, measured to the center of its tube.",
    examples: ["@scene { sphere; } sphere { translate: 0 1 0; radius: 1; }"],
  },
  {
    name: "thickness",
    appliesTo: ["torus"],
    syntax: "<number>",
    initial: "0.28",
    description: "Sets the radius of the torus tube.",
    examples: [
      "@scene { torus; } torus { translate: 0 0.5 0; thickness: 0.5; }",
    ],
  },
  {
    name: "light",
    appliesTo: "scene",
    syntax: "<angle> <angle>",
    initial: "45deg 54.7deg",
    description:
      "Sets the direction of the sun: first its azimuth around the vertical axis (0deg points to +z, 90deg to +x), then its elevation above the horizon (90deg is straight overhead).",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { light: 120deg 30deg; }",
    ],
  },
  {
    name: "ambient",
    appliesTo: "scene",
    syntax: "<number>",
    initial: "0.1",
    description:
      "Sets the minimum light received by surfaces facing away from the sun, from 0 (black shadows) to 1 (no shadows).",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { ambient: 0.4; }",
    ],
  },
  {
    name: "camera-target",
    appliesTo: "scene",
    syntax: "<number>{3}",
    initial: "0 0.5 0",
    description: "Sets the point the camera looks at and orbits around.",
    examples: [
      "@scene { cube; } cube { translate: 0 2 0; } scene { camera-target: 0 2 0; }",
    ],
  },
  {
    name: "camera-distance",
    appliesTo: "scene",
    syntax: "<number>",
    initial: "8",
    description:
      "Sets the starting distance between the camera and its target, from 3 to 15. The mouse wheel changes it.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { camera-distance: 5; }",
    ],
  },
  {
    name: "camera-angle",
    appliesTo: "scene",
    syntax: "<angle> <angle>",
    initial: "0deg 22.9deg",
    description:
      "Sets the starting position of the camera around its target: first the angle around the vertical axis, then the height above the horizon, from 0deg to 80deg. Dragging with the mouse changes it.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { camera-angle: 45deg 60deg; }",
    ],
  },
  {
    name: "camera-spin",
    appliesTo: "scene",
    syntax: "<time> | none",
    initial: "21s",
    description:
      "Sets how long the camera takes to turn once around its target, in s or ms. none stops the automatic rotation.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { camera-spin: 40s; }",
    ],
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
