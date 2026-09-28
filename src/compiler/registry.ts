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
  animatable?: boolean; // can be changed by @keyframes (decision 24)
};

// A block of the language: @scene, @keyframes
export type AtRuleDef = {
  name: string; // without the @: "keyframes"
  syntax: string;
  description: string;
  examples: string[];
};

export const PROPERTIES: PropertyDef[] = [
  {
    name: "translate",
    appliesTo: "object",
    animatable: true,
    syntax: "<number>{3}",
    initial: "0 0 0",
    description:
      "Moves the object along the x, y and z axes. The y axis points up, and the floor is at y = 0.",
    examples: ["@scene { cube; } cube { translate: 0 0.5 0; }"],
  },
  {
    name: "color",
    appliesTo: "object",
    animatable: true,
    syntax: "<hex-color>",
    initial: "#e6e6e6",
    description: "Sets the base color of the object's surface.",
    examples: ["@scene { sphere; } sphere { color: #ff5a36; }"],
  },
  {
    name: "material",
    appliesTo: "object",
    syntax:
      "matte([<hex-color>]) | metal([<hex-color>,] [<roughness>]) | jelly([<hex-color>,] [<density>]) | gold | chrome | jelly | glass([<hex-color>,] [<refraction-index>] [, <frost>]) | glass | ice",
    initial: "matte()",
    description:
      "Sets how the surface of the object reacts to light. matte() only scatters light, like chalk. metal() reflects the scene: roughness goes from 0, a mirror, to 1, a brushed metal (0.2 by default). Without a color, the material uses the color property, like currentColor in CSS, so color stays animatable. jelly() lets light through its thin parts, like a gummy candy: density goes from 0, clear, to 1, deep (0.5 by default). gold, chrome and jelly are shortcuts for metal(#d4af37, 0.2), metal(#ffffff, 0.05) and jelly(). glass() lets you see through the object, bent by its refraction index (1 to 3, 1.5 by default: 1.33 is water, 2.4 is diamond); frost blurs what's behind. glass is glass(), ice is glass(#cfeaff, 1.31, 0.25).",
    examples: [
      "@scene { sphere; } sphere { color: #ff5a36; material: matte(); }",
      "@scene { sphere#a; sphere#b; sphere#c; } #a { translate: -1.3 0.6 0; radius: 0.6; material: gold; } #b { translate: 0 0.6 0; radius: 0.6; material: chrome; } #c { translate: 1.3 0.6 0; radius: 0.6; color: #d4af37; material: metal(0.7); }",
      "@scene { sphere; cube; } sphere { translate: -0.8 0.6 0; radius: 0.6; color: #ff5a36; material: jelly; } cube { translate: 0.8 0.5 0; rotate-y: 30deg; color: #3ad16b; material: jelly(0.3); }",
      "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass; }",
      "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass(#ffffff, 1.5, 0.3); }",
      "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: ice; }",
      "@scene { sphere; cube; } sphere { translate: 0 0.7 0; radius: 0.6; material: glass; } cube { translate: 0.3 0.5 -1.5; color: #ff5a36; }",
    ],
  },
  {
    name: "rotate-x",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description: "Rotates the object around the x axis.",
    examples: ["@scene { cube; } cube { rotate-x: 45deg; }"],
  },
  {
    name: "rotate-y",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description: "Rotates the object around the y axis.",
    examples: ["@scene { cube; } cube { rotate-y: 45deg; }"],
  },
  {
    name: "rotate-z",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description: "Rotates the object around the z axis.",
    examples: ["@scene { cube; } cube { rotate-z: 45deg; }"],
  },
  {
    name: "scale",
    appliesTo: "object",
    animatable: true,
    syntax: "<number>",
    initial: "1.0",
    description: "Scales the object along the x, y and z axes.",
    examples: ["@scene { cube; } cube { scale: 2.0; }"],
  },
  {
    name: "operation",
    appliesTo: "object",
    syntax: "union | subtract | intersect",
    initial: "union",
    description:
      "Sets how the object combines with the objects declared before it in @scene: union adds it, subtract carves it out of them, intersect keeps only their common part. The floor is never affected.",
    examples: [
      "@scene { cube; sphere; } cube { translate: 0 1 0; } sphere { translate: 0 1 0; radius: 0.65; operation: subtract; }",
    ],
  },
  {
    name: "blend",
    appliesTo: "object",
    syntax: "<number>",
    initial: "0",
    description:
      "Smooths the junction between the object and the objects declared before it, over the given distance. 0 keeps a sharp junction. Works with every operation.",
    examples: [
      "@scene { sphere#a; sphere#b; } #a { translate: -0.4 1 0; } #b { translate: 0.4 1 0; blend: 0.4; }",
    ],
  },
  {
    name: "animation",
    appliesTo: "object",
    syntax: "<keyframes-name> <time> [linear | ease-in-out] [alternate]",
    initial: "none",
    description:
      "Plays a @keyframes animation on the object, in a loop. The duration is in s or ms. alternate plays it forward then backward. ease-in-out slows down each step at both ends; linear, the default, keeps a constant speed. Animatable properties: translate, rotate-x, rotate-y, rotate-z, scale and color.",
    examples: [
      "@scene { sphere; } sphere { animation: float 2s ease-in-out alternate; } @keyframes float { from { translate: 0 1 0; } to { translate: 0 2 0; } }",
      "@scene { cube; } cube { translate: 0 0.5 0; animation: bounce 1s; } @keyframes bounce { 0%, 100% { translate: 0 0.5 0; } 50% { translate: 0 1.5 0; scale: 1.2; } }",
      "@scene { cube; } cube { translate: 0 0.5 0; color: #ff5a36; animation: turn 4s linear; } @keyframes turn { to { rotate-y: 1turn; color: #3a7bff; } }",
    ],
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

export const AT_RULES: AtRuleDef[] = [
  {
    name: "scene",
    syntax: "@scene { <shape>[#<id>][.<class>]* [* <integer>]; … }",
    description:
      "Declares the objects of the scene, one per line: a shape (cube, sphere or torus), an optional #id, any number of .classes, and an optional * n to create n copies. Multiplied ids are numbered: torus#ring * 3 creates ring-1, ring-2 and ring-3. Objects are combined in this order (see operation).",
    examples: [
      "@scene { cube; }",
      "@scene { cube#base; sphere.ball * 3; } #base { translate: 0 0.5 0; } .ball { translate: 0 1.5 0; radius: 0.3; }",
    ],
  },
  {
    name: "keyframes",
    syntax: "@keyframes <name> { <offset>[, <offset>]* { <declaration>* } … }",
    description:
      "Defines the steps of an animation, played by the animation property. An offset is from (0%), to (100%) or a percentage. A missing 0% or 100% uses the object's own value, and a frame only changes the properties it declares. Only animatable properties can be used in a frame.",
    examples: [
      "@scene { sphere; } sphere { animation: float 2s ease-in-out alternate; } @keyframes float { from { translate: 0 1 0; } to { translate: 0 2 0; } }",
      "@scene { cube; } cube { translate: 0 0.5 0; animation: pulse 1s; } @keyframes pulse { 0%, 100% { scale: 1; } 50% { scale: 1.3; color: #ff5a36; } }",
    ],
  },
];
