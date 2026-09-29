// The single source of truth for GSS features.
// Every property must be registered here: the documentation is generated
// from this list, and every example is compiled by the tests.

export type Shape =
  | "cube"
  | "sphere"
  | "torus"
  | "path"
  | "cylinder"
  | "cone"
  | "capsule"
  | "plane"
  | "prism";

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

// A shape that can be declared in @scene. Its own properties are not listed here:
// the docs find them in PROPERTIES, through appliesTo.
export type ShapeDef = {
  name: Shape | "group"; // the Shape type checks the spelling; group is drawn by its children
  description: string;
  examples: string[];
  takes?: string[]; // only these properties have an effect (a group); otherwise every object property
};

// A way to target objects, or to win the cascade: cube, .class, #id, *, a, b, !important
export type SelectorDef = {
  name: string; // what the reader writes: "*", ".class"
  anchor: string; // its id in the docs: "selector-universal" (a name like "*" cannot be an id)
  specificity: string; // shown as is: "0", "100", or a sentence
  description: string;
  examples: string[];
};

// A function that computes a value at compile time: calc(), sibling-index(), sin()… (decision 52)
export type FunctionDef = {
  name: string; // what the docs show: "calc()", or "sin(), cos(), tan()"
  anchor: string; // its id in the docs: "fn-calc"
  covers: string[]; // the functions of calc.ts it documents: ["sin", "cos", "tan"]
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
      "Moves the object along the x, y and z axes. The y axis points up, and the floor is at y = 0. On a group, it moves everything inside it, and the positions of its children become relative to the group.",
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
      "matte([<hex-color>]) | metal([<hex-color>,] [<roughness>]) | jelly([<hex-color>,] [<density>]) | gold | chrome | jelly | glass([<hex-color>,] [<refraction-index>] [, [frosted | wavy | hammered | blurred] <frost>]) | glass | ice",
    initial: "matte()",
    description:
      "Sets how the surface of the object reacts to light. matte() only scatters light, like chalk. metal() reflects the scene: roughness goes from 0, a mirror, to 1, a brushed metal (0.2 by default). Without a color, the material uses the color property, like currentColor in CSS, so color stays animatable. jelly() lets light through its thin parts, like a gummy candy: density goes from 0, clear, to 1, deep (0.5 by default). gold, chrome and jelly are shortcuts for metal(#d4af37, 0.2), metal(#ffffff, 0.05) and jelly(). glass() lets you see through the object, bent by its refraction index (1 to 3, 1.5 by default: 1.33 is water, 2.4 is diamond). The frost, from 0 to 1, comes with an optional style: frosted (white patches, the default), wavy (big waves), hammered (small bumps) or blurred (soft blur). glass is glass(), ice is glass(#cfeaff, 1.31, frosted 0.25).",
    examples: [
      "@scene { sphere; } sphere { color: #ff5a36; material: matte(); }",
      "@scene { sphere#a; sphere#b; sphere#c; } #a { translate: -1.3 0.6 0; radius: 0.6; material: gold; } #b { translate: 0 0.6 0; radius: 0.6; material: chrome; } #c { translate: 1.3 0.6 0; radius: 0.6; color: #d4af37; material: metal(0.7); }",
      "@scene { sphere; cube; } sphere { translate: -0.8 0.6 0; radius: 0.6; color: #ff5a36; material: jelly; } cube { translate: 0.8 0.5 0; rotate-y: 30deg; color: #3ad16b; material: jelly(0.3); }",
      "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass; }",
      "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass(#ffffff, 1.5, 0.3); }",
      "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: ice; }",
      "@scene { sphere; cube; } sphere { translate: 0 0.7 0; radius: 0.6; material: glass; } cube { translate: 0.3 0.5 -1.5; color: #ff5a36; }",
      "@scene { sphere#a; sphere#b; cube; } #a { translate: -0.7 0.7 0; radius: 0.6; material: glass(1.5, wavy 0.6); } #b { translate: 0.7 0.7 0; radius: 0.6; material: glass(1.5, blurred 0.6); } cube { translate: 0 0.5 -1.8; color: #ff5a36; }",
    ],
  },
  {
    name: "rotate-x",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description:
      "Rotates the object around the x axis. On a group, it turns everything inside it around the group's origin.",
    examples: ["@scene { cube; } cube { rotate-x: 45deg; }"],
  },
  {
    name: "rotate-y",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description:
      "Rotates the object around the y axis. On a group, it turns everything inside it around the group's origin.",
    examples: ["@scene { cube; } cube { rotate-y: 45deg; }"],
  },
  {
    name: "rotate-z",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description:
      "Rotates the object around the z axis. On a group, it turns everything inside it around the group's origin.",
    examples: ["@scene { cube; } cube { rotate-z: 45deg; }"],
  },
  {
    name: "scale",
    appliesTo: "object",
    animatable: true,
    syntax: "<number>",
    initial: "1.0",
    description:
      "Scales the object along the x, y and z axes. On a group, it scales everything inside it, the positions of its children included.",
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
      "Plays a @keyframes animation on the object, in a loop. The duration is in s or ms. alternate plays it forward then backward. ease-in-out slows down each step at both ends; linear, the default, keeps a constant speed. Animatable properties: translate, rotate-x, rotate-y, rotate-z, scale and color. On a group, it animates translate, the rotations and scale of the whole group.",
    examples: [
      "@scene { sphere; } sphere { animation: float 2s ease-in-out alternate; } @keyframes float { from { translate: 0 1 0; } to { translate: 0 2 0; } }",
      "@scene { cube; } cube { translate: 0 0.5 0; animation: bounce 1s; } @keyframes bounce { 0%, 100% { translate: 0 0.5 0; } 50% { translate: 0 1.5 0; scale: 1.2; } }",
      "@scene { cube; } cube { translate: 0 0.5 0; color: #ff5a36; animation: turn 4s linear; } @keyframes turn { to { rotate-y: 1turn; color: #3a7bff; } }",
    ],
  },
  {
    name: "size",
    appliesTo: ["cube", "plane"],
    syntax: "<number>{1,3} (cube) | <number>{1,2} (plane: width depth)",
    initial: "1 (cube), 1 (plane)",
    description:
      "Sets the size of the cube along the x, y and z axes: one value makes a cube, three values make a box. On a plane, sets its width and depth: one value makes a square.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; size: 2 1 1; }",
      "@scene { plane; } plane { translate: 0 1 0; rotate-x: 90deg; size: 2 1.5; color: #ff5a36; }",
    ],
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
    appliesTo: ["sphere", "torus", "cylinder", "cone", "capsule"],
    syntax: "<number> | <number> <number> (cone: bottom top)",
    initial:
      "0.5 (sphere), 1 (torus), 0.5 (cylinder), 0.5 0 (cone), 0.25 (capsule)",
    description:
      "Sets the radius of the sphere, the cylinder or the capsule, or the radius of the torus ring, measured to the center of its tube. A cone takes a bottom and a top radius, like border-radius takes several values: the top one is 0 by default, which makes a point, and a positive top radius makes a truncated cone.",
    examples: [
      "@scene { sphere; } sphere { translate: 0 1 0; radius: 1; }",
      "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
    ],
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
    name: "height",
    appliesTo: ["cylinder", "cone", "capsule"],
    syntax: "<number>",
    initial: "1",
    description:
      "Sets the full height of the cylinder, the cone or the capsule, along the y axis. The height of a capsule counts its round ends, so it must be at least twice its radius. The shape is centered on its origin: to stand it on the floor, set its y to half its height.",
    examples: [
      "@scene { cylinder; } cylinder { translate: 0 1 0; radius: 0.4; height: 2; }",
      "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
      "@scene { capsule; } capsule { translate: 0 0.75 0; radius: 0.25; height: 1.5; }",
    ],
  },
  {
    name: "d",
    appliesTo: ["path", "prism"],
    syntax: 'path("<svg path>") (path, prism) | polygon(<x> <y>, …) (prism)',
    initial: "none (required)",
    description:
      "The line a path object follows, written like the d of an SVG path, or CSS path(): M moves, L H V draw lines, C S Q T draw curves, A draws an arc of ellipse (rx ry rotation large-arc sweep x y, like SVG), Z closes, in capitals (absolute) or lowercase (relative). A path copied from an SVG keeps its way up: y goes up in the scene, down in SVG, and GSS flips it. One path unit is one scene unit, so an icon drawn in a 24 or 32 box usually needs a scale. On a prism, d takes a polygon(), written like the one of CSS clip-path: one point per comma, x and y separated by a space, y going down like in SVG, and the polygon closes itself; or a path(), like above, whose every subpath is a closed contour, filled with the even-odd rule: a subpath inside another one is a hole, like the inside of an o. A logo exported as an SVG path becomes a solid shape this way.",
    examples: [
      '@scene { path; } path { translate: 0 1 0; d: path("M-1 0.5 C-1 -1 1 -1 1 0.5"); stroke-width: 0.25; color: #ff5a36; }',
      '@scene { path; } path { translate: 0 1.2 0; d: path("M0 0 L1 1.5 L2 0 L3 1.5 L4 0"); stroke-width: 0.3; scale: 0.5; material: gold; }',
      '@scene { path; } path { translate: 0 1 0; d: path("M-1 0 A1 1 0 1 1 1 0 A1 1 0 1 1 -1 0 M-0.4 -0.3 A0.5 0.5 0 0 0 0.4 -0.3"); stroke-width: 0.15; color: #ff5a36; }',
    ],
  },
  {
    name: "stroke-width",
    appliesTo: ["path"],
    syntax: "<number>",
    initial: "1",
    description:
      "The thickness of the tube that follows the path, in path units, like the stroke-width of an SVG. The ends of the tube are round.",
    examples: [
      '@scene { path; } path { translate: 0 1 0; d: path("M-1 0 L1 0"); stroke-width: 0.6; color: #3a7bff; }',
    ],
  },
  {
    name: "depth",
    appliesTo: ["prism"],
    syntax: "<number>",
    initial: "0.2",
    description:
      "The full thickness of a prism along the z axis, centered on its origin: depth: 1 goes from z = -0.5 to z = 0.5.",
    examples: [
      "@scene { prism; } prism { translate: 0 1 0; d: polygon(0 -1, 1 1, -1 1); depth: 1; color: #ff5a36; }",
    ],
  },
  {
    name: "view-box",
    appliesTo: ["path", "prism"],
    syntax: "<number>{4}",
    initial: "the box of the path itself",
    description:
      "The drawing area of the path: x, y, width and height, like the viewBox of an SVG. Its center becomes the origin of the object. Without it, each path is centered on itself; with the same view-box, paths copied from one SVG stay in place relative to each other.",
    examples: [
      '@scene { path#left; path#right; } path { translate: 0 1.6 0; view-box: 0 0 32 32; stroke-width: 2.4; scale: 0.1; color: #e6e6e6; } #left { d: path("M12.5 4.5C9.5 4.5 9 6 9 8.5v4c0 2-1 3.5-3.5 3.5C8 16 9 17.5 9 19.5v4c0 2.5.5 4 3.5 4"); } #right { d: path("M19.5 4.5C22.5 4.5 23 6 23 8.5v4c0 2 1 3.5 3.5 3.5C24 16 23 17.5 23 19.5v4c0 2.5-.5 4-3.5 4"); }',
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
    syntax: "<hex-color> | none",
    initial: "#e8e3db",
    description:
      "Sets the color of the floor, an infinite plane at y = 0 that is lit like the objects. none removes it: the objects float over the background, like the GSS logo.",
    examples: [
      "@scene { cube; } cube { translate: 0 0.5 0; } scene { floor: #1a1a1f; }",
      "@scene { sphere; } sphere { color: #ff5a36; material: jelly(0.6); } scene { floor: none; background: #0a0a0c; }",
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
    syntax:
      "@scene { <shape>[#<id>][.<class>]* [* <integer>][;] … group[#<id>][.<class>]* [* <integer>] { … } }",
    description:
      "Declares the objects of the scene, one per line: a shape (see the Shapes section), an optional #id (only one), any number of .classes, and an optional * n to create n copies. Multiplied ids are numbered: torus#ring * 3 creates ring-1, ring-2 and ring-3. The ; after an object is optional: a new object or a } is enough. A group { … } holds objects and other groups, to move, turn or scale them together; a multiplied group copies everything inside it. Objects are combined in this order (see operation).",
    examples: [
      "@scene { cube; }",
      "@scene { cube#base; sphere.ball * 3; } #base { translate: 0 0.5 0; } .ball { translate: 0 1.5 0; radius: 0.3; }",
      "@scene {\n  cube#base\n  group#tower {\n    cube#a\n    cube#b\n  }\n}\n#base { translate: -1 0.5 0; }\n#tower { translate: 1 0 0; rotate-y: 30deg; }\n#a { translate: 0 0.5 0; }\n#b { translate: 0 1.5 0; scale: 0.7; }",
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

export const SELECTORS: SelectorDef[] = [
  {
    name: "<shape>",
    anchor: "selector-type",
    specificity: "1",
    description:
      "A shape name targets every object of that shape. Every shape is listed in the Shapes section. group targets every group.",
    examples: [
      "@scene { cube; sphere; } cube { translate: -0.8 0.5 0; color: #ff5a36; } sphere { translate: 0.8 0.5 0; }",
    ],
  },
  {
    name: ".class",
    anchor: "selector-class",
    specificity: "100 per class",
    description:
      "Targets every object that has this class in @scene. An object can have several classes, and a selector can ask for several: .a.b.",
    examples: [
      "@scene { cube#a.red; cube#b; } #a { translate: -0.8 0.5 0; } #b { translate: 0.8 0.5 0; } .red { color: #ff5a36; }",
    ],
  },
  {
    name: "#id",
    anchor: "selector-id",
    specificity: "10000",
    description:
      "Targets the object with this id. An id multiplied in @scene (torus#hero * 3) is numbered: hero-1, hero-2, hero-3.",
    examples: [
      "@scene { sphere#hero; sphere; } sphere { translate: 0.8 0.5 0; } #hero { translate: -0.8 0.5 0; color: #ff5a36; }",
    ],
  },
  {
    name: "*",
    anchor: "selector-universal",
    specificity: "0",
    description:
      "Targets every object, never the scene settings. Any other selector beats it, wherever it is written: use it for defaults.",
    examples: [
      "@scene { cube; sphere; } * { color: #ff5a36; } cube { translate: -0.8 0.5 0; } sphere { translate: 0.8 0.5 0; color: #3ad16b; }",
    ],
  },
  {
    name: "a, b",
    anchor: "selector-list",
    specificity: "Each selector keeps its own",
    description:
      "A selector list gives the same declarations to every selector it names, like writing the rule once for each.",
    examples: [
      "@scene { cube#a; cube#b; sphere; } #a, #b { color: #ff5a36; } #a { translate: -1.2 0.5 0; } #b { translate: 0 0.5 0; } sphere { translate: 1.2 0.5 0; }",
    ],
  },
  {
    name: "a b",
    anchor: "selector-descendant",
    specificity: "The sum of its parts",
    description:
      "A space means \"inside\": #letters cube targets the cubes that are in the group #letters, at any depth. It reads from right to left, like CSS: the last part is the object, each part before it is one of its groups, further out each time. #letters#S would ask for one object with two ids, which never happens: that is an error.",
    examples: [
      "@scene { cube#a; group#letters { cube#b; cube#c; } } cube { translate: -1.2 0.5 0; } #letters cube { color: #ff5a36; } #b { translate: 0 0.5 0; } #c { translate: 1.2 0.5 0; }",
    ],
  },
  {
    name: "!important",
    anchor: "selector-important",
    specificity: "Beats every declaration without it",
    description:
      "Written after a value, it makes the declaration win against every normal one, whatever their selectors. Between two !important declarations, specificity decides again. The cascade picks one value and never combines them: * { scale: 0.5 !important; } gives every object a scale of 0.5, it does not halve their own.",
    examples: [
      "@scene { cube#a; sphere; } * { color: #ff5a36 !important; } #a { translate: -0.8 0.5 0; color: #3ad16b; } sphere { translate: 0.8 0.5 0; }",
    ],
  },
];

// Every shape of SHAPES in codegen.ts must be documented here: a test checks it
export const SHAPE_DOCS: ShapeDef[] = [
  {
    name: "cube",
    description:
      "A box with slightly rounded edges, centered on its origin: 1 × 1 × 1 by default.",
    examples: ["@scene { cube; } cube { translate: 0 0.5 0; }"],
  },
  {
    name: "sphere",
    description:
      "A ball centered on its origin, with a radius of 0.5 by default.",
    examples: ["@scene { sphere; } sphere { translate: 0 0.5 0; }"],
  },
  {
    name: "torus",
    description:
      "A ring lying flat around the y axis: a radius of 1 to the center of its tube, and a tube of 0.28 by default.",
    examples: ["@scene { torus; } torus { translate: 0 0.28 0; }"],
  },
  {
    name: "cylinder",
    description:
      "A cylinder standing on the y axis, centered on its origin: a radius of 0.5 and a height of 1 by default.",
    examples: ["@scene { cylinder; } cylinder { translate: 0 0.5 0; }"],
  },
  {
    name: "cone",
    description:
      "A cone standing on the y axis, centered on its origin, pointing up: a radius of 0.5 and a height of 1 by default. A second radius makes a truncated cone.",
    examples: ["@scene { cone; } cone { translate: 0 0.5 0; }"],
  },
  {
    name: "capsule",
    description:
      "A cylinder with round ends, standing on the y axis and centered on its origin. Its height counts the round ends: a radius of 0.25 and a height of 1 by default.",
    examples: ["@scene { capsule; } capsule { translate: 0 0.5 0; }"],
  },
  {
    name: "path",
    description:
      "A tube with round ends that follows an SVG path. It needs a d; stroke-width and view-box work like in SVG.",
    examples: [
      '@scene { path; } path { translate: 0 1 0; d: path("M-1 0.5 C-1 -1 1 -1 1 0.5"); stroke-width: 0.25; color: #ff5a36; }',
    ],
  },
  {
    name: "plane",
    description:
      "A thin, flat rectangle lying in the xz plane, centered on its origin: 1 × 1 by default. size sets its width and depth, rotate-x: 90deg stands it up like a wall.",
    examples: [
      "@scene { plane; } plane { translate: 0 0.01 0; size: 3 2; color: #3ad16b; }",
    ],
  },
  {
    name: "prism",
    description:
      "A contour, filled, then given a depth: a star, a letter, an arrow, a logo. The contour is a polygon() or a path() (see d); a path can hold several contours, and one inside another is a hole. It stands in the xy plane, facing the camera, and is centered on its contours (or its view-box), like a path.",
    examples: [
      "@scene { prism; } prism { translate: 0 1 0; d: polygon(0 -1, -0.25 -0.34, -0.95 -0.31, -0.4 0.13, -0.59 0.81, 0 0.42, 0.59 0.81, 0.4 0.13, 0.95 -0.31, 0.25 -0.34); depth: 0.3; material: gold; }",
      '@scene { prism; } prism { translate: 0 1 0; d: path("M-1 -1 H1 V1 H-1 Z M0 -0.6 A0.6 0.6 0 1 1 0 0.6 A0.6 0.6 0 1 1 0 -0.6 Z"); depth: 0.4; color: #ff5a36; }',
    ],
  },
  {
    name: "group",
    description:
      "Not a shape: it holds objects and other groups, like <g> in SVG, and draws nothing itself. Its translate, rotations and scale apply to everything inside it, and the positions of its children become relative to it: move the group, everything follows. Other properties (color, material, size…) are not passed down to its children; to style them, use a descendant selector: #letters cube.",
    takes: ["translate", "rotate-x", "rotate-y", "rotate-z", "scale", "animation"],
    examples: [
      "@scene { group#letters { cube#l; cube#u; cube#c; } } #letters { translate: -1 0.5 0; rotate-y: 20deg; } #letters cube { size: 0.3 1 0.3; color: #ff5a36; } #u { translate: 1 0 0; } #c { translate: 2 0 0; }",
      "@scene { group#spin { sphere#a; sphere#b; } } #spin { translate: 0 0.6 0; animation: turn 4s linear; } #a { translate: -0.8 0 0; radius: 0.4; } #b { translate: 0.8 0 0; radius: 0.4; } @keyframes turn { to { rotate-y: 1turn; } }",
    ],
  },
];

export const FUNCTIONS: FunctionDef[] = [
  {
    name: "calc()",
    anchor: "fn-calc",
    covers: ["calc"],
    syntax: "calc(<expression>)",
    description:
      "Computes a value, like CSS calc(): + - * / and parentheses, with numbers, angles (deg, rad, turn) and durations (s, ms). Like in CSS, + and - need a space on each side. Everything is computed by the compiler, once per object: the shader only receives the result, so math costs nothing on the GPU. calc() and the other math functions work in any value, even inside another function: metal(#fff, calc(0.1 * 2)).",
    examples: [
      "@scene { cube.step * 5; } .step { size: 0.4; translate: calc(sibling-index() * 0.6 - 1.8) calc(sibling-index() * 0.25) 0; color: #ff5a36; }",
    ],
  },
  {
    name: "sibling-index()",
    anchor: "fn-sibling-index",
    covers: ["sibling-index"],
    syntax: "sibling-index()",
    description:
      "The position of the object among its siblings, from 1, like the CSS function of the same name: cube * 12 gives 12 siblings numbered 1 to 12. Siblings are the objects of the same @scene block or of the same group; a group is a sibling too, and inside a group the count starts again. With calc(), one rule gives every copy of a multiplied object its own place, angle or size: no loop needed. It has no meaning in scene { } or in @keyframes, shared by every object.",
    examples: [
      "@scene { cube.petal * 12; } .petal { size: 0.25 0.6 0.25; translate: calc(cos(sibling-index() * 30deg) * 1.6) 0.5 calc(sin(sibling-index() * 30deg) * 1.6); rotate-y: calc(sibling-index() * -30deg); color: #ff5a36; }",
    ],
  },
  {
    name: "sibling-count()",
    anchor: "fn-sibling-count",
    covers: ["sibling-count"],
    syntax: "sibling-count()",
    description:
      "How many siblings the object has, itself included, like the CSS function of the same name. Divided into a full turn, it spreads objects evenly whatever their number: change * 8 into * 20, the ring follows.",
    examples: [
      "@scene { sphere.bead * 8; } .bead { radius: 0.2; translate: calc(cos(sibling-index() * 1turn / sibling-count()) * 1.4) 0.5 calc(sin(sibling-index() * 1turn / sibling-count()) * 1.4); material: jelly(0.6); color: #ff5a36; }",
    ],
  },
  {
    name: "sin(), cos(), tan()",
    anchor: "fn-trig",
    covers: ["sin", "cos", "tan"],
    syntax: "sin(<angle> | <number>)",
    description:
      "The trigonometric functions of CSS: they take an angle (deg, rad, turn), or a number of radians, and return a number. cos() and sin() of the same angle give a point on a circle: the way to place objects in a ring, a spiral or a wave. pi is also known: cos(pi) is -1.",
    examples: [
      "@scene { sphere.wave * 9; } .wave { radius: 0.18; translate: calc(sibling-index() * 0.4 - 2) calc(0.8 + sin(sibling-index() * 40deg) * 0.5) 0; color: #7cb4ff; }",
    ],
  },
  {
    name: "min(), max(), clamp()",
    anchor: "fn-min-max-clamp",
    covers: ["min", "max", "clamp"],
    syntax: "min(<value>, …) | max(<value>, …) | clamp(<min>, <value>, <max>)",
    description:
      "The smallest or the largest of their values, or a value kept between two bounds, like in CSS. The values must share a unit: max(10deg, 20deg), not max(10deg, 2).",
    examples: [
      "@scene { cube.bar * 6; } .bar { size: 0.3 calc(clamp(0.4, sibling-index() * 0.35, 1.4)) 0.3; translate: calc(sibling-index() * 0.5 - 1.75) 0.7 0; color: #ff5a36; }",
    ],
  },
  {
    name: "abs(), sqrt(), pow()",
    anchor: "fn-abs-sqrt-pow",
    covers: ["abs", "sqrt", "pow"],
    syntax: "abs(<value>) | sqrt(<number>) | pow(<number>, <number>)",
    description:
      "abs() drops the sign, sqrt() is the square root, pow(a, b) is a to the power b, like in CSS. pow() grows fast: good for sizes that double.",
    examples: [
      "@scene { sphere.dot * 5; } .dot { radius: calc(pow(1.4, sibling-index()) * 0.08); translate: calc(sibling-index() * 0.8 - 2.4) 0.6 0; color: #ff5a36; }",
    ],
  },
];
