// The single source of truth for GSS features.
// Every property must be registered here: the documentation is generated
// from this list, and every example is compiled by the tests.
// The texts are plain text, where code sits between backticks, like Markdown: the docs
// show it as code (decision 121).

export type Shape =
  | "cube"
  | "sphere"
  | "torus"
  | "path"
  | "cylinder"
  | "cone"
  | "capsule"
  | "plane"
  | "prism"
  | "lathe";

export type Example = {
  name?: string; // its heading in the docs, and its name in the menu of the playground
  text?: string; // one sentence under the heading: what the example shows
  code: string;
  html?: string; // the HTML elements the scene shows with element(#id) (decision 101)
};

// The parts of a page under its table, like the docs of a popular language (decision 121)
export type Value = [value: string, text: string]; // the value as written, then what it does
type Parts = {
  values?: Value[]; // a table, one row per keyword, function or argument
  valuesTitle?: string; // its heading, "Values" by default: "Descriptors", "Functions"…
  details?: string; // one paragraph under it: the limits, the differences from CSS
};

// A callout under the description: what a reader must know before trying it
export type Note = { title: string; text: string };

// The version that added the entry: "0.0.4". The search shows the entries of the newest
// version when it opens (decision 125); an entry from before 0.0.4 has none.
type Since = { since?: string };

export type PropertyDef = Parts & Since & {
  name: string;
  appliesTo: "object" | "scene" | "everywhere" | (Shape | "light")[]; // [...]: only these shapes (or lights); everywhere: the scene too
  syntax: string;
  initial: string;
  description: string;
  examples: Example[];
  animatable?: boolean; // can be changed by @keyframes (decision 24)
  note?: Note;
};

// A block of the language: @scene, @keyframes
export type AtRuleDef = Parts & Since & {
  name: string; // without the @: "keyframes"
  syntax: string;
  description: string;
  examples: Example[];
  see?: { anchor: string; label: string }[]; // other pages of the docs, linked under the syntax
  note?: Note;
};

// A shape that can be declared in @scene. Its own properties are not listed here:
// the docs find them in PROPERTIES, through appliesTo.
export type ShapeDef = Parts & Since & {
  name: Shape | "group" | "light"; // the Shape type checks the spelling; group is drawn by its children, light draws nothing
  description: string;
  examples: Example[];
  takes?: string[]; // only these properties have an effect (a group); otherwise every object property
};

// A way to target objects, or to win the cascade: cube, .class, #id, *, a, b, !important
export type SelectorDef = Parts & Since & {
  name: string; // what the reader writes: "*", ".class"
  anchor: string; // its id in the docs: "selector-universal" (a name like "*" cannot be an id)
  specificity: string; // shown as is: "0", "100", or a sentence
  description: string;
  examples: Example[];
};

// A function that computes a value at compile time: calc(), sibling-index(), sin()… (decision 52), var() (decision 55)
export type FunctionDef = Parts & Since & {
  name: string; // what the docs show: "calc()", or "sin(), cos(), tan()"
  anchor: string; // its id in the docs: "fn-calc"
  covers: string[]; // the functions of calc.ts it documents: ["sin", "cos", "tan"]
  syntax: string;
  computed?: string; // when it is computed, if not at compile time (a gradient, element())
  description: string;
  examples: Example[];
  note?: Note;
};

// element() today: behind a flag, or an origin trial on a site
const ELEMENT_NOTE: Note = {
  title: "Behind a flag for now.",
  text: "`element()` needs HTML-in-Canvas, which Chromium ships behind a flag: turn on `chrome://flags/#canvas-draw-element` to see it, and the examples of this page. On your own site, visitors see it once you register the site for the HTML-in-Canvas origin trial and add its token to the page, until the trial ends on October 20, 2026. Without it, the object keeps its color.",
};

export const PROPERTIES: PropertyDef[] = [
  {
    name: "translate",
    appliesTo: "object",
    animatable: true,
    syntax: "<number>{3}",
    initial: "0 0 0",
    description:
      "Moves the object along the x, y and z axes. Like CSS, x points right and z toward the viewer; y points up, and the floor is at y = 0. On a group, it moves everything inside it, and the positions of its children become relative to the group.",
    examples: [
      {
        name: "on the floor",
        text: "A cube of 1, half a unit up: it sits on the floor.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "color",
    appliesTo: "object",
    animatable: true,
    syntax: "<color> | <gradient>",
    initial: "#e6e6e6",
    description:
      "Sets the base color of the surface of the object: a hex color (`#ff5a36`), `rgb()`, `hsl()` or one of the 148 named colors of CSS (`tomato`). It can also be a gradient, a `noise()`, or one of them moved by `displace()`.",
    values: [
      ["<color>", "Any CSS color: the compiler turns it into a hex color."],
      ["<gradient>", "`linear-gradient()`, `radial-gradient()` or `conic-gradient()`, painted on the object as seen from the front, and taken by every material."],
      ["noise()", "A noise cut in the object's own space, like a block of stone."],
      ["transparent", "A transparent color (`#ff000080`, `rgb(255 0 0 / 50%)`), or the transparent stops of a gradient, make the object transparent, like `opacity`."],
    ],
    details: "A gradient can be animated and changed by `:hover`, into another gradient of the same kind with as many colors: each of its numbers moves on its own. Through a variable, one number is enough: `linear-gradient(var(--angle), …)` turns when `@keyframes` changes `--angle`. A color cannot change into a gradient. On a point `light`, `color` is the color of its light: a plain color only.",
    examples: [
      {
        name: "a hex color",
        code: "@scene { sphere; } sphere { color: #ff5a36; }",
      },
      {
        name: "a named color and hsl()",
        text: "`tomato`, and `hsl(210 80% 60%)`.",
        code: "@scene { sphere#a; sphere#b; } #a { translate: 0.8 0.5 0; color: tomato; } #b { translate: -0.8 0.5 0; color: hsl(210 80% 60%); }",
      },
      {
        name: "animated gradient",
        text: "`@keyframes` turns the angle of the gradient through `--angle`.",
        code: "@scene { plane; } plane { size: 4 3; translate: 0 0.05 0; --angle: 0deg; color: linear-gradient(var(--angle), #ff6540, #722cff); animation: spin 6s; } scene { camera-angle: 0deg 60deg; } @keyframes spin { to { --angle: 1turn; } }",
      },
      {
        name: "gradient on :hover",
        text: "Under the mouse, the center of the gradient moves and its colors change.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: radial-gradient(circle at 30% 70%, #ffd27a, #ff5a36); transition: 0.4s; } cube:hover { color: radial-gradient(circle at 70% 30%, #7ad2ff, #3a3aff); }",
      },
      {
        name: "a transparent color",
        text: "A sphere at 40% alpha: the cube behind it shows through.",
        code: "@scene { sphere; cube; } sphere { translate: 0 1 0; radius: 0.7; color: rgb(58 123 255 / 40%); } cube { translate: 0 0.4 -1.2; size: 0.8; color: #ff5a36; }",
      },
      {
        name: "a gradient that fades out",
        text: "The cube fades out toward its bottom.",
        code: "@scene { cube; } cube { translate: 0 0.7 0; size: 1.2; color: linear-gradient(#ff5a36, transparent); }",
      },
    ],
  },
  {
    name: "material",
    appliesTo: "object",
    syntax:
      "matte([<color>]) | metal([<color>,] [<roughness>]) | jelly([<color>,] [<density>]) | emissive([<color>,] [<strength>]) | gold | chrome | copper | silver | brass | aluminum | jelly | glass([<color>,] [<refraction-index>] [, [frosted | wavy | hammered | blurred] <frost>]) | glass | ice",
    initial: "matte()",
    description:
      "Sets how the surface of the object reacts to light. Without a color, a material uses the `color` property, like `currentColor` in CSS, so the color stays animatable. The color can also be a gradient: `metal(linear-gradient(#ffd27a, #ff5a36), 0.2)`.",
    values: [
      ["matte()", "Scatters the light only, like chalk: the default."],
      ["metal()", "Reflects the scene. Its roughness goes from 0, a mirror, to 1, brushed metal (0.2 by default)."],
      ["jelly()", "Lets the light through its thin parts, like a gummy candy. Its density goes from 0, clear, to 1, deep (0.5 by default)."],
      ["glass()", "See-through, bent by its refraction index, from 1 to 3 (1.5 by default: water is 1.33, diamond 2.4), then a frost from 0 to 1."],
      ["emissive()", "Gives its own light: a lamp, a screen, a neon. It is never darker than its color times its strength, from 0, none, to 4 (1 by default: its full color, even in the shade). It does not light the objects around it; with `bloom()` in the `filter` of the scene, it glows."],
      ["frosted, wavy, hammered, blurred", "The style of the frost: white patches (the default), big waves, small bumps, a soft blur."],
      ["gold, chrome", "`metal(#d4af37, 0.2)` and `metal(#ffffff, 0.05)`."],
      ["copper, silver, brass, aluminum", "`metal(#c8784a, 0.25)`, `metal(#e3e4e6, 0.1)`, `metal(#c9a24d, 0.2)` and `metal(#c4c8cc, 0.35)`: the metals of everyday objects."],
      ["jelly, glass, ice", "`jelly()`, `glass()`, and `glass(#cfeaff, 1.31, frosted 0.25)`."],
    ],
    examples: [
      {
        name: "matte()",
        text: "The default: a soft, even surface.",
        code: "@scene { sphere; } sphere { color: #ff5a36; material: matte(); }",
      },
      {
        name: "metal()",
        text: "`gold`, `chrome`, and a rougher `metal(0.7)` that takes the `color`.",
        code: "@scene { sphere#a; sphere#b; sphere#c; } #a { translate: 1.3 0.6 0; radius: 0.6; material: gold; } #b { translate: 0 0.6 0; radius: 0.6; material: chrome; } #c { translate: -1.3 0.6 0; radius: 0.6; color: #d4af37; material: metal(0.7); }",
      },
      {
        name: "everyday metals",
        text: "`copper`, `silver`, `brass` and `aluminum`, from left to right.",
        code: "@scene { sphere#a; sphere#b; sphere#c; sphere#d; } sphere { radius: 0.45; } #a { translate: -1.5 0.5 0; material: copper; } #b { translate: -0.5 0.5 0; material: silver; } #c { translate: 0.5 0.5 0; material: brass; } #d { translate: 1.5 0.5 0; material: aluminum; }",
      },
      {
        name: "jelly()",
        text: "`jelly`, and a clearer `jelly(0.3)`.",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; radius: 0.6; color: #ff5a36; material: jelly; } cube { translate: -0.8 0.5 0; rotate-y: -30deg; color: #3ad16b; material: jelly(0.3); }",
      },
      {
        name: "emissive()",
        text: "A glowing sphere and a dim one, with `bloom()` on the scene.",
        code: "@scene { sphere#lamp; sphere#dim; } scene { background: #07080c; ambient: 0.25; filter: bloom(0.7, 10px); } #lamp { translate: -0.8 0.6 0; radius: 0.55; material: emissive(#ff5a36, 2); } #dim { translate: 0.8 0.6 0; radius: 0.55; material: emissive(#3a7bff, 0.5); }",
      },
      {
        name: "glass()",
        text: "Clear glass.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass; }",
      },
      {
        name: "glass(), with its arguments",
        text: "A white glass, of index 1.5 and frost 0.3.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass(#ffffff, 1.5, 0.3); }",
      },
      {
        name: "ice",
        text: "`glass(#cfeaff, 1.31, frosted 0.25)`.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: ice; }",
      },
      {
        name: "glass, with a cube behind",
        text: "The sphere bends the view of the cube behind it.",
        code: "@scene { sphere; cube; } sphere { translate: 0 0.7 0; radius: 0.6; material: glass; } cube { translate: -0.3 0.5 -1.5; color: #ff5a36; }",
      },
      {
        name: "glass() with frost and style",
        text: "A `wavy` and a `blurred` frost, side by side.",
        code: "@scene { sphere#a; sphere#b; cube; } #a { translate: 0.7 0.7 0; radius: 0.6; material: glass(1.5, wavy 0.6); } #b { translate: -0.7 0.7 0; radius: 0.6; material: glass(1.5, blurred 0.6); } cube { translate: 0 0.5 -1.8; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "texture",
    appliesTo: "object",
    syntax: 'url("<file>") | element(<id>) | paint(<name>)',
    initial: "none",
    description:
      "Projects an image onto the surface of the object: one image per face, the top, the bottom and the sides, whatever the size of the object. The image replaces the base color, and moves, turns and scales with the object.",
    values: [
      ["url(\"<file>\")", "An image file, read next to the `.gss` file, like `url()` in a stylesheet."],
      ["element(<id>)", "A live image of an HTML element of the page: see `element()`."],
      ["paint(<name>)", "A texture drawn by a fragment shader: see `@paint`."],
      ["none", "No image: the default."],
    ],
    note: ELEMENT_NOTE,
    examples: [
      {
        name: "a block of dirt",
        code: '@scene { cube; } cube { translate: 0 0.5 0; texture: url("/textures/dirt.png"); }',
      },
      {
        name: "an HTML element, with element()",
        text: "A card of HTML on the front face of a thin cube.",
        code: "@scene { cube; } scene { floor: none; camera-angle: -20deg 10deg; camera-target: 0 0.8 0; camera-distance: 3.2; ambient: 0.55; } cube { translate: 0 0.8 0; size: 1.6 1 0.06; corner-radius: 0.03; } cube::face(front) { texture: element(#card); }",
        html: "<article id=\"card\" style=\"\n  width: 320px; height: 200px; padding: 28px;\n  box-sizing: border-box; border-radius: 18px;\n  background: #f4f1ea; color: #1a1d2b;\n  font: 600 30px/1.2 system-ui, sans-serif;\">\n  Hello from <em style=\"color: #ff5a36;\">HTML</em>, on a 3D card\n</article>",
      },
    ],
  },
  {
    name: "image-rendering",
    appliesTo: "object",
    syntax: "auto | smooth | pixelated | crisp-edges",
    initial: "auto",
    description:
      "How the image of `texture` is drawn, like CSS.",
    values: [
      ["auto, smooth", "Blends the pixels, for photos and painted textures. `auto` is the default."],
      ["pixelated", "Reads the nearest pixel: each pixel stays a sharp square, the look of pixel art."],
      ["crisp-edges", "The same as `pixelated`."],
    ],
    examples: [
      {
        name: "a pixel-art block",
        code: '@scene { cube; } cube { translate: 0 0.5 0; texture: url("/textures/dirt.png"); image-rendering: pixelated; }',
      },
    ],
  },
  {
    name: "texture-size",
    appliesTo: "object",
    syntax: "<number>",
    initial: "auto",
    description:
      "The size of one image on the surface, in the units of the object, like `background-size`: the image repeats to cover each face. `auto`, the default, fits one image to each face.",
    examples: [
      {
        name: "a tiled slab",
        text: "Images of 0.5 on a slab of 3: 6 × 6 per face.",
        code: "@scene { cube; } cube { size: 3 0.2 3; translate: 0 0.1 0; texture: url('/textures/dirt.png'); texture-size: 0.5; image-rendering: pixelated; }",
      },
    ],
  },
  {
    name: "opacity",
    since: "0.0.4",
    appliesTo: "object",
    animatable: true,
    syntax: "<number> | <percentage>",
    initial: "1",
    description:
      "How much the object covers what is behind it, like CSS: from 0, invisible, to 1, opaque (the default), as a number or a percentage; a value outside is kept between them. The alpha of its `color` and `opacity()` in `filter` multiply with it.",
    details: "Through a transparent object, the eye sees its back face from the inside, then what is behind it: a sphere at 50% looks like a bubble. On a group, the opacity goes into each of its objects: unlike CSS, which fades a group as one picture, its objects show through each other. With `shadows`, the light goes through a transparent object like stained glass: a red glass at 50% casts a pink light. The mouse still points at a transparent object, like CSS, and the reflections show it opaque.",
    examples: [
      {
        name: "a bubble",
        text: "A sphere at 35%, with another one inside.",
        code: "@scene { sphere#bubble; sphere#core; } #bubble { translate: 0 1 0; radius: 0.8; color: #9fd8ff; opacity: 0.35; } #core { translate: 0 1 0; radius: 0.3; color: #ff5a36; }",
      },
      {
        name: "fading on :hover",
        text: "The cube fades to 25% under the mouse.",
        code: "@scene { cube; } cube { translate: 0 0.6 0; size: 1.2; color: #3a7bff; transition: 0.4s; } cube:hover { opacity: 0.25; }",
      },
      {
        name: "a colored shadow",
        text: "A red pane at 50% casts a pink light.",
        code: "@scene { cube; sphere; } scene { shadows: soft; light: 30deg 55deg; } cube { translate: 0 0.9 0; size: 1.2 2.2 0.05; color: #ff2a2a; opacity: 0.5; animation: move 5s ease alternate; } sphere { translate: 0.9 0.4 -1; radius: 0.4; } @keyframes move { to { translate: 1 0.9 0; } }",
      },
    ],
  },
  {
    name: "mask-image",
    since: "0.0.4",
    appliesTo: "object",
    animatable: true,
    syntax: "none | <gradient>",
    initial: "none",
    description:
      "Cuts holes in the object, like a CSS mask: where the image covers the surface, the object is there; where it is transparent, the surface is not drawn, and the eye sees inside the object, then what is behind it. The image is a gradient, a `noise()`, or one of them moved by `displace()`.",
    details: "It is read like a gradient in `color`: seen from the front in the object's own space, and in 3D for a `noise()`, so the holes move and turn with the object. A part covered less than half is a hole, so the edge of a hole is sharp: unlike CSS, a mask does not fade the object. `mask-mode` says what counts, the alpha by default. The holes show in the reflections too, and the mouse goes through them: `:hover` reaches the object behind a hole.",
    examples: [
      {
        name: "holes from a noise",
        text: "A `noise()` whose black covers and whose `transparent` cuts.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: #ff5a36; mask-image: noise(4 3, black 48%, transparent 52%); }",
      },
      {
        name: "a sphere seen through a cube",
        text: "A round hole in each face shows the sphere inside the cube.",
        code: "@scene { cube; sphere; } scene { camera-angle: 20deg 15deg; } cube { translate: 0 0.7 0; size: 1.4; color: #3a7bff; mask-image: radial-gradient(circle, transparent 35%, black 36%); } sphere { translate: 0 0.7 0; radius: 0.35; color: #ff5a36; }",
      },
      {
        name: "a dissolve",
        text: "Moving the stops of the `noise()` dissolves the sphere.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: #ff5a36; mask-image: noise(4 3, black 20%, transparent 20%); animation: dissolve 3s ease-in-out alternate; } @keyframes dissolve { to { mask-image: noise(4 3, black 80%, transparent 80%); } }",
      },
    ],
  },
  {
    name: "mask-mode",
    since: "0.0.4",
    appliesTo: "object",
    syntax: "alpha | luminance | match-source",
    initial: "match-source",
    description:
      "Which part of `mask-image` counts, like CSS.",
    values: [
      ["match-source", "The default: a gradient counts by its alpha, like CSS."],
      ["alpha", "The transparency of its colors: black and white are both there."],
      ["luminance", "Their brightness, times their alpha, like an SVG mask: white is there, black is a hole."],
    ],
    examples: [
      {
        name: "a cage, with luminance",
        text: "White stripes stay, black ones are holes: the sphere shows between the bars.",
        code: "@scene { cube; sphere; } cube { translate: 0 0.7 0; size: 1.4; mask-image: repeating-linear-gradient(90deg, white 0% 10%, black 10% 20%); mask-mode: luminance; } sphere { translate: 0 0.7 0; radius: 0.45; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "rotate-x",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description:
      "Rotates the object around the x axis. Like CSS `rotateX()`, a positive angle turns its top away from the viewer. On a group, it turns everything inside it around the origin of the group.",
    examples: [
      {
        name: "45 degrees",
        code: "@scene { cube; } cube { rotate-x: 45deg; }",
      },
    ],
  },
  {
    name: "rotate-y",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description:
      "Rotates the object around the y axis. Like CSS `rotateY()`, a positive angle turns its right side away from the viewer. On a group, it turns everything inside it around the origin of the group.",
    examples: [
      {
        name: "-45 degrees",
        code: "@scene { cube; } cube { rotate-y: -45deg; }",
      },
    ],
  },
  {
    name: "rotate-z",
    appliesTo: "object",
    animatable: true,
    syntax: "<angle>",
    initial: "0deg",
    description:
      "Rotates the object around the z axis. Like CSS `rotate()`, a positive angle turns it clockwise. On a group, it turns everything inside it around the origin of the group.",
    examples: [
      {
        name: "-45 degrees",
        code: "@scene { cube; } cube { rotate-z: -45deg; }",
      },
    ],
  },
  {
    name: "scale",
    appliesTo: "object",
    animatable: true,
    syntax: "<number>",
    initial: "1.0",
    description:
      "Scales the object by one number, on its three axes. On a group, it scales everything inside it, the positions of its children included.",
    examples: [
      {
        name: "twice as big",
        code: "@scene { cube; } cube { scale: 2.0; }",
      },
    ],
  },
  {
    name: "transform-origin",
    since: "0.0.4",
    appliesTo: "object",
    animatable: true,
    syntax: "[ left | center | right | top | bottom | <percentage> | <number> ]{1,2} <number>?",
    initial: "center",
    description:
      "The point the object turns and scales around, like CSS: `rotate-x`, `rotate-y`, `rotate-z` and `scale` keep it in place, and a motion path carries it along the path.",
    values: [
      ["left, right, top, bottom, center", "The sides of the box of the object, like CSS. Two keywords go in any order: `top left`."],
      ["<percentage>", "Also on the box: `0%` is the left or the top side, `100%` the right or the bottom one."],
      ["<number>", "A point of the object's own space, from its center, y up, like `translate`: `0 0.5 0` is 0.5 above the center. The third value, z, is always a number."],
    ],
    details: "Unlike CSS, where a length is measured from the top left corner, a number is measured from the center, like everything in GSS. A group has no box: it takes numbers and `center`.",
    examples: [
      {
        name: "a door on its hinge",
        text: "A door that turns on its left side.",
        code: "@scene { cube#door; cube#frame; } #frame { size: 0.1 1.6 0.1; translate: -0.6 0.8 0; color: #3a7bff; } #door { size: 1.1 1.5 0.08; translate: 0 0.8 0; transform-origin: left; animation: open 3s ease-in-out infinite alternate; color: #ff5a36; } @keyframes open { to { rotate-y: -80deg; } }",
      },
      {
        name: "grow from the floor",
        text: "Columns that grow from their base.",
        code: "@scene { cylinder * 5; } cylinder { radius: 0.18; height: 1.2; translate: calc((sibling-index() - 3) * -0.5) 0 0; transform-origin: bottom; animation: grow 1.5s calc(sibling-index() * 0.15s) ease-out infinite alternate; color: #ff5a36; } @keyframes grow { from { scale: 0.2; } }",
      },
    ],
  },
  {
    name: "operation",
    appliesTo: "object",
    syntax: "union | subtract | intersect",
    initial: "union",
    description:
      "Sets how the object combines with the objects declared before it in `@scene`. The floor is never affected.",
    values: [
      ["union", "Adds the object: the default."],
      ["subtract", "Carves it out of them."],
      ["intersect", "Keeps only their common part."],
    ],
    examples: [
      {
        name: "a sphere carved out of a cube",
        code: "@scene { cube; sphere; } cube { translate: 0 1 0; } sphere { translate: 0 1 0; radius: 0.65; operation: subtract; }",
      },
    ],
  },
  {
    name: "blend",
    appliesTo: "object",
    syntax: "<number>",
    initial: "0",
    description:
      "Smooths the junction between the object and the objects declared before it, over the given distance. 0 keeps a sharp junction; it works with every `operation`.",
    examples: [
      {
        name: "two spheres that melt together",
        code: "@scene { sphere#a; sphere#b; } #a { translate: 0.4 1 0; } #b { translate: -0.4 1 0; blend: 0.4; }",
      },
    ],
  },
  {
    name: "transition",
    appliesTo: "object",
    syntax: "none | [all] <time> [<easing>] [<time>]",
    initial: "none",
    description:
      "Glides the object to its `:hover` state and back, instead of jumping, like CSS. One transition covers every property that `:hover` changes on the object.",
    values: [
      ["<time>", "The first time is the duration, the second one the delay."],
      ["<easing>", "`ease` by default, or any easing: a keyword, `cubic-bezier()`, `linear()` or `steps()`."],
    ],
    details: "Like CSS, the object enters `:hover` with the transition of its `:hover` rule, if it has one, and leaves it with the transition written at rest. Leaving halfway goes back from where it is, in the time already spent.",
    examples: [
      {
        name: "a hover that glides",
        text: "Scale, turn and color glide in 0.4 s.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: #ff5a36; transition: 0.4s ease-out; } cube:hover { scale: 1.3; rotate-y: -45deg; color: #3a7bff; }",
      },
      {
        name: "one way in, another out",
        text: "The spheres rise quickly with `ease-out`, and fall back with an overshoot.",
        code: "@scene { sphere * 5; } sphere { radius: 0.35; translate: calc(2.7 - sibling-index() * 0.9) 0.4 0; color: #3ad16b; transition: 0.8s cubic-bezier(0.3, -0.4, 0.7, 1.4); } sphere:hover { translate: calc(2.7 - sibling-index() * 0.9) 1.4 0; transition: 0.4s ease-out; }",
      },
    ],
  },
  {
    name: "animation",
    appliesTo: "everywhere",
    syntax:
      "<keyframes-name> <time> [<easing>] [<time>] [<number> | infinite] [normal | reverse | alternate | alternate-reverse] [none | forwards | backwards | both]",
    initial: "none",
    description:
      "Plays a `@keyframes` animation on the object, like CSS. After its name come the duration, then if needed an easing, a delay, a number of iterations, a direction and a fill mode, in any order.",
    values: [
      ["<time>", "The first time is the duration of one iteration, in `s` or `ms`; the second one, the delay: the animation starts after it, or partway with a negative delay."],
      ["<easing>", "`linear` (the default), `ease`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier()`, `linear()` or `steps()`."],
      ["<number> | infinite", "How many times it plays: `1.5` stops halfway through the second time. `infinite` is the default."],
      ["normal, reverse, alternate, alternate-reverse", "The direction: forward, backward, forward then backward, or backward first."],
      ["none, forwards, backwards, both", "The fill mode: what the object shows outside the animation."],
    ],
    details: "Unlike CSS, an animation loops forever unless it has a number of iterations. Each part also has a property of its own, like `animation-duration`, which wins over what `animation` says. On an object, it animates `translate`, the rotations, `scale`, `color` (a gradient too), `opacity`, `mask-image` and `offset-distance`; on a group, its transforms. On the scene, it animates the properties of the scene, like `background`, `light` or `fog`, and the variables they use: the objects do not follow the variables a scene animates. In a `:hover` or `:active` rule, the animation starts with the state and plays to its end, once unless it says how many times, like a button that fires: see `:active`.",
    examples: [
      {
        name: "up and down",
        text: "`alternate` plays the frames forward, then backward.",
        code: "@scene { sphere; } sphere { animation: float 2s ease-in-out alternate; } @keyframes float { from { translate: 0 1 0; } to { translate: 0 2 0; } }",
      },
      {
        name: "a bounce",
        text: "Up at `50%`, and back down, in a loop of 1 s.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; animation: bounce 1s; } @keyframes bounce { 0%, 100% { translate: 0 0.5 0; } 50% { translate: 0 1.5 0; scale: 1.2; } }",
      },
      {
        name: "a full turn",
        text: "`linear` keeps a constant speed while the cube turns and changes color.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: #ff5a36; animation: turn 4s linear; } @keyframes turn { to { rotate-y: -1turn; color: #3a7bff; } }",
      },
      {
        name: "an overshoot",
        text: "A `cubic-bezier()` that goes past the top before it settles.",
        code: "@scene { sphere; } sphere { translate: 0 0.5 0; radius: 0.5; color: #ff5a36; animation: jump 1.2s cubic-bezier(0.3, -0.4, 0.7, 1.4) alternate; } @keyframes jump { to { translate: 0 2 0; } }",
      },
      {
        name: "a drop, once",
        text: "After 0.5 s, one iteration; `both` shows the first frame before it and the last one after.",
        code: "@scene { cube; } cube { translate: 0 3 0; color: #ff5a36; animation: drop 1s ease-in 0.5s 1 both; } @keyframes drop { to { translate: 0 0.5 0; rotate-y: -90deg; } }",
      },
      {
        name: "animation on the scene",
        text: "The background of the scene darkens to dusk.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { floor: none; background: #101018; animation: dusk 4s ease-in-out alternate; } @keyframes dusk { to { background: #3a1f4a; } }",
      },
    ],
  },
  {
    name: "animation-duration",
    appliesTo: "everywhere",
    syntax: "<time>",
    initial: "0s",
    description:
      "The duration of one iteration of the animation, in `s` or `ms`. It wins over the duration written in `animation`.",
    examples: [
      {
        name: "3 s instead of 1.5 s",
        code: "@scene { sphere; } sphere { radius: 0.5; color: #3a7bff; animation: rise 1.5s ease-in-out; animation-duration: 3s; } @keyframes rise { from { translate: 0 0.5 0; } to { translate: 0 2 0; } }",
      },
    ],
  },
  {
    name: "animation-delay",
    appliesTo: "everywhere",
    syntax: "<time>",
    initial: "0s",
    description:
      "How long the animation waits before it starts, in `s` or `ms`; a negative delay starts it partway, as if it had begun earlier. It wins over the delay written in `animation`.",
    examples: [
      {
        name: "a second of wait",
        code: "@scene { sphere; } sphere { radius: 0.5; color: #3a7bff; animation: rise 1.5s ease-in-out; animation-delay: 1s; } @keyframes rise { from { translate: 0 0.5 0; } to { translate: 0 2 0; } }",
      },
    ],
  },
  {
    name: "animation-iteration-count",
    appliesTo: "everywhere",
    syntax: "<number> | infinite",
    initial: "infinite",
    description:
      "How many times the animation plays: a number, where `1.5` stops halfway through the second time, or `infinite`. Unlike CSS, where an animation plays once, a GSS animation loops forever by default. It wins over the count written in `animation`.",
    examples: [
      {
        name: "twice",
        code: "@scene { sphere; } sphere { radius: 0.5; color: #3a7bff; animation: rise 1.5s ease-in-out; animation-iteration-count: 2; } @keyframes rise { from { translate: 0 0.5 0; } to { translate: 0 2 0; } }",
      },
    ],
  },
  {
    name: "animation-direction",
    appliesTo: "everywhere",
    syntax: "normal | reverse | alternate | alternate-reverse",
    initial: "normal",
    description:
      "The way the animation plays, like CSS. It wins over the direction written in `animation`.",
    values: [
      ["normal", "Forward: the default."],
      ["reverse", "Backward."],
      ["alternate", "Forward, then backward."],
      ["alternate-reverse", "Backward, then forward."],
    ],
    examples: [
      {
        name: "back and forth",
        code: "@scene { sphere; } sphere { radius: 0.5; color: #3a7bff; animation: rise 1.5s ease-in-out; animation-direction: alternate; } @keyframes rise { from { translate: 0 0.5 0; } to { translate: 0 2 0; } }",
      },
    ],
  },
  {
    name: "animation-fill-mode",
    appliesTo: "everywhere",
    syntax: "none | forwards | backwards | both",
    initial: "none",
    description:
      "What the object shows outside the animation, like CSS. It matters only with a delay or a number of iterations.",
    values: [
      ["none", "Its own value: the default."],
      ["backwards", "The first frame, during the delay."],
      ["forwards", "The last frame, once the animation is over."],
      ["both", "The two."],
    ],
    examples: [
      {
        name: "staying at the top",
        text: "One iteration, and `forwards` keeps the last frame.",
        code: "@scene { sphere; } sphere { radius: 0.5; color: #3a7bff; animation: rise 1.5s ease-in-out; animation-iteration-count: 1; animation-fill-mode: forwards; } @keyframes rise { from { translate: 0 0.5 0; } to { translate: 0 2 0; } }",
      },
    ],
  },
  {
    name: "animation-timing-function",
    appliesTo: "everywhere",
    syntax: "<easing>",
    initial: "linear",
    description:
      "The easing of each step of the animation, like CSS. It wins over the easing written in `animation`.",
    values: [
      ["linear", "A constant speed: the default."],
      ["ease", "Speeds up quickly, then slows down."],
      ["ease-in, ease-out, ease-in-out", "Starts slowly, ends slowly, or both."],
      ["step-start, step-end", "One jump, at the start or at the end."],
      ["cubic-bezier(), linear()", "A curve of your own."],
      ["steps()", "Moves by equal jumps."],
    ],
    examples: [
      {
        name: "slowing down at the end",
        code: "@scene { sphere; } sphere { radius: 0.5; color: #3a7bff; animation: rise 1.5s ease-in-out; animation-timing-function: ease-out; } @keyframes rise { from { translate: 0 0.5 0; } to { translate: 0 2 0; } }",
      },
    ],
  },
  {
    name: "animation-timeline",
    appliesTo: "everywhere",
    syntax:
      "auto | scroll([root | nearest] || [block | inline | x | y]) | view([block | inline | x | y])",
    initial: "auto",
    description:
      "Drives the animation with the scroll of the page instead of time, like CSS scroll-driven animations. The whole timeline is the whole animation, so the duration and the delay do not count.",
    values: [
      ["auto", "The default: the animation plays in time."],
      ["scroll()", "A scroll container, from its start (0%) to its end (100%): `nearest` (the default) is the closest one around the scene, `root` the page. The axis is `block` (the default), `inline`, `y` or `x`."],
      ["view()", "The scene crossing its scroll container: 0% when it enters at the bottom, 100% when it leaves at the top."],
    ],
    details: "Write it after `animation`, which still needs a name and a duration: `animation: spin 1s linear; animation-timeline: scroll();`. The number of iterations and the direction still count, an animation without a count plays once along the scroll, and scrolling back plays it backward. A scene takes up to 4 different timelines. In the playground, which does not scroll, a slider stands in for the scroll.",
    examples: [
      {
        name: "turn with the page",
        text: "The cube turns and rises as the page scrolls.",
        code: "@scene { cube; } cube { translate: 0 0.6 0; corner-radius: 0.1; color: #ff5a36; animation: turn 1s linear; animation-timeline: scroll(); } @keyframes turn { from { rotate-y: 0deg; } to { rotate-y: -360deg; translate: 0 1.6 0; } }",
      },
      {
        name: "rise into view",
        text: "The spheres rise as the scene comes into view; the second one goes up and back.",
        code: "@scene { sphere * 3; } sphere { --x: calc(2 - sibling-index()); radius: 0.35; translate: var(--x) 0.35 0; color: #3a7bff; animation: rise 1s ease-out; animation-timeline: view(); } sphere:nth-child(2) { animation-iteration-count: 2; animation-direction: alternate; } @keyframes rise { to { translate: var(--x) 1.6 0; color: #3ad16b; } }",
      },
    ],
  },
  {
    name: "offset-path",
    appliesTo: "object",
    syntax: "none | path(<string>) | ray(<angle>)",
    initial: "none",
    description:
      "A motion path, like CSS: the line the object travels along, placed by `offset-distance` and turned by `offset-rotate`. It works on groups too.",
    values: [
      ["path(<string>)", "The `d` of an SVG path, in the object's own xy plane, facing the camera like the `path` shape: centered on itself, y up, one path unit per scene unit. A path shape with the same `d` draws the track; a path that ends with `Z` is closed, and the object goes round it."],
      ["ray(<angle>)", "A straight line from the place of the object, at an angle: `0deg` up, `90deg` right, like CSS."],
      ["none", "No motion path: the default."],
    ],
    details: "Like CSS, the motion path comes after `translate`, the rotations and `scale`: `translate` moves the whole path, `scale` scales it. For a path on the floor, turn a group with `rotate-x: 90deg`.",
    examples: [
      {
        name: "along a track",
        text: "A ball that follows the curve of a `path` drawn under it.",
        code: '@scene { path#track; sphere#ball; } #track { translate: 0 1.2 0; d: path("M-2 0 C-1 2 1 -2 2 0"); stroke-width: 0.04; color: #555555; } #ball { translate: 0 1.2 0; radius: 0.2; color: #ff5a36; offset-path: path("M-2 0 C-1 2 1 -2 2 0"); animation: go 3s ease-in-out alternate; } @keyframes go { to { offset-distance: 100%; } }',
      },
      {
        name: "round a closed path, turned along it",
        text: "A cube that laps a closed ellipse, turned along it.",
        code: '@scene { cube; } cube { translate: 0 1.2 0; size: 0.6 0.25 0.25; color: #3a7bff; offset-path: path("M-1.5 0 A1.5 1 0 1 1 1.5 0 A1.5 1 0 1 1 -1.5 0 Z"); animation: lap 4s linear; } @keyframes lap { to { offset-distance: 100%; } }',
      },
    ],
  },
  {
    name: "offset-distance",
    appliesTo: "object",
    animatable: true,
    syntax: "<number> | <percentage>",
    initial: "0",
    description:
      "How far along its `offset-path` the object is, like CSS: a number, in the units of the path, or a percentage of its length. Animate it with `@keyframes`, a `transition` on `:hover`, or the scroll.",
    details: "On an open path, the object stops at its ends; on a closed one (with `Z`), it goes round, so 150% is halfway through the second lap. A `ray()` has no length: give it a number.",
    examples: [
      {
        name: "three places on one path",
        text: "Three spheres at 0%, 50% and 100% of one path.",
        code: '@scene { sphere * 3; } sphere { translate: 0 1 0; radius: 0.25; color: #e6e6e6; offset-path: path("M-2 0 Q0 2 2 0"); offset-distance: calc((sibling-index() - 1) * 50%); } sphere:nth-child(2) { color: #ff5a36; }',
      },
      {
        name: "on :hover, along a ray",
        text: "Under the mouse, the cube slides 1.5 along a ray.",
        code: "@scene { cube; } cube { translate: 1 0.4 0; size: 0.5; color: #ff5a36; offset-path: ray(45deg); offset-rotate: 0deg; transition: 0.5s ease-out; } cube:hover { offset-distance: 1.5; }",
      },
    ],
  },
  {
    name: "offset-rotate",
    appliesTo: "object",
    syntax: "[auto | reverse] || <angle>",
    initial: "auto",
    description:
      "How the object turns along its `offset-path`, like CSS.",
    values: [
      ["auto", "The default: its x axis follows the path, like a car on a road."],
      ["reverse", "The same, turned the other way."],
      ["<angle>", "A fixed turn, like `rotate-z`: `0deg` keeps the object upright."],
      ["auto 90deg", "With `auto` or `reverse`, the angle is added to the turn along the path."],
    ],
    examples: [
      {
        name: "along the path, or upright",
        text: "The upper cube turns along the path; the lower one stays upright.",
        code: '@scene { cube#along; cube#upright; } cube { size: 0.5 0.2 0.2; color: #ff5a36; offset-path: path("M-2 0 C-1 2 1 -2 2 0"); animation: go 3s ease-in-out alternate; } #along { translate: 0 1.6 0; } #upright { translate: 0 0.6 0; color: #3a7bff; offset-rotate: 0deg; } @keyframes go { to { offset-distance: 100%; } }',
      },
    ],
  },
  {
    name: "size",
    appliesTo: ["cube", "plane"],
    syntax: "<number>{1,3} (cube) | <number>{1,2} (plane: width depth)",
    initial: "1 (cube), 1 (plane)",
    description:
      "Sets the size of a cube along the x, y and z axes: one value makes a cube, three make a box. On a plane, it sets the width and the depth: one value makes a square.",
    examples: [
      {
        name: "a box",
        text: "Twice as wide as it is high.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; size: 2 1 1; }",
      },
      {
        name: "a plane, stood up",
        text: "A width and a depth, on a plane turned like a wall.",
        code: "@scene { plane; } plane { translate: 0 1 0; rotate-x: 90deg; size: 2 1.5; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "corner-radius",
    appliesTo: ["cube"],
    syntax: "<number>",
    initial: "0.08",
    description: "Rounds the edges of a cube; 0 keeps them sharp.",
    examples: [
      {
        name: "rounded edges",
        code: "@scene { cube; } cube { translate: 0 0.5 0; corner-radius: 0.3; }",
      },
    ],
  },
  {
    name: "radius",
    appliesTo: ["sphere", "torus", "cylinder", "cone", "capsule"],
    syntax: "<number> | <number> <number> (cone: bottom top)",
    initial:
      "0.5 (sphere), 1 (torus), 0.5 (cylinder), 0.5 0 (cone), 0.25 (capsule)",
    description:
      "Sets the radius of a sphere, a cylinder or a capsule, or that of a torus ring, measured to the center of its tube.",
    details: "A cone takes a bottom and a top radius, like `border-radius` takes several values: the top one is 0 by default, a point, and a positive one cuts the top.",
    examples: [
      {
        name: "a big sphere",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 1; }",
      },
      {
        name: "a cut cone",
        text: "`radius: 0.5 0.2`: a wide base, a narrow top.",
        code: "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
      },
    ],
  },
  {
    name: "thickness",
    appliesTo: ["torus"],
    syntax: "<number>",
    initial: "0.28",
    description: "Sets the radius of the tube of a torus.",
    examples: [
      {
        name: "a thick ring",
        code: "@scene { torus; } torus { translate: 0 0.5 0; thickness: 0.5; }",
      },
    ],
  },
  {
    name: "height",
    appliesTo: ["cylinder", "cone", "capsule"],
    syntax: "<number>",
    initial: "1",
    description:
      "Sets the full height of a cylinder, a cone or a capsule, along the y axis. The shape is centered on its origin: to stand it on the floor, set its y to half its height.",
    details: "The height of a capsule counts its round ends, so it is at least twice its radius.",
    examples: [
      {
        name: "a tall cylinder",
        code: "@scene { cylinder; } cylinder { translate: 0 1 0; radius: 0.4; height: 2; }",
      },
      {
        name: "a cone",
        code: "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
      },
      {
        name: "a capsule",
        text: "1.5 high, round ends included.",
        code: "@scene { capsule; } capsule { translate: 0 0.75 0; radius: 0.25; height: 1.5; }",
      },
    ],
  },
  {
    name: "d",
    appliesTo: ["path", "prism", "lathe"],
    syntax: 'path("<svg path>") | polygon(<x> <y>, …) (prism, lathe)',
    initial: "none (required)",
    description:
      "The line a `path` follows, written like the `d` of an SVG path or CSS `path()`. On a `prism`, the contour to fill; on a `lathe`, the contour to turn around its axis: a `polygon()` or a `path()`.",
    valuesTitle: "Commands",
    values: [
      ["M", "Moves, without drawing."],
      ["L, H, V", "A line; a horizontal line; a vertical line."],
      ["C, S, Q, T", "Curves, like SVG."],
      ["A", "An arc of ellipse: `rx ry rotation large-arc sweep x y`, like SVG."],
      ["Z", "Closes the path."],
      ["polygon()", "On a prism or a lathe: one point per comma, x and y separated by a space, y going down, like CSS `clip-path`. It closes itself."],
    ],
    details: "Capitals are absolute, lowercase letters relative. A path copied from an SVG keeps its way up: y goes down in SVG and up in the scene, and GSS flips it. One path unit is one scene unit, so an icon drawn in a box of 24 or 32 usually needs a `scale`. On a prism or a lathe, each subpath of a `path()` is a closed contour, filled with the even-odd rule: a contour inside another one is a hole, like the inside of an o. A lathe turns its contour around x = 0, so its x are never negative.",
    examples: [
      {
        name: "a curve",
        text: "One cubic curve, `C`.",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0.5 C-1 -1 1 -1 1 0.5"); stroke-width: 0.25; color: #ff5a36; }',
      },
      {
        name: "a zigzag, scaled down",
        text: "Lines drawn 4 units wide, shown at half size by `scale`.",
        code: '@scene { path; } path { translate: 0 1.2 0; d: path("M0 0 L1 1.5 L2 0 L3 1.5 L4 0"); stroke-width: 0.3; scale: 0.5; material: gold; }',
      },
      {
        name: "a smiley",
        text: "Two arcs draw the face, a third one the smile.",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0 A1 1 0 1 1 1 0 A1 1 0 1 1 -1 0 M-0.4 -0.3 A0.5 0.5 0 0 0 0.4 -0.3"); stroke-width: 0.15; color: #ff5a36; }',
      },
      {
        name: "a thick line",
        text: "One straight line, with a wide `stroke-width`.",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0 L1 0"); stroke-width: 0.6; color: #3a7bff; }',
      },
    ],
  },
  {
    name: "stroke-width",
    appliesTo: ["path"],
    syntax: "<number>",
    initial: "1",
    description:
      "The thickness of the tube along the path, in path units, like the `stroke-width` of SVG. Its ends are round.",
    examples: [
      {
        name: "a thick line",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0 L1 0"); stroke-width: 0.6; color: #3a7bff; }',
      },
    ],
  },
  {
    name: "depth",
    appliesTo: ["prism"],
    syntax: "<number>",
    initial: "0.2",
    description:
      "The full thickness of a prism along the z axis, centered on its origin: `depth: 1` goes from z = -0.5 to z = 0.5.",
    examples: [
      {
        name: "a triangle, 1 deep",
        code: "@scene { prism; } prism { translate: 0 1 0; d: polygon(0 -1, 1 1, -1 1); depth: 1; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "view-box",
    appliesTo: ["path", "prism", "lathe"],
    syntax: "<number>{4}",
    initial: "the box of the path itself",
    description:
      "The drawing area of a path: x, y, width and height, like the `viewBox` of SVG. Its center becomes the origin of the object.",
    details: "Without it, each path is centered on itself; with the same `view-box`, the paths copied from one SVG keep their places relative to each other. On a lathe, only its y and its height count: the height is centered on them, and x = 0 stays the axis.",
    examples: [
      {
        name: "two braces of one icon",
        text: "Both paths share the 32 × 32 box of their icon, and keep their places.",
        code: '@scene { path#left; path#right; } path { translate: 0 1.6 0; view-box: 0 0 32 32; stroke-width: 2.4; scale: 0.1; color: #e6e6e6; } #left { d: path("M12.5 4.5C9.5 4.5 9 6 9 8.5v4c0 2-1 3.5-3.5 3.5C8 16 9 17.5 9 19.5v4c0 2.5.5 4 3.5 4"); } #right { d: path("M19.5 4.5C22.5 4.5 23 6 23 8.5v4c0 2 1 3.5 3.5 3.5C24 16 23 17.5 23 19.5v4c0 2.5-.5 4-3.5 4"); }',
      },
    ],
  },
  {
    name: "light",
    appliesTo: "scene",
    animatable: true,
    syntax: "none | <angle> <angle> [ <color> || <number> ]?",
    initial: "-45deg 54.7deg",
    description:
      "Sets the sun of the scene: its direction, then if needed its color and its intensity, in any order. The default lights the scene from the upper left, in front.",
    values: [
      ["<angle> <angle>", "The direction: the azimuth around the vertical axis (`0deg` points to +z, `90deg` to +x), then the elevation above the horizon (`90deg` is straight overhead)."],
      ["<color>", "The color of the sun, white by default."],
      ["<number>", "Its intensity, 1 by default."],
      ["none", "No sun: the scene is lit by its point lights and its `ambient` light."],
    ],
    details: "With `animation` on the scene, the sun can turn, change color, or rise from `none`.",
    examples: [
      {
        name: "a low sun from behind",
        text: "`-120deg 30deg`: from behind, on the left, low over the horizon.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { light: -120deg 30deg; }",
      },
      {
        name: "a warm sun",
        text: "An orange sun, low, with bluish shadows from `ambient`.",
        code: "@scene { sphere; } sphere { translate: 0 0.6 0; radius: 0.6; } scene { light: -60deg 25deg #ffb36b 1.2; ambient: 0.2 #6b8cff; }",
      },
      {
        name: "no sun",
        text: "`none`, and a point light instead.",
        code: "@scene { sphere; light#lamp; } sphere { translate: 0 0.6 0; radius: 0.6; } #lamp { translate: 1 1.5 1; intensity: 2.5; } scene { light: none; ambient: 0.05; }",
      },
      {
        name: "a day",
        text: "`@keyframes` on the scene move the sun from dawn to noon.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { animation: day 6s ease-in-out infinite alternate; } @keyframes day { from { light: -80deg 5deg #ff8a5c 0.6; } to { light: 60deg 70deg #ffffff 1; } }",
      },
    ],
  },
  {
    name: "intensity",
    since: "0.0.4",
    appliesTo: ["light"],
    animatable: true,
    syntax: "<number>",
    initial: "1",
    description:
      "How much light a point `light` gives: what a surface facing it receives at 1 unit, then less with the square of the distance, a quarter at 2 units and a ninth at 3. 0 turns it off.",
    examples: [
      {
        name: "a strong lamp",
        text: "An intensity of 4, two units above the sphere.",
        code: "@scene { light; sphere; } scene { light: none; ambient: 0.05; } light { translate: 0 2 1; intensity: 4; } sphere { translate: 0 0.6 0; radius: 0.6; }",
      },
    ],
  },
  {
    name: "ambient",
    appliesTo: "scene",
    syntax: "<number> <color>?",
    initial: "0.1",
    description:
      "Sets the light received by the surfaces the sun does not reach, from 0 (black shadows) to 1 (no shadows). A color can follow, for the light of the sky in the shadows: `ambient: 0.2 #9db4ff` gives bluish shadows under a warm sun.",
    examples: [
      {
        name: "lighter shadows",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { ambient: 0.4; }",
      },
    ],
  },
  {
    name: "camera-target",
    appliesTo: "scene",
    syntax: "<number>{3}",
    initial: "0 0.5 0",
    description: "Sets the point the camera looks at and turns around.",
    examples: [
      {
        name: "looking higher",
        text: "The cube is 2 units up, and so is the target.",
        code: "@scene { cube; } cube { translate: 0 2 0; } scene { camera-target: 0 2 0; }",
      },
    ],
  },
  {
    name: "camera-distance",
    appliesTo: "scene",
    syntax: "<number>",
    initial: "8",
    description:
      "Sets the distance between the camera and its target at the start, from 3 to 15. The mouse wheel changes it.",
    examples: [
      {
        name: "closer",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { camera-distance: 5; }",
      },
    ],
  },
  {
    name: "camera-angle",
    appliesTo: "scene",
    syntax: "<angle> <angle>",
    initial: "0deg 22.9deg",
    description:
      "Sets where the camera starts around its target: first the angle around the vertical axis (`0deg` in front, on +z; `90deg` on the right, on +x), then the height above the horizon, from `0deg` to `80deg`. Dragging with the mouse changes it.",
    examples: [
      {
        name: "from the front left, high above",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { camera-angle: -45deg 60deg; }",
      },
    ],
  },
  {
    name: "camera-spin",
    appliesTo: "scene",
    syntax: "<time> | none",
    initial: "none",
    description:
      "Sets how long the camera takes to turn once around its target, in `s` or `ms`. `none`, the default, keeps it still.",
    examples: [
      {
        name: "one turn in 40 s",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { camera-spin: 40s; }",
      },
    ],
  },
  {
    name: "floor",
    appliesTo: "scene",
    syntax: "<color> | <gradient> | none",
    initial: "#e8e3db",
    description:
      "Sets the color of the floor, an infinite plane at y = 0, lit like the objects. It can also be a gradient, a `noise()`, or one of them moved by `displace()`. `none` removes it: the objects float over the `background`, like the GSS logo.",
    values: [
      ["<color>", "Any opaque CSS color."],
      ["<gradient>", "`linear-gradient()`, `radial-gradient()` or `conic-gradient()`, spread over a square of 40 units centered under the scene: everything the scene draws."],
      ["noise()", "A noise read at each point of the floor, in the units of the scene: its scale is how many patterns fit in one unit."],
      ["none", "No floor."],
    ],
    details: "A gradient is seen from above, like on a `plane`: its top is away from the camera at rest, so `linear-gradient(#0b1020, #273d62)` goes from the horizon to the camera, and past the square it goes on with its first and last colors. A `displace()` moves the image by a share of that square: `0.02` moves it by up to 0.4 units. The floor takes one image, not layers, and opaque colors only. It is not animated, but the numbers of its image can be set from JavaScript. Reflections see it, and `fog` covers it like the rest of the scene.",
    examples: [
      {
        name: "a dark floor",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { floor: #1a1a1f; }",
      },
      {
        name: "no floor",
        text: "`floor: none`, over a dark background.",
        code: "@scene { sphere; } sphere { color: #ff5a36; material: jelly(0.6); } scene { floor: none; background: #0a0a0c; }",
      },
      {
        name: "a noise() on the floor",
        text: "Blue stone under a chrome sphere, which reflects it.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: noise(2 3, #10182b, #273d62 55%, #0b1020); background: #0b1020; }",
      },
      {
        name: "a pool of light",
        text: "A `radial-gradient()` that fades into the color of the background, around the scene.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: #ff5a36; } scene { floor: radial-gradient(circle, #4a4f6a, #0b1020 12%); background: #0b1020; }",
      },
    ],
  },
  {
    name: "filter",
    appliesTo: "everywhere",
    syntax: "none | <filter-function>+",
    initial: "none",
    description:
      "Post-processing, like CSS `filter`: a list of functions applied in order, on the whole image (`scene { filter }`), on an object, or on a group and everything in it.",
    valuesTitle: "Functions",
    values: [
      ["brightness(), contrast(), saturate()", "A number or a percentage: 1 or 100% changes nothing."],
      ["grayscale(), sepia(), invert()", "From 0 to 1: how far it goes."],
      ["hue-rotate()", "An angle around the color wheel."],
      ["grain()", "A film grain that moves at every frame (0.1 by default)."],
      ["blur()", "A blur, by a length in px, like CSS."],
      ["bloom()", "Makes the bright parts glow: an amount (0.6 by default) and a radius in px (16px by default)."],
      ["opacity()", "Makes an object or a group transparent, multiplied with `opacity`. On the scene, it is an error: the scene stays opaque."],
    ],
    details: "On an object or a group, the filters change only its own pixels, and the reflections see them too: a `blur()` spreads it over what is around it. Like CSS, an object's filter comes before its group's, and the scene's comes last; on an object, the filters that read one pixel come before `blur()` and `bloom()`, and an object and its group cannot both have one of them. `blur()` and `bloom()` read the pixels around each pixel, so they cost more as the radius grows; the other filters cost almost nothing.",
    examples: [
      {
        name: "brightness()",
        text: "The whole image, 1.4 times brighter.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { filter: brightness(1.4); }",
      },
      {
        name: "contrast()",
        text: "Darker darks, lighter lights.",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: contrast(1.6); }",
      },
      {
        name: "saturate()",
        text: "Twice the saturation.",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: saturate(2); }",
      },
      {
        name: "grayscale()",
        text: "No color left.",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: grayscale(1); }",
      },
      {
        name: "sepia()",
        text: "The tones of an old photograph.",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: sepia(0.8); }",
      },
      {
        name: "hue-rotate()",
        text: "Every hue turned by 120°.",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: hue-rotate(120deg); }",
      },
      {
        name: "invert()",
        text: "The negative of the image.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { filter: invert(1); }",
      },
      {
        name: "grain()",
        text: "A film grain over the image.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { background: #1a1a22; filter: grain(0.15); }",
      },
      {
        name: "blur()",
        text: "The whole image, blurred by 3px.",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: blur(3px); }",
      },
      {
        name: "bloom()",
        text: "Bright spheres that glow in the dark.",
        code: "@scene { sphere.light * 5; } .light { radius: 0.25; translate: calc(2.4 - sibling-index() * 0.8) 0.8 0; color: hsl(calc(sibling-index() * 40) 100% 70%); } scene { floor: none; background: #07070a; ambient: 1; filter: bloom(0.9, 20px); }",
      },
      {
        name: "filter on objects",
        text: "Each sphere has a filter of its own.",
        code: "@scene { sphere#a; sphere#b; sphere#c; } sphere { radius: 0.5; color: #ff5a36; } #a { translate: 1.3 0.6 0; filter: grayscale(1); } #b { translate: 0 0.6 0; filter: blur(4px); } #c { translate: -1.3 0.6 0; filter: hue-rotate(180deg) brightness(1.3); }",
      },
      {
        name: "filter on a group",
        text: "Only the spheres of the group glow.",
        code: "@scene { group#lights { sphere * 4 } cube; } #lights { filter: bloom(0.9, 18px); } #lights sphere { radius: 0.2; translate: calc(1.75 - sibling-index() * 0.7) 1.4 0; color: #ffd27a; } cube { translate: 0 0.5 0; color: #3a7bff; } scene { floor: none; background: #07070a; }",
      },
      {
        name: "opacity() on a group",
        text: "The group fades: its objects show through each other.",
        code: "@scene { group#g { cube; sphere; } } #g { filter: opacity(0.5); } cube { translate: -0.6 0.5 0; color: #3a7bff; } sphere { translate: 0.6 0.5 0; radius: 0.5; color: #ff5a36; }",
      },
      {
        name: "filters together",
        text: "Four filters, applied in the order written.",
        code: "@scene { torus; sphere; } torus { translate: 0 1 0; rotate-x: 70deg; color: #ffd27a; material: gold; } sphere { radius: 0.3; translate: 0 1 0; color: #ff5a36; } scene { floor: none; background: radial-gradient(#2a2a3a, #07070a); filter: contrast(1.1) saturate(1.3) bloom(0.7, 18px) grain(0.06); }",
      },
    ],
  },
  {
    name: "background",
    appliesTo: "scene",
    animatable: true,
    syntax: "[ <gradient> , ]* [ <gradient> | <color> ]",
    initial: "#080808",
    description:
      "Sets the background of the scene, seen wherever there is no object and no floor: a color, a gradient drawn over the canvas like a CSS background, a `noise()` or a `displace()`.",
    details: "Like CSS, a background can have several layers, separated by commas, the first on top: `noise(3, #ffffff00 40%, #ffffff), linear-gradient(#2f6bd8, #9fc4ff)`. Only the last layer can be a plain color; transparent colors let the layers below show through, and `background-blend-mode` blends them. With `animation` on the scene, a color changes into a color and a gradient into a gradient of the same kind, also through variables: without objects and floor, the scene is a moving image.",
    examples: [
      {
        name: "a color",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { background: #42429f; }",
      },
      {
        name: "a gradient",
        text: "A radial gradient, and no floor: the sphere floats in it.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { floor: none; background: radial-gradient(circle at 50% 40%, #2a2a3a, #07070a); }",
      },
      {
        name: "layers: clouds over a sky",
        text: "A transparent `noise()` over a blue gradient.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: noise(2 4, #ffffff00 45%, #ffffff 80%), linear-gradient(#2f6bd8, #9fc4ff); }",
      },
      {
        name: "animated background",
        text: "`@keyframes` moves the center of the gradient through `--x`.",
        code: "@scene { } scene { floor: none; --x: 20%; background: radial-gradient(circle at var(--x) 40%, #ffb36b, #ff6540 30%, #722cff 70%, #171322); animation: drift 8s ease-in-out alternate; filter: grain(0.06); } @keyframes drift { to { --x: 80%; } }",
      },
    ],
  },
  {
    name: "background-blend-mode",
    since: "0.0.4",
    appliesTo: "scene",
    syntax: "<blend-mode>#",
    initial: "normal",
    description:
      "How each layer of `background` blends with what is below it, like CSS: one mode per layer, the first for the top layer. A shorter list repeats over the layers.",
    valuesTitle: "Modes",
    values: [
      ["normal", "Covers what is below: the default."],
      ["multiply, screen", "Darkens, where white changes nothing; lightens, where black changes nothing."],
      ["overlay, soft-light, hard-light", "More contrast: multiplies the darks, screens the lights."],
      ["darken, lighten", "The darker or the lighter of the two colors."],
      ["color-dodge, color-burn", "Brightens or darkens what is below, by the color of the layer."],
      ["difference, exclusion", "The difference of the two colors; softer with `exclusion`."],
      ["hue, saturation, color, luminosity", "One part of the color of the layer, over the rest of the color below."],
    ],
    details: "The transparency of a layer still applies: a transparent part blends nothing.",
    examples: [
      {
        name: "a grain over a gradient",
        text: "A gray noise multiplied over a gradient, like a grain.",
        code: "@scene { } scene { floor: none; background: noise(40 2, #808080, #ffffff), linear-gradient(135deg, #ff5a36, #3a7bff); background-blend-mode: multiply; }",
      },
      {
        name: "two noises, screened",
        text: "Two noises over black, lightened together by `screen`.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: noise(3 3, #000000 45%, #ff5a36), noise(2 4 seed 3, #000000 40%, #3a7bff), #000000; background-blend-mode: screen; }",
      },
    ],
  },
  {
    name: "fog",
    since: "0.0.4",
    appliesTo: "scene",
    animatable: true,
    syntax: "none | [ <color> ]? <number> <number> [ <color> ]?",
    initial: "none",
    description:
      "Fills the scene with fog, measured from the camera: none before the first distance, only fog after the second one, and more and more of it between. Without a color, each object fades into the background behind it.",
    values: [
      ["<number> <number>", "Where the fog starts, and where it hides everything."],
      ["<color>", "Its color, before or after the distances. The background takes it too: past the fog, only the fog is seen."],
      ["none", "No fog: the default."],
    ],
    details: "The scene draws nothing farther than 20 units from the camera: a fog that ends before that hides the far edge of the floor. The scene can animate its fog, from `none` too. The reflections and the refractions show the objects without fog.",
    examples: [
      {
        name: "into the background",
        text: "The cubes melt into the background as they go away.",
        code: "@scene { cube * 7; } cube { size: 0.6; translate: calc((sibling-index() - 4) * -1.1) 0.3 calc(sibling-index() * -1.6); color: #ff5a36; } scene { background: #c9d6e3; fog: 3 13; }",
      },
      {
        name: "a colored fog",
        text: "A warm fog, whose color the background takes.",
        code: "@scene { sphere * 5; } sphere { radius: 0.4; translate: 0 0.4 calc(sibling-index() * -2); color: #3a7bff; } scene { fog: #e8e0d4 2 11; camera-angle: 20deg 12deg; }",
      },
      {
        name: "the fog rolls in",
        text: "The fog rolls in, from `none`.",
        code: "@scene { cylinder * 9; } cylinder { radius: 0.15; height: 1.6; translate: calc((sibling-index() - 5) * -0.9) 0.8 calc(sibling-index() * -1.2); color: #e6e6e6; } scene { background: #1a1d2b; floor: #2a2e40; fog: none; animation: roll 6s ease-in-out infinite alternate; } @keyframes roll { to { fog: 1 7; } }",
      },
    ],
  },
  {
    name: "shadows",
    since: "0.0.4",
    appliesTo: "scene",
    syntax: "none | hard | soft",
    initial: "none",
    description:
      "Lets the objects cast shadows, on the floor and on each other: a point in the shadow of an object keeps only the `ambient` light.",
    values: [
      ["none", "No shadow: the default."],
      ["soft", "A penumbra that grows with the distance to the object that casts it, like the shadow of the sun."],
      ["hard", "A sharp edge."],
    ],
    details: "The sun and every point `light` cast shadows, and the holes of `mask-image` let the light through. Each light costs one more ray per pixel. The reflections and the refractions show the objects without shadows.",
    examples: [
      {
        name: "soft shadows",
        text: "The shadows of the sun blur as they get farther from the objects.",
        code: "@scene { sphere; cube; } scene { shadows: soft; light: -30deg 50deg; } sphere { translate: -0.6 0.9 0; radius: 0.5; color: #ff5a36; } cube { translate: 0.7 0.4 0.3; size: 0.8; color: #3a7bff; }",
      },
      {
        name: "hard shadows from a lamp",
        text: "A lamp and no sun: sharp shadows.",
        code: "@scene { light; sphere; } scene { shadows: hard; light: none; ambient: 0.15; } light { translate: 0.8 2.4 0.6; intensity: 4; color: #ffd27a; } sphere { translate: 0 0.7 0; radius: 0.6; }",
      },
      {
        name: "light through holes",
        text: "The holes of a mask let the sun through.",
        code: "@scene { sphere; } scene { shadows: soft; light: 20deg 70deg; } sphere { translate: 0 1.2 0; radius: 0.9; mask-image: noise(4 3, black 48%, transparent 52%); }",
      },
    ],
  },
  {
    name: "dpr",
    appliesTo: "scene",
    syntax: "auto | max | <number>",
    initial: "auto",
    description:
      "Sets the pixel density of the render, like the device pixel ratio of the screen.",
    values: [
      ["auto", "The density of the screen, up to 2: the default."],
      ["max", "The density of the screen, however high: the sharpest render, and the slowest."],
      ["<number>", "From 0.25 to 4, never above the screen's. Below 1, the render is coarser and faster."],
    ],
    note: {
      title: "The density follows the computer.",
      text: "A scene starts at a density of 0.5, then climbs to its `dpr` while the frames keep up, and lowers it while they are slow: a weak graphics card never draws a heavy scene at full density at once. When it is still far too slow at 0.5, the scene stops and offers to draw it anyway. In the playground and in the examples of these docs, the dpr menu at the top right of the render picks the density for you: `auto` follows the frame rate, a number replaces the `dpr`, never above the screen's. Your choice is kept in this browser.",
    },
    examples: [
      {
        name: "as sharp as the screen",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { dpr: max; }",
      },
      {
        name: "half the density",
        text: "Coarser, and faster to draw.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { dpr: 0.5; }",
      },
    ],
  },
  {
    name: "shape-rendering",
    since: "0.0.6",
    appliesTo: "scene",
    syntax: "auto | geometricPrecision",
    initial: "auto",
    description:
      "Smooths the silhouettes of the objects, without raising the pixel density of the render.",
    values: [
      ["auto", "The default: each pixel shows one surface, and silhouettes keep their steps."],
      ["geometricPrecision", "A pixel that the edge of an object only partly covers blends the object with what is behind it: the silhouettes come out smooth."],
    ],
    details:
      "Like `shape-rendering` in SVG, but on the scene only, with two values: `auto` keeps the sharp edges GSS has always drawn. The smoothing comes from the ray each pixel already casts, not from more rays or a bigger render. Only silhouettes are smoothed: the edges of a texture, of a shadow or of the floor keep their steps.",
    note: {
      title: "Heavier to draw, for now.",
      text: "With `geometricPrecision`, the graphics card does about 15 % more work for the same scene, more on some heavy scenes. On a weak computer, the scene lowers its density sooner, and a scene already at the limit may stop and offer to draw it anyway. Keep `auto` on a heavy scene.",
    },
    examples: [
      {
        name: "smooth silhouettes",
        text: "The sphere keeps one ray per pixel; only its grazing edge gets partial coverage.",
        code: "@scene { sphere; } scene { shape-rendering: geometricPrecision; floor: none; } sphere { radius: 1; }",
      },
    ],
  },
  {
    name: "view",
    since: "0.0.5",
    appliesTo: "scene",
    syntax: "shaded | distance",
    initial: "shaded",
    description:
      "Shows the scene as it is lit, or with the isolines of its distance field over it: the distance to the nearest object, which the shader measures at every step of every ray.",
    values: [
      ["shaded", "The scene, lit: the default."],
      ["distance", "The same scene, with a line every 0.25 units from the objects, fainter as it goes away. The lines lie on the plane that faces the camera through `camera-target`, and show where that plane is in front of the objects."],
    ],
    details: "The floor is left out of the distance: the lines go around the objects only. Far from a `path`, a `prism` or a `lathe`, the distance is the one to its box, which the shader uses to skip it quickly, and the lines show that box. The lines are light on a dark scene and dark on a light one.",
    note: {
      title: "Two chips switch it here.",
      text: "In the playground and in the examples of these docs, the chips `view: shaded` and `view: distance` at the top left of the render switch the view, without touching the code; when the code changes its `view`, the code wins again. On your own site, the `view` of the scene applies.",
    },
    examples: [
      {
        name: "the distance around a sphere",
        text: "Rings around the sphere, one every 0.25.",
        code: "@scene { sphere; } sphere { translate: 0 0.5 0; } scene { view: distance; }",
      },
      {
        name: "on a dark scene",
        text: "Without a floor, on a dark background: the lines of the field around two objects meet halfway.",
        code: "@scene { sphere; cube; } sphere { translate: -0.8 0.5 0; color: #ff5a36; } cube { translate: 0.8 0.5 0; color: #e8e6e1; } scene { view: distance; floor: none; background: #0a0a0c; }",
      },
    ],
  },
];

export const AT_RULES: AtRuleDef[] = [
  {
    name: "scene",
    syntax:
      "@scene { <shape>[#<id>][.<class>]* [* <integer>][;] … group[#<id>][.<class>]* [* <integer>] { … } }",
    description:
      "Declares the objects of the scene, one per line: a shape, then an optional `#id`, any number of `.classes`, and `* n` for n copies. Objects are combined in the order they are declared: see `operation`.",
    valuesTitle: "Parts",
    values: [
      ["<shape>", "`cube`, `sphere`, `torus`… one of the shapes, or a point `light`."],
      ["#<id>", "One per object. A multiplied id is numbered: `torus#ring * 3` makes `ring-1`, `ring-2` and `ring-3`."],
      [".<class>", "Any number of them: `sphere.ball.big`."],
      ["* <integer>", "Copies of the object, each a sibling of its own."],
      ["group { … }", "Holds objects and other groups, to move, turn or scale them together. A multiplied group copies everything inside it."],
    ],
    details: "The `;` after an object is optional: a new object or a `}` is enough.",
    examples: [
      {
        name: "a single cube",
        text: "The smallest scene: one object, with the default style.",
        code: "@scene { cube; }",
      },
      {
        name: "ids, classes and copies",
        text: "A `#base` cube and three `.ball` spheres, styled by their id and their class.",
        code: "@scene { cube#base; sphere.ball * 3; } #base { translate: 0 0.5 0; } .ball { translate: 0 1.5 0; radius: 0.3; }",
      },
      {
        name: "a group",
        text: "The two cubes of `#tower` move and turn with their group.",
        code: "@scene {\n  cube#base\n  group#tower {\n    cube#a\n    cube#b\n  }\n}\n#base { translate: 1 0.5 0; }\n#tower { translate: -1 0 0; rotate-y: -30deg; }\n#a { translate: 0 0.5 0; }\n#b { translate: 0 1.5 0; scale: 0.7; }",
      },
    ],
  },
  {
    name: "keyframes",
    syntax: "@keyframes <name> { <offset>[, <offset>]* { <declaration>* } … }",
    description:
      "Defines the steps of an animation, played by the `animation` property, like CSS.",
    valuesTitle: "Offsets",
    values: [
      ["from", "The start: `0%`."],
      ["to", "The end: `100%`."],
      ["<percentage>", "A step in between. Several offsets can share a frame: `0%, 100% { … }`."],
    ],
    details: "A missing `0%` or `100%` uses the object's own value, and a frame changes only the properties it declares. A frame takes animatable properties only.",
    examples: [
      {
        name: "up and down",
        text: "Two frames, played forward then backward by `alternate`.",
        code: "@scene { sphere; } sphere { animation: float 2s ease-in-out alternate; } @keyframes float { from { translate: 0 1 0; } to { translate: 0 2 0; } }",
      },
      {
        name: "a pulse",
        text: "`0%` and `100%` share a frame; at `50%`, the cube grows and changes color.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; animation: pulse 1s; } @keyframes pulse { 0%, 100% { scale: 1; } 50% { scale: 1.3; color: #ff5a36; } }",
      },
    ],
  },
  {
    name: "property",
    since: "0.0.4",
    syntax: '@property --<name> { syntax: "<number>" | "<angle>" | "<percentage>" | "<color>" | "<length>"; inherits: true | false; initial-value: <value>; }',
    description:
      "Registers a variable that the page changes from JavaScript while the scene runs, without compiling it again, like CSS `@property`. Like a variable on `:root`, it has one value for the whole scene.",
    valuesTitle: "Descriptors",
    values: [
      ["syntax", "What the variable holds: `\"<number>\"`, `\"<angle>\"`, `\"<percentage>\"`, `\"<color>\"`, or `\"<length>\"` in px, for the radius of `blur()` and `bloom()`."],
      ["inherits", "Required, like CSS: `true` or `false`."],
      ["initial-value", "Its value until the page sets another one. `scene { --lift: 2; }` gives another start value; declared anywhere else, on an object, a group, a `:hover` rule or a frame, the variable is an error. A frame can read it."],
    ],
    details: "It goes wherever the shader reads a value at each frame: the transforms (`translate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale`, `transform-origin`), `color`, `opacity`, `background`, `mask-image`, the sizes of the shapes (`size`, `radius`, `height`, `thickness`, `corner-radius`, `stroke-width`, `depth`), the numbers of a gradient, `material`, `floor`, `ambient`, `light` and the `intensity` of the point lights, `fog`, `camera-target`, `blend`, `offset-distance`, `offset-rotate`, `texture-size` and `filter`, alone or inside the math and color functions. It cannot go where the scene is built when it compiles: the copies of `* n`, `d` and `view-box`, the timing of animations and transitions, the camera the mouse moves, `dpr` and `random()`. A value set from JavaScript is never refused: it is kept in its range, so a size never goes below 0. With `@property-panel`, the playground and Try it show a control for each registered variable over the render.",
    examples: [
      {
        name: "a number",
        text: "The sphere rises with `--lift`, which the page sets with `scene.setProperty(\"--lift\", \"2\")`.",
        code: '@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; } @scene { sphere; } sphere { translate: 0 var(--lift) 0; radius: 0.5; color: #ff5a36; }',
      },
      {
        name: "a color and an angle",
        text: "`scene { --tint: … }` gives a start value other than `initial-value`.",
        code: '@property --tint { syntax: "<color>"; inherits: false; initial-value: #3a7bff; } @property --turn { syntax: "<angle>"; inherits: false; initial-value: 30deg; } @scene { cube; } scene { --tint: #ff5a36; } cube { translate: 0 0.8 0; rotate-y: var(--turn); color: var(--tint); }',
      },
      {
        name: "inside math and color functions",
        text: "`--hue` goes through `calc()`, `sin()` and `oklch()`, computed by the GPU at each frame.",
        code: '@property --hue { syntax: "<number>"; inherits: false; initial-value: 20; } @scene { sphere * 5; } sphere { radius: 0.35; translate: calc(sibling-index() * 0.8 - 2.4) calc(0.6 + sin(var(--hue) * 1deg) * 0.3) 0; color: oklch(70% 0.16 calc(var(--hue) + sibling-index() * 30)); }',
      },
    ],
    see: [
      { anchor: "set-variables", label: "Set variables from JavaScript" },
      { anchor: "at-property-panel", label: "@property-panel" },
    ],
  },
  {
    name: "paint",
    since: "0.0.6",
    syntax: "@paint <name> { <fragment shader> }",
    description:
      "A texture drawn by a fragment shader, for `texture: paint(<name>)`. The block is GLSL, the shader language of WebGL, written as it is for the web: an image that comes from code, like `paint()` in CSS.",
    valuesTitle: "Uniforms",
    values: [
      ["time", "The time of the scene, in seconds, a `float`. `u_time` works too. A shader that reads it is drawn again at every frame; one that does not is drawn once."],
      ["resolution", "The size of the texture in pixels, `vec2(512.0, 512.0)`. `u_resolution` works too."],
      ["mouse", "The pointer over the scene, in the pixels of the texture, from its bottom left like `gl_FragCoord`. `u_mouse` works too."],
    ],
    details:
      "The block is a whole fragment shader: its uniforms, its functions and its `main()`. Write `out vec4 color;` and set it, or set `gl_FragColor` as in WebGL1; GSS adds `#version 300 es` and a `precision` when the code has none. It is drawn into a texture of 512 by 512 pixels, which the object shows like an image, on each of its faces, with `texture-size` and `image-rendering`. Each `@paint` runs on its own: its names never meet the rest of the scene, and an error in its GLSL names the `@paint` and its line in the file. A scene with `paint()` is drawn with WebGL2.",
    note: {
      title: "GLSL, not CSS.",
      text: "Everything else in GSS is CSS: `@paint` is a way out for the textures CSS cannot describe. Try the gradients and `noise()` first: they are lighter, and they work with WebGPU too.",
    },
    examples: [
      {
        name: "rings that flow",
        text: "The shader reads `time`: it is drawn again at every frame, and the colors flow over the cube.",
        code: `@paint rings {
  uniform float time;
  uniform vec2 resolution;
  out vec4 color;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    color = vec4(0.5 + 0.5 * cos(time + uv.xyx * 6.0 + vec3(0.0, 2.0, 4.0)), 1.0);
  }
}
@scene { cube; }
cube { translate: 0 0.8 0; rotate-y: 30deg; texture: paint(rings); }`,
      },
      {
        name: "a checkerboard, drawn once",
        text: "Without `time`, the shader is drawn once, and the texture stays.",
        code: `@paint checks {
  out vec4 color;

  void main() {
    vec2 cell = floor(gl_FragCoord.xy / 64.0);
    float on = mod(cell.x + cell.y, 2.0);
    color = vec4(mix(vec3(0.12), vec3(0.95), on), 1.0);
  }
}
@scene { sphere; }
sphere { translate: 0 1 0; texture: paint(checks); }`,
      },
    ],
    see: [
      { anchor: "fn-paint", label: "paint()" },
      { anchor: "texture", label: "texture" },
    ],
  },
  {
    name: "property-panel",
    since: "0.0.5",
    syntax: "@property-panel { display: open | folded | none; }",
    description:
      "Shows a control for each variable of `@property` over the render, in the playground and in Try it: a slider and its number, or a color picker for a color. Moving a control sets the variable without compiling the scene again.",
    valuesTitle: "Descriptors",
    values: [
      ["display", "`open`, the default: the panel shows its controls. `folded`: only its title, `variables · 2`, which opens it. `none`: no panel, as without the rule."],
    ],
    details:
      "A slider goes from 0 to twice the start value of its variable, at least from 0 to 1, and around 0 for a negative value; an angle from 0 to 360deg, a percentage from 0% to 100%. A number typed past the end of a slider widens it, and the reset button gives the start value back. When the code changes a start value, the code wins over the slider. The panel never writes into the code, and a page that embeds the scene shows no panel: it sets the variables with `setProperty()`.",
    examples: [
      {
        name: "a slider",
        text: "Drag `--lift` and the sphere rises, without compiling again.",
        code: '@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; } @property-panel { display: open; } @scene { sphere; } sphere { translate: 0 var(--lift) 0; radius: 0.5; color: #ff5a36; }',
      },
      {
        name: "folded, with a color and an angle",
        text: "The panel starts folded: its title opens it.",
        code: '@property --tint { syntax: "<color>"; inherits: false; initial-value: #3a7bff; } @property --turn { syntax: "<angle>"; inherits: false; initial-value: 30deg; } @property-panel { display: folded; } @scene { cube; } cube { translate: 0 0.8 0; rotate-y: var(--turn); color: var(--tint); }',
      },
    ],
    see: [
      { anchor: "at-property", label: "@property" },
      { anchor: "set-variables", label: "Set variables from JavaScript" },
    ],
  },
  {
    name: "media",
    syntax: "@media <media-query> { <rule> … }",
    description:
      "Applies rules only when the screen matches a media query, like CSS. When the screen changes, a window resized or the system switching to dark mode, the scene follows at once and the camera stays where it is.",
    valuesTitle: "Queries",
    values: [
      ["(max-width: 600px)", "The width of the viewport; also `min-width`, in `px` or `em`."],
      ["(orientation: portrait)", "Taller than wide; `landscape` otherwise."],
      ["(prefers-color-scheme: dark)", "The dark mode of the system; `light` for the light mode."],
      ["(prefers-reduced-motion)", "The visitor asks for less motion."],
      ["and, not, ,", "Combine queries, like CSS."],
    ],
    details: "The browser reads the query, so any media query CSS knows works. Inside, the rules join the cascade where the `@media` is written, with their usual specificity. A scene can use up to 4 different queries, and `@media` holds rules only: `@scene` and `@keyframes` go outside it.",
    examples: [
      {
        name: "a small screen",
        text: "Under 600px wide, the render is lighter, with `dpr: 1`, and the sphere turns blue.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } @media (max-width: 600px) { scene { dpr: 1; } sphere { color: #3a7bff; } }",
      },
      {
        name: "less motion",
        text: "`* { animation: none !important; }` stops every animation for the visitors who ask for less motion.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; animation: bob 2s ease-in-out alternate; } @keyframes bob { to { translate: 0 1.6 0; } } @media (prefers-reduced-motion) { * { animation: none !important; } }",
      },
      {
        name: "dark mode",
        text: "The background, the floor and the sphere follow the light or dark mode of the system.",
        code: "@scene { sphere; } scene { background: #f2efe9; floor: #e8e3db; } sphere { translate: 0 1 0; color: #ff5a36; } @media (prefers-color-scheme: dark) { scene { background: #080808; floor: #1a1a1f; } sphere { color: #3a7bff; } }",
      },
    ],
  },
];

export const SELECTORS: SelectorDef[] = [
  {
    name: "<shape>",
    anchor: "selector-type",
    specificity: "1",
    description:
      "A shape name targets every object of that shape: `cube` styles every cube, and `group` every group.",
    examples: [
      {
        name: "every cube, every sphere",
        code: "@scene { cube; sphere; } cube { translate: 0.8 0.5 0; color: #ff5a36; } sphere { translate: -0.8 0.5 0; }",
      },
    ],
  },
  {
    name: ".class",
    anchor: "selector-class",
    specificity: "100 per class",
    description:
      "Targets every object that has this class in `@scene`. An object can have several classes, and a selector can ask for several at once: `.a.b`.",
    examples: [
      {
        name: "a class on one of two cubes",
        code: "@scene { cube#a.red; cube#b; } #a { translate: 0.8 0.5 0; } #b { translate: -0.8 0.5 0; } .red { color: #ff5a36; }",
      },
    ],
  },
  {
    name: "#id",
    anchor: "selector-id",
    specificity: "10000",
    description:
      "Targets the object with this id. A multiplied id is numbered: `torus#hero * 3` makes `hero-1`, `hero-2` and `hero-3`.",
    examples: [
      {
        name: "one sphere, by its id",
        code: "@scene { sphere#hero; sphere; } sphere { translate: -0.8 0.5 0; } #hero { translate: 0.8 0.5 0; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "*",
    anchor: "selector-universal",
    specificity: "0",
    description:
      "Targets every object, never the settings of the scene. Any other selector beats it, wherever it is written: use it for defaults.",
    examples: [
      {
        name: "a default for every object",
        text: "Every object is red, except the sphere, whose own rule wins.",
        code: "@scene { cube; sphere; } * { color: #ff5a36; } cube { translate: 0.8 0.5 0; } sphere { translate: -0.8 0.5 0; color: #3ad16b; }",
      },
    ],
  },
  {
    name: "a, b",
    anchor: "selector-list",
    specificity: "Each selector keeps its own",
    description:
      "A selector list gives the same declarations to each selector it names, as if the rule were written once for each.",
    examples: [
      {
        name: "two ids, one rule",
        code: "@scene { cube#a; cube#b; sphere; } #a, #b { color: #ff5a36; } #a { translate: 1.2 0.5 0; } #b { translate: 0 0.5 0; } sphere { translate: -1.2 0.5 0; }",
      },
    ],
  },
  {
    name: "a b",
    anchor: "selector-descendant",
    specificity: "The sum of its parts",
    description:
      "A space means \"inside\": `#letters cube` targets the cubes of the group `#letters`, at any depth.",
    details: "Like CSS, it reads from right to left: the last part is the object, and each part before it is one of its groups, further out each time. `#letters#S` asks for one object with two ids, which never exists: it is an error.",
    examples: [
      {
        name: "the cubes of a group",
        text: "The two cubes inside `#letters` turn red; the one outside does not.",
        code: "@scene { cube#a; group#letters { cube#b; cube#c; } } cube { translate: 1.2 0.5 0; } #letters cube { color: #ff5a36; } #b { translate: 0 0.5 0; } #c { translate: -1.2 0.5 0; }",
      },
    ],
  },
  {
    name: "a > b",
    anchor: "selector-child",
    specificity: "The sum of its parts",
    description:
      "Targets direct children: `#g > cube` is the cubes right inside `#g`, not those of a nested group.",
    details: "It combines with spaces and sibling combinators: `#g > group cube`. The spaces around `>` are optional, and combinators add no specificity.",
    examples: [
      {
        name: "direct children only",
        text: "Only `#direct` turns red: `#nested` is inside another group.",
        code: "@scene { group#g { cube#direct; group { cube#nested; } } } cube { translate: 0.8 0.5 0; } #nested { translate: -0.8 0.5 0; } #g > cube { color: #ff5a36; }",
      },
    ],
  },
  {
    name: "a + b",
    anchor: "selector-adjacent",
    specificity: "The sum of its parts",
    description:
      "Targets the next sibling, with the same parent: `sphere + cube` is a cube declared right after a sphere, in `@scene` or in a group.",
    details: "The order is the order of declaration, copies of `* n` included, not the position in 3D. Groups count as siblings, empty ones too. `sphere:hover + cube` reacts only to the sphere right before. The spaces around `+` are optional.",
    examples: [
      {
        name: "the cube right after the sphere",
        text: "`#a` turns red, and grows while the sphere is hovered; `#b` does not.",
        code: "@scene { sphere; cube#a; cube#b; } sphere { translate: 1.4 0.5 0; radius: 0.4; } #a { translate: 0 0.5 0; } #b { translate: -1.4 0.5 0; } sphere + cube { color: #ff5a36; } sphere:hover + cube { scale: 1.2; }",
      },
    ],
  },
  {
    name: "a ~ b",
    anchor: "selector-sibling",
    specificity: "The sum of its parts",
    description:
      "Targets every later sibling, with the same parent: `sphere ~ cube` is every cube after a sphere, even with other objects between them.",
    details: "It never targets an earlier sibling, nor the children of a sibling. Each copy of `* n` counts, and so do groups, empty ones too. Chains can mix every combinator, and the spaces around `~` are optional.",
    examples: [
      {
        name: "every cube after the sphere",
        text: "Both cubes after the sphere turn red; the one before does not.",
        code: "@scene { cube#before; sphere; cube#after * 2; } * { translate: calc((sibling-index() - 2.5) * -1.3) 0.5 0; } sphere { radius: 0.4; } sphere ~ cube { color: #ff5a36; }",
      },
    ],
  },
  {
    name: "&",
    anchor: "selector-nesting",
    since: "0.0.4",
    specificity: "The sum of the rule around it and of the nested selector",
    description:
      "Nesting, like CSS: a rule can hold other rules, and `&` stands for the selector of the rule around it. In `#g { &:hover { … } }`, the nested rule is `#g:hover`.",
    valuesTitle: "Forms",
    values: [
      ["&:hover", "Joined to the parent: `#g:hover`."],
      ["#g &", "The parent, placed anywhere: `.a { #g & { … } }` is `#g .a`."],
      ["cube", "Without `&`, the parent comes first, then a space: `#g { cube { … } }` is `#g cube`."],
      ["> sphere", "A leading combinator: `#g { > sphere { … } }` is `#g > sphere`."],
      ["@media", "A query inside a rule: its declarations apply to that rule when the query matches."],
    ],
    details: "Rules nest at any depth, and `&` also works inside `:has()` and `:not()`. The declarations written after a nested rule come after it in the cascade, like CSS. With a list as the parent, `a, b { & c { … } }` gives `a c` and `b c`, each with its own specificity, where CSS gives both the specificity of the most specific selector of the list.",
    examples: [
      {
        name: "a group and what it holds",
        text: "One rule styles the group, its cubes, their `:hover`, and its direct sphere.",
        code: "@scene { group#row { cube.a * 3; sphere; } } #row { color: #e6e6e6; cube { size: 0.6; translate: calc((sibling-index() - 2.5) * -1) 0.3 0; &:hover { color: #ff5a36; } } > sphere { radius: 0.35; translate: -1.5 0.35 0; color: #3a7bff; } }",
      },
      {
        name: "a @media inside a rule",
        text: "On a narrow screen, the torus changes color.",
        code: "@scene { torus; } torus { radius: 0.8; thickness: 0.25; rotate-x: 70deg; color: #3a7bff; @media (max-width: 600px) { color: #ff5a36; } }",
      },
    ],
  },
  {
    name: "::face(), ::top, ::bottom",
    anchor: "selector-face",
    specificity: "1, like a tag, added to the rest",
    description:
      "A pseudo-element, like `::part()` in CSS: the rule styles one face of the object, not the object. A face takes `texture` only.",
    valuesTitle: "Faces",
    values: [
      ["top, bottom", "Up (+y) and down, in the object's own space: the faces turn with it."],
      ["front, back", "Toward +z and toward −z."],
      ["right, left", "Toward +x and toward −x."],
      ["::top, ::bottom", "Shortcuts for `::face(top)` and `::face(bottom)`."],
    ],
    details: "A face without a rule of its own shows the texture of the object. On a round shape, a face is the part that looks that way the most: a sphere is cut like the cube around it. Like CSS, the pseudo-element ends the selector: `cube.grass::top`, never `#g::top cube`.",
    examples: [
      {
        name: "::face()",
        text: "One face gets its own texture; the other five keep the object's.",
        code: '@scene { cube.furnace; } .furnace { translate: 0 0.5 0; rotate-y: -30deg; texture: url("/textures/dirt.png"); image-rendering: pixelated; } .furnace::face(front) { texture: url("/textures/grass-top.png"); }',
      },
      {
        name: "::top",
        text: "A grass block: the top has its own texture.",
        code: '@scene { cube.grass; } .grass { translate: 0 0.5 0; texture: url("/textures/grass-side.png"); image-rendering: pixelated; } .grass::top { texture: url("/textures/grass-top.png"); }',
      },
      {
        name: "::bottom",
        text: "The block is turned over: its bottom face, now on top, shows dirt.",
        code: '@scene { cube.flip; } .flip { translate: 0 0.6 0; rotate-x: 150deg; texture: url("/textures/grass-side.png"); image-rendering: pixelated; } .flip::bottom { texture: url("/textures/dirt.png"); }',
      },
      {
        name: "::face(), ::top and ::bottom together",
        text: "Two grass blocks, the second turned over: each face keeps its texture as the block turns.",
        code: '@scene { cube.grass * 2; } .grass { translate: calc(2.1 - sibling-index() * 1.4) 0.5 0; rotate-y: -30deg; rotate-x: calc(sibling-index() * 150deg - 150deg); texture: url("/textures/grass-side.png"); image-rendering: pixelated; } .grass::top { texture: url("/textures/grass-top.png"); } .grass::bottom { texture: url("/textures/dirt.png"); } .grass::face(front) { texture: url("/textures/dirt.png"); }',
      },
    ],
  },
  {
    name: ":hover",
    anchor: "selector-hover",
    specificity: "100, like a class, added to the rest",
    description:
      "A pseudo-class, like CSS: the rule applies while the mouse is over the object. With `transition`, the change glides instead of jumping.",
    valuesTitle: "Where it goes",
    values: [
      ["cube:hover.big", "Anywhere after the shape name."],
      ["sphere:hover + cube", "On an earlier sibling: the cube reacts to the sphere."],
      ["#letters:hover cube", "On a group: every cube of `#letters` reacts as soon as the mouse is over any object of the group, like hovering a child hovers its parent in CSS."],
      ["#g:has(sphere:hover)", "Inside `:has()`: hovering one object changes another."],
    ],
    details: "The `:hover` rules join the cascade like any other: `#a { color: blue; }` beats `cube:hover { color: red; }`, and a normal `!important` beats them all. A `:hover` rule changes animatable properties only (the transforms, `color`, `opacity`, `mask-image`, `offset-distance` and variables), never a face, and it styles objects, not groups: write `#g:hover cube`, not `#g:hover { … }`. It can also start an `animation`: it begins when the pointer arrives and plays to its end, pointer gone or not (see `:active`).",
    examples: [
      {
        name: "lift on hover",
        text: "Each cube rises, rotates and turns red under the mouse.",
        code: "@scene { cube#a; cube#b; } cube { translate: 0.8 0.5 0; color: #e6e6e6; } #b { translate: -0.8 0.5 0; } cube:hover { translate: 0.8 1 0; color: #ff5a36; rotate-y: -45deg; } #b:hover { translate: -0.8 1 0; }",
      },
      {
        name: "hover a group",
        text: "The mouse over any letter lights up every letter of `#letters`.",
        code: "@scene { group#letters { cube#l1; cube#l2; cube#l3; } sphere; } #letters { translate: 1.6 0.5 0; } #letters cube { size: 0.4 1 0.4; color: #e6e6e6; } #l2 { translate: -0.7 0 0; } #l3 { translate: -1.4 0 0; } #letters:hover cube { color: #ff5a36; scale: 1.15; } sphere { translate: -1.4 0.5 0; radius: 0.5; }",
      },
    ],
  },
  {
    name: ":active",
    anchor: "selector-active",
    specificity: "100, like a class, added to the rest",
    description:
      "A pseudo-class, like CSS: the rule applies while the object is pressed, with the mouse button or a finger. Like CSS, it stays pressed until the button goes up, even if the pointer leaves it.",
    valuesTitle: "Where it goes",
    values: [
      ["#button:active", "On the object pressed."],
      ["sphere:active + cube", "On an earlier sibling."],
      ["#g:active cube", "On a group: every cube of `#g` is pressed when any of its objects is."],
      ["#lamp:has(#switch:active) #bulb", "Inside `:has()`: press one object, change another."],
    ],
    details: "A pressed object is under the pointer, so its `:hover` rules still apply, and `:active` wins over them at equal specificity when written after them: `cube:hover { scale: 1.1; } cube:active { scale: 0.95; }` grows under the mouse and sinks when clicked. Like `:hover`, it changes animatable properties only, and styles objects, not groups. With `transition`, pressing takes the transition of the `:active` rule, and releasing the one of the hovered state. An `animation` in a `:active` rule starts at the press and plays to its end, released or not, like a button that fires: once, unless it says how many times; the pressed state stays on until the animation ends, or for good with `forwards`, and the next press plays it again.",
    examples: [
      {
        name: "a button that sinks when pressed",
        text: "It rises under the mouse, and sinks quickly while pressed.",
        code: "@scene { cube#button; } #button { size: 1.2 0.3 1.2; corner-radius: 0.1; translate: 0 0.15 0; color: #e6e6e6; transition: 0.25s ease-out; } #button:hover { color: #ff5a36; translate: 0 0.25 0; } #button:active { translate: 0 0.05 0; color: #c2401f; transition: 0.06s; }",
      },
      {
        name: "a click starts an animation",
        text: "The press starts the fall, which plays to its end even once the button is up; `forwards` keeps the cube down, and the next click plays it again.",
        code: "@scene { cube; } cube { size: 0.6 1.6 0.6; translate: 0 0.8 0; color: #ff5a36; } cube:active { animation: topple 0.8s ease-in forwards; } @keyframes topple { to { rotate-z: -90deg; translate: -0.8 0.3 0; } }",
      },
      {
        name: "press one, move another",
        text: "Pressing the switch lights the bulb, through `:has()`.",
        code: "@scene { group#lamp { cylinder#switch; sphere#bulb; } } #switch { radius: 0.3; height: 0.2; translate: 0.8 0.1 0; color: #888888; } #switch:active { scale: 0.9; } #bulb { radius: 0.45; translate: -0.6 0.6 0; color: #555555; transition: 0.4s ease-out; } #lamp:has(#switch:active) #bulb { color: #ffd27a; scale: 1.15; }",
      },
    ],
  },
  {
    name: ":has()",
    anchor: "selector-has",
    specificity:
      "the most specific selector inside, added to the rest, like CSS",
    description:
      "A pseudo-class, like CSS: a group matches when something inside it, at any depth, matches the selector in the parentheses. With `:hover` inside, hovering one object can change another.",
    valuesTitle: "Forms",
    values: [
      ["#g:has(sphere)", "The groups that hold a sphere, read once, when the scene compiles."],
      ["#g:has(sphere:hover)", "While a sphere of `#g` is under the mouse."],
      ["#g:has(#inner sphere)", "A descendant selector, read from the group down."],
      ["#g:has(sphere, cube)", "A list: one match is enough."],
      ["group:has(> sphere)", "A leading combinator, relative to the subject: here, direct children."],
      ["cube:has(+ sphere)", "The next sibling, or any later one with `~`. Chains work too: `cube:has(+ group > sphere)`."],
    ],
    details: "Without a leading sibling combinator, `:has()` goes on a group: an object holds nothing, so `cube:has(sphere)` is an error. Empty groups can match, and a `:has()` cannot hold another one. Unlike CSS, a list that mixes a static selector with `:hover` matches only during a hover.",
    examples: [
      {
        name: "the groups that hold a sphere",
        text: "Only the cube of `#a`, the group with a sphere, turns blue.",
        code: "@scene { group#a { sphere#sa; cube#ca; } group#b { cube#cb; } } #a { translate: 1 0 0; } #b { translate: -1 0 0; } sphere { translate: 0 1.4 0; radius: 0.3; } cube { translate: 0 0.5 0; color: #e6e6e6; } group:has(sphere) cube { color: #3a7bff; }",
      },
      {
        name: "the next sibling, under the mouse",
        text: "The cube reacts when the sphere right after it is hovered.",
        code: "@scene { cube; sphere; } cube { translate: 0.8 0.5 0; transition: 0.3s ease-out; } sphere { translate: -0.8 0.5 0; radius: 0.4; } cube:has(+ sphere:hover) { color: #ff5a36; scale: 1.2; }",
      },
      {
        name: "hover one object, change another",
        text: "Hovering the bulb changes the stand of the same lamp.",
        code: "@scene { group#lamp { sphere#bulb; cylinder#stand; } } #bulb { translate: 0 1.6 0; radius: 0.35; color: #e6e6e6; } #stand { translate: 0 0.6 0; radius: 0.08; height: 1.2; color: #888888; transition: 0.3s ease-out; } #lamp:has(#bulb:hover) #stand { color: #ff5a36; scale: 1.2; }",
      },
    ],
  },
  {
    name: ":not()",
    anchor: "selector-not",
    specificity: "its most specific selector, added to the rest, like CSS",
    description:
      "A pseudo-class, like CSS: the object matches when none of the selectors in the parentheses does. `cube:not(.red)` is every cube without the class `red`.",
    valuesTitle: "Forms",
    values: [
      [":not(.red, torus)", "A list: leaves out both."],
      ["cube:not(#g cube)", "Any selector, read from the object outwards: every cube outside `#g`."],
      ["cube:not(:first-child, :last-child)", "The cubes in the middle."],
      ["group:not(:has(sphere))", "The groups without a sphere."],
      [":not(.a):not(.b)", "Several in a row."],
    ],
    details: "It weighs like the most specific selector of its list, like CSS: `cube:not(#hero)` beats `#hero` alone. It is read once, when the scene compiles: it cannot hold `:hover` or a face.",
    examples: [
      {
        name: "every cube but the red ones",
        text: "Every cube rises, except the two `.red` ones.",
        code: "@scene { cube.red; cube * 3; cube.red; } cube { size: 0.6; translate: calc((sibling-index() - 3) * -0.9) 0.3 0; } .red { color: #ff5a36; } cube:not(.red) { color: #e6e6e6; translate: calc((sibling-index() - 3) * -0.9) 0.8 0; }",
      },
      {
        name: "the ones in the middle",
        text: "The spheres between the first and the last turn blue.",
        code: "@scene { sphere * 6; } sphere { radius: 0.3; translate: calc((sibling-index() - 3.5) * -0.75) 0.4 0; color: #e6e6e6; } sphere:not(:first-child, :last-child) { color: #3a7bff; }",
      },
    ],
  },
  {
    name: ":nth-child(), :nth-last-child()",
    anchor: "selector-nth-child",
    specificity: "100, like a class, plus the most specific selector after of",
    description:
      "A pseudo-class, like CSS: the position of the object among its siblings, the objects of the same `@scene` block or group, counted from 1. `:nth-last-child()` counts from the end.",
    valuesTitle: "Arguments",
    values: [
      ["3", "The third sibling."],
      ["odd, even", "Every other one: 1, 3, 5… or 2, 4, 6…"],
      ["An+B", "A formula where `n` runs from 0 up: `2n+1` is 1, 3, 5…, `3n` every third, `-n+3` the first three."],
      ["An+B of <selector>", "Counts only the siblings that match the list, and the object must match it too: `:nth-child(2 of .red)` is the second `.red`."],
    ],
    details: "Each copy of `* n` is a sibling of its own: in `@scene { cube * 4; sphere; }`, `cube:nth-child(odd)` is cubes 1 and 3, and the sphere is child 5, as `sibling-index()` counts. Groups count as siblings, and the count starts again inside each group. The position is read once, when the scene compiles: `of` cannot hold `:hover`.",
    examples: [
      {
        name: "odd, and every third",
        text: "The odd cubes turn red, and every third one rises.",
        code: "@scene { cube * 7; } cube { size: 0.6; translate: calc((sibling-index() - 4) * -0.8) 0.3 0; color: #e6e6e6; } cube:nth-child(odd) { color: #ff5a36; } cube:nth-child(3n) { translate: calc((sibling-index() - 4) * -0.8) 1 0; }",
      },
      {
        name: "even of .lit, and the last child",
        text: "The even ones among the `.lit` spheres turn blue, and the last child grows.",
        code: "@scene { sphere.lit * 3; sphere * 2; sphere.lit * 3; } sphere { radius: 0.3; translate: calc((sibling-index() - 4.5) * -0.75) 0.4 0; color: #555555; } .lit { color: #e6e6e6; } :nth-child(even of .lit) { color: #3a7bff; } :nth-last-child(1) { scale: 1.3; }",
      },
    ],
  },
  {
    name: ":nth-of-type(), :nth-last-of-type()",
    anchor: "selector-nth-of-type",
    specificity: "100, like a class",
    description:
      "Like `:nth-child()`, counting only the siblings of the same shape: in `@scene { cube * 2; sphere; cube; }`, `cube:nth-of-type(3)` is the last cube, though it is the fourth child.",
    details: "The type is the shape name (`cube`, `sphere`, `group`…), like the tag of an HTML element. It takes the same `An+B` as `:nth-child()`, without `of`.",
    examples: [
      {
        name: "even cubes, last sphere",
        text: "Counted among their own shape, the even cubes turn red and the last sphere blue.",
        code: "@scene { cube * 2; sphere; cube * 2; sphere; } * { translate: calc((sibling-index() - 3.5) * -0.9) 0.4 0; color: #e6e6e6; } cube { size: 0.6; } sphere { radius: 0.35; } cube:nth-of-type(even) { color: #ff5a36; } sphere:nth-last-of-type(1) { color: #3a7bff; }",
      },
    ],
  },
  {
    name: ":first-child, :last-child, :only-child",
    anchor: "selector-first-child",
    specificity: "100, like a class",
    description:
      "Shortcuts, like CSS: `:first-child` is `:nth-child(1)` and `:last-child` is `:nth-last-child(1)`. Each has an `-of-type` form that counts only the siblings of the same shape. They take no argument.",
    valuesTitle: "Forms",
    values: [
      [":first-child", "The first sibling."],
      [":last-child", "The last sibling."],
      [":only-child", "An object without siblings."],
      [":first-of-type", "The first of its shape: `cube:first-of-type` is the first cube of its block, even after a sphere."],
      [":last-of-type", "The last of its shape."],
      [":only-of-type", "The only one of its shape among its siblings."],
    ],
    details: "They read the order of `@scene`, not the position in 3D.",
    examples: [
      {
        name: "first and last child",
        text: "The first cube turns red, the last one blue.",
        code: "@scene { cube * 5; } cube { size: 0.6; translate: calc((sibling-index() - 3) * -0.9) 0.3 0; color: #e6e6e6; } cube:first-child { color: #ff5a36; } cube:last-child { color: #3a7bff; }",
      },
      {
        name: "first of type, only child",
        text: "In `#a`, the first cube follows a sphere and is still `:first-of-type`; the lone cube of `#b` is an only child.",
        code: "@scene { group#a { sphere; cube * 2; } group#b { cube; } } #a { translate: 1 0 0; } #b { translate: -1.4 0 0; } * { color: #e6e6e6; } sphere { translate: 0 1.2 0; radius: 0.3; } cube { size: 0.5; translate: calc(0.9 - sibling-index() * 0.6) 0.25 0; } cube:first-of-type { color: #ff5a36; } cube:only-child { color: #3a7bff; }",
      },
    ],
  },
  {
    name: "!important",
    anchor: "selector-important",
    specificity: "Beats every declaration without it",
    description:
      "Written after a value, it makes the declaration win against every normal one, whatever their selectors. Between two `!important` declarations, specificity decides again.",
    details: "The cascade picks one value and never combines them: `* { scale: 0.5 !important; }` gives every object a scale of 0.5; it does not halve their own.",
    examples: [
      {
        name: "a default that wins",
        text: "`#a` asks for green, but the `!important` red of `*` wins.",
        code: "@scene { cube#a; sphere; } * { color: #ff5a36 !important; } #a { translate: 0.8 0.5 0; color: #3ad16b; } sphere { translate: -0.8 0.5 0; }",
      },
    ],
  },
];

// Every shape of SHAPES in shader/codegen/shapes.ts must be documented here: a test checks it
export const SHAPE_DOCS: ShapeDef[] = [
  {
    name: "cube",
    description:
      "A box with slightly rounded edges, centered on its origin: 1 × 1 × 1 by default. `size` stretches it into any box, and `corner-radius` rounds its edges.",
    examples: [
      {
        name: "a cube on the floor",
        code: "@scene { cube; } cube { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "sphere",
    description:
      "A ball centered on its origin, with a `radius` of 0.5 by default.",
    examples: [
      {
        name: "a sphere on the floor",
        code: "@scene { sphere; } sphere { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "torus",
    description:
      "A ring lying flat around the y axis: a `radius` of 1 to the center of its tube, and a tube of 0.28 by default, set by `thickness`.",
    examples: [
      {
        name: "a torus on the floor",
        code: "@scene { torus; } torus { translate: 0 0.28 0; }",
      },
    ],
  },
  {
    name: "cylinder",
    description:
      "A cylinder standing on the y axis, centered on its origin: a `radius` of 0.5 and a `height` of 1 by default.",
    examples: [
      {
        name: "a cylinder on the floor",
        code: "@scene { cylinder; } cylinder { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "cone",
    description:
      "A cone standing on the y axis, centered on its origin, pointing up: a `radius` of 0.5 and a `height` of 1 by default. A second radius cuts its top.",
    examples: [
      {
        name: "a cone on the floor",
        code: "@scene { cone; } cone { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "capsule",
    description:
      "A cylinder with round ends, standing on the y axis and centered on its origin: a `radius` of 0.25 and a `height` of 1 by default, round ends included.",
    examples: [
      {
        name: "a capsule on the floor",
        code: "@scene { capsule; } capsule { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "path",
    description:
      "A tube with round ends that follows an SVG path, given by `d`. `stroke-width` and `view-box` work like in SVG.",
    examples: [
      {
        name: "a curve",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0.5 C-1 -1 1 -1 1 0.5"); stroke-width: 0.25; color: #ff5a36; }',
      },
    ],
  },
  {
    name: "plane",
    description:
      "A thin, flat rectangle lying in the xz plane, centered on its origin: 1 × 1 by default. `size` sets its width and its depth, and `rotate-x: 90deg` stands it up, like a wall.",
    examples: [
      {
        name: "a mat on the floor",
        code: "@scene { plane; } plane { translate: 0 0.01 0; size: 3 2; color: #3ad16b; }",
      },
    ],
  },
  {
    name: "prism",
    description:
      "A contour, filled, then given a `depth`: a flat object, like a star, a letter, an arrow, a logo. The contour is a `polygon()` or a `path()` (see `d`), and a contour inside another one is a hole.",
    details: "It stands in the xy plane, facing the camera, centered on its contours (or on its `view-box`), like a path. To make a round object of a contour, like a vase or a bowl, turn it with a `lathe` instead.",
    examples: [
      {
        name: "a gold star",
        text: "A star, from a `polygon()` of ten points.",
        code: "@scene { prism; } prism { translate: 0 1 0; d: polygon(0 -1, -0.25 -0.34, -0.95 -0.31, -0.4 0.13, -0.59 0.81, 0 0.42, 0.59 0.81, 0.4 0.13, 0.95 -0.31, 0.25 -0.34); depth: 0.3; material: gold; }",
      },
      {
        name: "a square with a round hole",
        text: "A `path()` with two contours: the circle inside the square is a hole.",
        code: '@scene { prism; } prism { translate: 0 1 0; d: path("M-1 -1 H1 V1 H-1 Z M0 -0.6 A0.6 0.6 0 1 1 0 0.6 A0.6 0.6 0 1 1 0 -0.6 Z"); depth: 0.4; color: #ff5a36; }',
      },
    ],
  },
  {
    name: "lathe",
    since: "0.0.5",
    description:
      "A contour, filled, then turned around the vertical axis, like clay on a potter's wheel: a vase, a bowl, a bottle, a chess piece. A `prism` pushes its contour straight back into a flat plate; a lathe turns it into an object that is round from every side. The contour is a `polygon()` or a `path()` (see `d`), drawn right of the axis x = 0.",
    details: "Draw half the outline: x is the distance from the axis, and y goes down, like SVG. A contour that does not touch the axis turns into a ring, and a contour inside another one is a hole. The height is centered on the contours (or on the `view-box`), and y goes up in the scene, like a path. Seen from the front, a prism and a lathe of the same contour can look alike; turned, the prism is a cut-out as thick as its `depth`, and the lathe stays round.",
    examples: [
      {
        name: "a lathe and a prism of the same contour",
        text: "Both turned by 60deg: the lathe, on the left, is a vase from every side; the prism is a flat plate.",
        code: '@scene { lathe; prism; } lathe, prism { d: path("M0 -1 H0.35 C0.35 -0.7 0.2 -0.6 0.2 -0.4 C0.2 0 0.75 0.3 0.6 0.7 C0.55 0.9 0.45 1 0 1 Z"); rotate-y: 60deg; color: #c8643c; } lathe { translate: -0.9 1 0; } prism { translate: 0.9 1 0; depth: 0.3; }',
      },
      {
        name: "a vase",
        text: "A `path()` of three curves, from the neck to the foot, closed along the axis.",
        code: '@scene { lathe; } lathe { translate: 0 1 0; d: path("M0 -1 H0.35 C0.35 -0.7 0.2 -0.6 0.2 -0.4 C0.2 0 0.75 0.3 0.6 0.7 C0.55 0.9 0.45 1 0 1 Z"); color: #c8643c; }',
      },
      {
        name: "a bowl",
        text: "The contour goes up the outer wall and comes down the inner one: the bowl is hollow.",
        code: '@scene { lathe; } lathe { translate: 0 0.4 0; d: path("M0 0.4 H0.35 C0.9 0.4 1 0 1 -0.4 H0.92 C0.92 0.05 0.75 0.3 0.3 0.3 H0 Z"); color: #f2efe8; }',
      },
      {
        name: "a ring",
        text: "A square away from the axis: once turned, a ring with a hole in its middle.",
        code: "@scene { lathe; } lathe { translate: 0 0.15 0; d: polygon(0.6 -0.15, 1 -0.15, 1 0.15, 0.6 0.15); material: gold; }",
      },
    ],
  },
  {
    name: "group",
    description:
      "Not a shape: it holds objects and other groups, like `<g>` in SVG, and draws nothing itself. Its `translate`, rotations and `scale` apply to everything inside it, and the positions of its children become relative to it.",
    details: "Its other properties (`color`, `material`, `size`…) are not passed down to its children: to style them, use a descendant selector, like `#letters cube`.",
    takes: [
      "filter",
      "translate",
      "rotate-x",
      "rotate-y",
      "rotate-z",
      "scale",
      "transform-origin",
      "animation",
      "animation-duration",
      "animation-delay",
      "animation-iteration-count",
      "animation-direction",
      "animation-fill-mode",
      "animation-timing-function",
      "animation-timeline",
      "offset-path",
      "offset-distance",
      "offset-rotate",
    ],
    examples: [
      {
        name: "letters moved as one",
        text: "The group places and turns its three cubes together.",
        code: "@scene { group#letters { cube#l; cube#u; cube#c; } } #letters { translate: 1 0.5 0; rotate-y: -20deg; } #letters cube { size: 0.3 1 0.3; color: #ff5a36; } #u { translate: -1 0 0; } #c { translate: -2 0 0; }",
      },
      {
        name: "a group that turns",
        text: "An animation on the group turns both spheres around its center.",
        code: "@scene { group#spin { sphere#a; sphere#b; } } #spin { translate: 0 0.6 0; animation: turn 4s linear; } #a { translate: 0.8 0 0; radius: 0.4; } #b { translate: -0.8 0 0; radius: 0.4; } @keyframes turn { to { rotate-y: -1turn; } }",
      },
    ],
  },
  {
    name: "light",
    since: "0.0.4",
    description:
      "Not a shape: a point of light, which draws nothing. Its `color` is the color of its light (white by default), and `intensity` how much light it gives, on top of the sun and the `ambient` light of the scene.",
    details: "It moves like an object: `translate`, the groups it is in, animations, `:hover` through its group, a motion path, and rotations around a `transform-origin`, in numbers, since a light has no size. Lights add up, 8 at most per scene. A light is never drawn, so it cannot be hovered or pressed: to see the bulb, put a shape at its place, and hover the shape, like `#lamp:hover light`. Without `shadows`, the light goes through the objects.",
    takes: [
      "color",
      "intensity",
      "translate",
      "rotate-x",
      "rotate-y",
      "rotate-z",
      "transform-origin",
      "transition",
      "animation",
      "animation-duration",
      "animation-delay",
      "animation-iteration-count",
      "animation-direction",
      "animation-fill-mode",
      "animation-timing-function",
      "animation-timeline",
      "offset-path",
      "offset-distance",
      "offset-rotate",
    ],
    examples: [
      {
        name: "a lamp",
        text: "A warm bulb, with a faint ambient light and no sun.",
        code: "@scene { light#bulb; sphere; } scene { light: none; ambient: 0.05; } #bulb { translate: 0.9 1.6 0.9; color: #ffd27a; intensity: 2; } sphere { translate: 0 0.6 0; radius: 0.6; }",
      },
      {
        name: "colored lights",
        text: "A red and a blue light, one on each side of a white cube.",
        code: "@scene { light#warm; light#cold; cube; } scene { light: none; ambient: 0.05; } #warm { translate: -1.4 1.4 1; color: #ff5a36; intensity: 3; } #cold { translate: 1.4 1.4 1; color: #3a7bff; intensity: 3; } cube { translate: 0 0.5 0; color: #ffffff; }",
      },
      {
        name: "a light that moves",
        text: "A firefly that circles the sphere, around its `transform-origin`.",
        code: "@scene { light#firefly; sphere; } scene { light: none; ambient: 0.05; } #firefly { translate: 1.2 0.8 0; transform-origin: -1.2 0 0; color: #b6ff6b; intensity: 1.5; animation: circle 4s linear; } sphere { translate: 0 0.6 0; radius: 0.5; } @keyframes circle { to { rotate-y: 1turn; } }",
      },
      {
        name: "a lamp to hover",
        text: "Hovering the lamp turns its light up.",
        code: "@scene { light#bulb; group#lamp { sphere#shade; cube#stand; } } scene { light: none; ambient: 0.15; } #shade { translate: 0 1.5 0; radius: 0.3; color: #ffd27a; } #stand { translate: 0 0.6 0; size: 0.1 1.2 0.1; } #bulb { translate: 0 1.1 0.5; intensity: 0.2; transition: 0.4s; } #bulb:has(+ #lamp:hover) { intensity: 3; }",
      },
    ],
  },
];

export const FUNCTIONS: FunctionDef[] = [
  {
    name: "cubic-bezier()",
    anchor: "fn-cubic-bezier",
    covers: ["cubic-bezier"],
    syntax: "cubic-bezier(<x1>, <y1>, <x2>, <y2>)",
    description:
      "An easing curve, like CSS, for `animation` and `transition`. The curve goes from (0, 0) to (1, 1), pulled by two handles: x is the time, from 0 to 1, and y the progress, which can go below 0 or above 1 to overshoot.",
    valuesTitle: "Keywords",
    values: [
      ["ease", "`cubic-bezier(0.25, 0.1, 0.25, 1)`"],
      ["ease-in", "`cubic-bezier(0.42, 0, 1, 1)`"],
      ["ease-out", "`cubic-bezier(0, 0, 0.58, 1)`"],
      ["ease-in-out", "`cubic-bezier(0.42, 0, 0.58, 1)`"],
    ],
    examples: [
      {
        name: "an overshoot",
        text: "y goes below 0, then above 1: the sphere crouches, then jumps past the top.",
        code: "@scene { sphere; } sphere { translate: 0 0.5 0; radius: 0.5; color: #ff5a36; animation: jump 1.2s cubic-bezier(0.3, -0.4, 0.7, 1.4) alternate; } @keyframes jump { to { translate: 0 2 0; } }",
      },
    ],
  },
  {
    name: "linear()",
    anchor: "fn-linear",
    covers: ["linear"],
    syntax: "linear(<number> [<percentage>{0,2}], …)",
    description:
      "An easing drawn as straight segments, like CSS: each number is the progress at one moment, a percentage of the duration. With enough points, it draws bounces and springs.",
    details: "A missing moment is spread evenly between its neighbours; the first point is at 0% and the last one at 100%. Two percentages on one number hold it still between them, and two points at the same moment jump. The keyword `linear` is `linear(0, 1)`: a constant speed.",
    examples: [
      {
        name: "a bounce",
        text: "The sphere falls and bounces twice before it rests.",
        code: "@scene { sphere; } sphere { radius: 0.4; color: #3a7bff; animation: drop 2s linear(0, 1 40%, 0.75 55%, 1 70%, 0.95 80%, 1); } @keyframes drop { from { translate: 0 3 0; } to { translate: 0 0.4 0; } }",
      },
    ],
  },
  {
    name: "steps()",
    anchor: "fn-steps",
    covers: ["steps"],
    syntax:
      "steps(<integer>, [jump-start | jump-end | jump-none | jump-both | start | end]?) | step-start | step-end",
    description:
      "An easing that moves by equal jumps instead of gliding, like CSS: `steps(4)` holds still, then jumps, four times. Good for ticking hands, sprites and anything mechanical.",
    valuesTitle: "Positions",
    values: [
      ["jump-end, end", "The default: a jump at the end of each step, so the last value comes only at the very end."],
      ["jump-start, start", "A jump at the start of each step."],
      ["jump-both", "A jump at both ends."],
      ["jump-none", "The first and the last values each hold for a whole step."],
      ["step-start, step-end", "`steps(1, jump-start)` and `steps(1, jump-end)`."],
    ],
    examples: [
      {
        name: "a ticking hand",
        text: "Twelve jumps per turn, like the hand of a clock.",
        code: "@scene { cube; } cube { size: 1.2 0.15 0.15; translate: 0 0.6 0; color: #ff5a36; animation: tick 6s steps(12); } @keyframes tick { from { rotate-y: 0deg; } to { rotate-y: -360deg; } }",
      },
      {
        name: "step-start and step-end",
        text: "The same blink, jumping at the start or at the end.",
        code: "@scene { sphere#a; sphere#b; } sphere { radius: 0.4; } #a { translate: 0.8 0.5 0; color: #3a7bff; animation: blink 1s step-start; } #b { translate: -0.8 0.5 0; color: #3ad16b; animation: blink 1s step-end; } @keyframes blink { 50% { scale: 1.6; } }",
      },
    ],
  },
  {
    name: "<gradient>",
    anchor: "fn-gradients",
    computed: "on the GPU, at each pixel",
    covers: [
      "linear-gradient",
      "radial-gradient",
      "repeating-linear-gradient",
      "repeating-radial-gradient",
      "conic-gradient",
      "repeating-conic-gradient",
    ],
    syntax:
      "linear-gradient([<angle> | to <side> <side>?]?, <color> <percentage>{0,2}, …) | radial-gradient([circle | ellipse]? [closest-side | farthest-side | closest-corner | farthest-corner]? [at <position>]?, <color> <percentage>{0,2}, …) | conic-gradient([from <angle>]? [at <position>]?, <color> [<angle> | <percentage>]{0,2}, …)",
    description:
      "The gradients of CSS, for the `background` of the scene, the `color` of an object, the color of a material and the `floor`. Each color can have one or two positions; the missing ones are spread like CSS, and two colors at the same place make a hard edge.",
    valuesTitle: "Functions",
    values: [
      ["linear-gradient()", "Along a line, `to bottom` by default. It takes an angle (`0deg` up, `90deg` right), or `to` a side or a corner."],
      ["radial-gradient()", "An ellipse that reaches the farthest corner by default. It takes `circle` or `ellipse`, a size keyword and a position: `at 30% 40%`, `at top`."],
      ["conic-gradient()", "Around a center, clockwise from the top: `from 90deg` starts a quarter turn later, and `at 30% 40%` moves the center. Its colors take angles or percentages: a color wheel, a pie chart, the sweep of a hand."],
      ["repeating-linear-gradient()", "Repeats the stops; also `repeating-radial-gradient()` and `repeating-conic-gradient()`."],
    ],
    details: "In the background, the gradient covers the canvas and follows its size; reflections and glass see it in the direction they look. On an object, it covers the object as seen from the front, from left to right and from bottom to top (a plane is seen from above): `to top` goes from its bottom to its top, whatever its size, and it moves and turns with the object. On the `floor`, it covers a square of 40 units centered under the scene, seen from above. Colors are mixed in sRGB, like CSS with hex colors.",
    examples: [
      {
        name: "linear-gradient()",
        text: "A diagonal background, `to top right`.",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: #f4f1ea; } scene { floor: none; background: linear-gradient(to top right, #ff5a36, #3a7bff); }",
      },
      {
        name: "radial-gradient()",
        text: "A `circle closest-side` behind a glass sphere.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: glass; } scene { floor: none; background: radial-gradient(circle closest-side, #ffd27a, #ff5a36 60%, #1a0f2e); }",
      },
      {
        name: "linear-gradient() on objects",
        text: "A gradient on a cylinder and on a cube, and one in the material of a sphere.",
        code: "@scene { cylinder; sphere; cube; } cylinder { radius: 0.4; height: 2; translate: 1.4 1 0; color: linear-gradient(#ff5a36, #ffd27a); } sphere { radius: 0.7; translate: 0 0.7 0; material: metal(radial-gradient(circle at 35% 65%, #ffffff, #3a7bff 40%, #10183a), 0.15); } cube { size: 1; translate: -1.4 0.5 0; rotate-y: -30deg; color: repeating-linear-gradient(45deg, #3ad16b 0% 10%, #f4f1ea 10% 20%); }",
      },
      {
        name: "conic-gradient()",
        text: "A color wheel on a dial, stripes in a metal, and a conic background.",
        code: "@scene { cube#dial; sphere; } #dial { size: 2 2 0.1; corner-radius: 0.05; translate: 0.4 1.2 0; color: conic-gradient(#ff5a36, #ffd27a, #3ad16b, #3a7bff, #b15aff, #ff5a36); } sphere { radius: 0.5; translate: -1.4 0.5 0.6; material: metal(repeating-conic-gradient(from 45deg, #f4f1ea 0deg 30deg, #111111 30deg 60deg), 0.3); } scene { floor: none; background: conic-gradient(from 180deg at 50% 0%, #1c1c24, #2a2a3a, #1c1c24); }",
      },
      {
        name: "repeating-linear-gradient() and repeating-radial-gradient()",
        text: "Stripes behind two chrome spheres.",
        code: "@scene { sphere#a; sphere#b; } sphere { radius: 0.6; translate: 0 1 0; material: chrome; } #a { translate: 0.8 1 0; } #b { translate: -0.8 1 0; } scene { floor: none; background: repeating-linear-gradient(45deg, #111 0% 5%, #2a2a3a 5% 10%); }",
      },
    ],
  },
  {
    name: "noise()",
    anchor: "fn-noise",
    since: "0.0.4",
    covers: ["noise"],
    computed: "on the GPU, at each pixel",
    syntax:
      "noise([turbulence]? <number> <integer>? [seed <integer>]? [at <number> <number> <number>]?, <color> <percentage>{0,2}, …)",
    description:
      "A noise image, wherever a gradient goes: the `background`, the `color` of an object, the color of a material, the `floor`. Its colors are placed like the stops of a gradient, along the value of a smooth 3D noise, like SVG `feTurbulence`.",
    valuesTitle: "Arguments",
    values: [
      ["<number>", "The scale: how many patterns fit in one unit."],
      ["<integer>", "The octaves, from 1 to 8, if any: each one adds detail twice as fine, like `numOctaves`."],
      ["turbulence", "Sharp creases instead of soft clouds: marble, fire, lightning."],
      ["seed <integer>", "Another pattern."],
      ["at <x> <y> <z>", "Moves the pattern."],
    ],
    details: "On an object, the noise is cut in the object's own space, like a block of stone: no seam, and it moves and turns with the object. On the `floor`, it is read at each point of the floor, in the units of the scene. In the background, it follows the direction of the view. Like a gradient, it can be animated and changed by `:hover`, into another `noise()` of the same kind with as many colors: animating `at` makes it drift, like clouds or smoke. Its numbers can be set from JavaScript.",
    examples: [
      {
        name: "noise() on an object",
        text: "Blue clouds on a sphere.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: noise(3 4, #1a1d2b, #3a7bff 55%, #ffffff); }",
      },
      {
        name: "turbulence: marble",
        text: "Sharp creases, like the veins of marble.",
        code: "@scene { cube; } cube { translate: 0 0.6 0; size: 1.2; corner-radius: 0.06; color: noise(turbulence 1.2 5, #4a4f5a, #f4f1ea 30%); }",
      },
      {
        name: "a sky that drifts",
        text: "A background noise that drifts as `@keyframes` moves its `at`.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: noise(2 4, #2f6bd8 40%, #ffffff 75%); animation: wind 20s linear infinite; } @keyframes wind { to { background: noise(2 4 at 1 0 0, #2f6bd8 40%, #ffffff 75%); } }",
      },
      {
        name: "noise() in a material",
        text: "A turbulence in the color of a metal.",
        code: "@scene { torus; } torus { translate: 0 0.6 0; rotate-x: 70deg; material: metal(noise(turbulence 6 3, #6b4a2b, #d4af37), 0.25); }",
      },
    ],
  },
  {
    name: "displace()",
    anchor: "fn-displace",
    since: "0.0.4",
    covers: ["displace"],
    computed: "on the GPU, at each pixel",
    syntax: "displace(<gradient> | <noise()>, <gradient> | <noise()>, <number> | <percentage>)",
    description:
      "Moves an image by another one, like SVG `feDisplacementMap`, wherever a gradient goes: `color`, a material, `background` and its layers, `mask-image`, `floor`. Stripes moved by a turbulence make marble, rings make wood, a mask gets ragged edges.",
    valuesTitle: "Arguments",
    values: [
      ["<image>", "The gradient or the `noise()` to move."],
      ["<map>", "Usually a `noise()`: its colors move each point where the image is read. On a gradient, red moves it right and green down, like SVG; on a `noise()`, red, green and blue move it in 3D. A channel at 50% moves nothing, 0% and 100% the most."],
      ["<amount>", "A share of the size of the image: `0.3` or `30%` moves it by up to 15% of its size."],
    ],
    details: "A `noise()` map gives each channel a noise of its own, like `feTurbulence`, so even a gray noise moves the image in every direction; a gradient map is read once, by its colors, which are opaque. Like a gradient, `displace()` can be animated and changed by `:hover`, into another `displace()` whose image and map are of the same kinds: animating the `at` of a noise map makes the image flow. Its numbers can be set from JavaScript.",
    examples: [
      {
        name: "marble",
        text: "Stripes moved by a turbulence.",
        code: "@scene { cube; } cube { translate: 0 0.6 0; size: 1.2; corner-radius: 0.06; color: displace(repeating-linear-gradient(45deg, #f4f1ea 0% 9%, #9a9385 10%, #f4f1ea 11%), noise(turbulence 1 4, black, white), 0.35); }",
      },
      {
        name: "a ragged hole, in mask-image",
        text: "A round hole with ragged edges.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: #ff5a36; mask-image: displace(radial-gradient(circle, transparent 30%, black 31%), noise(4 3, black, white), 0.15); }",
      },
      {
        name: "water that flows",
        text: "Stripes that flow as `@keyframes` moves the `at` of their map.",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: displace(repeating-linear-gradient(#123a6b 0% 3%, #3a7bff 5% 8%), noise(2 3, black, white), 0.1); animation: flow 10s linear infinite; } @keyframes flow { to { background: displace(repeating-linear-gradient(#123a6b 0% 3%, #3a7bff 5% 8%), noise(2 3 at 0 1 0, black, white), 0.1); } }",
      },
    ],
  },
  {
    name: "element()",
    anchor: "fn-element",
    since: "0.0.4",
    covers: [],
    syntax: "element(<id>)",
    computed: "by the browser, each time the element changes",
    description:
      "A live image of an HTML element of the page, for `texture`, like CSS `element()`: a card, a form, a chart, any interface on a 3D surface. The browser draws the element with the CSS and the fonts of the page, and the object shows it again each time it changes.",
    details: "Put the element inside the scene: inside `<gss-scene>`, next to its script, or inside the canvas given to `mount()`. It stays in the page, so screen readers still read it, but it is seen only on the object. One image covers each face, like any texture: give the element the proportions of the face, and use `::face(front)` for one face only. A scene with an element is drawn with WebGL2.",
    note: ELEMENT_NOTE,
    examples: [
      {
        name: "an HTML card",
        text: "A card of HTML that sways on the front of a thin cube.",
        code: "@scene { cube; } scene { floor: none; camera-angle: -20deg 10deg; camera-target: 0 0.8 0; camera-distance: 3.2; ambient: 0.55; } cube { translate: 0 0.8 0; size: 1.6 1 0.06; corner-radius: 0.03; animation: sway 6s ease-in-out infinite alternate; } cube::face(front) { texture: element(#card); } @keyframes sway { to { rotate-y: 25deg; } }",
        html: "<article id=\"card\" style=\"\n  width: 320px; height: 200px; padding: 28px;\n  box-sizing: border-box; border-radius: 18px;\n  background: #f4f1ea; color: #1a1d2b;\n  font: 600 30px/1.2 system-ui, sans-serif;\">\n  Hello from <em style=\"color: #ff5a36;\">HTML</em>, on a 3D card\n</article>",
      },
    ],
  },
  {
    name: "paint()",
    anchor: "fn-paint",
    since: "0.0.6",
    covers: [],
    syntax: "paint(<name>)",
    computed: "on the GPU: once, or at every frame when its shader reads time",
    description:
      "The texture a `@paint` draws, for `texture`, like CSS `paint()`, whose image comes from code: `texture: paint(rings);`.",
    details: "The name is that of a `@paint` of the scene. Several objects can show the same one: it is drawn once for all of them. A scene with `paint()` is drawn with WebGL2.",
    examples: [
      {
        name: "two objects, one shader",
        text: "The cube and the sphere show the same stripes, drawn once per frame.",
        code: `@paint stripes {
  uniform float time;
  out vec4 color;

  void main() {
    float band = step(0.5, fract(gl_FragCoord.y / 64.0 - time * 0.5));
    color = vec4(mix(vec3(1.0, 0.35, 0.21), vec3(0.98, 0.95, 0.9), band), 1.0);
  }
}
@scene { cube; sphere; }
cube { translate: -0.9 0.6 0; size: 1.1; texture: paint(stripes); }
sphere { translate: 0.9 0.7 0; radius: 0.7; texture: paint(stripes); }`,
      },
    ],
  },
  {
    name: "rgb()",
    anchor: "fn-rgb",
    covers: ["rgb", "rgba"],
    syntax: "rgb(<red> <green> <blue>) | rgb(<red>, <green>, <blue>)",
    description:
      "A color from its red, green and blue channels, like CSS: numbers from 0 to 255, or percentages (100% is 255). Spaces or commas both work, and `rgba()` is the same function.",
    details: "Values outside the range are clamped. An alpha (`rgb(255 0 0 / 50%)`) makes the color transparent, which only `color`, `background` and `mask-image` take: anywhere else, it is an error. The math works inside, so one rule can give each copy its own color.",
    examples: [
      {
        name: "red, green and blue",
        code: "@scene { sphere; } sphere { color: rgb(255 90 54); }",
      },
      {
        name: "more red for each copy",
        text: "`calc()` and `sibling-index()` raise the red of each cube.",
        code: "@scene { cube.step * 5; } .step { size: 0.4; translate: calc(1.8 - sibling-index() * 0.6) 0.3 0; color: rgb(calc(sibling-index() * 50) 90 200); }",
      },
    ],
  },
  {
    name: "hsl()",
    anchor: "fn-hsl",
    covers: ["hsl", "hsla"],
    syntax: "hsl(<hue> <saturation> <lightness>)",
    description:
      "A color from its hue, saturation and lightness, like CSS. The hue is an angle on the color wheel (0 red, 120 green, 240 blue), in degrees or in `deg`, `rad` or `turn`, and it goes round: -120 is 240.",
    details: "Saturation and lightness are percentages, or numbers where 100 is 100%; a lightness of 50% gives the pure color. Commas, `hsla()` and the alpha work as in `rgb()`. With `sibling-index()` on the hue, the copies of an object spread a rainbow.",
    examples: [
      {
        name: "an orange",
        code: "@scene { sphere; } sphere { color: hsl(20 100% 60%); }",
      },
      {
        name: "a rainbow",
        text: "Each dot turns the hue 45° further.",
        code: "@scene { sphere.dot * 8; } .dot { radius: 0.25; translate: calc(2.7 - sibling-index() * 0.6) 0.5 0; color: hsl(calc(sibling-index() * 45) 90% 60%); }",
      },
    ],
  },
  {
    name: "hwb()",
    anchor: "fn-hwb",
    covers: ["hwb"],
    syntax: "hwb(<hue> <whiteness> <blackness>)",
    description:
      "A color from a hue, and how much white and black are mixed into it, like CSS: `hwb(0 0% 0%)` is pure red; more whiteness makes it paler, more blackness darker. When whiteness and blackness add up to 100% or more, the color is a gray. The hue works as in `hsl()`.",
    examples: [
      {
        name: "paler and paler",
        text: "Each cube adds 15% of white.",
        code: "@scene { cube.tint * 5; } .tint { size: 0.6; translate: calc(2.4 - sibling-index() * 0.8) 0.3 0; color: hwb(200 calc(sibling-index() * 15%) 10%); }",
      },
    ],
  },
  {
    name: "lab(), lch()",
    anchor: "fn-lab-lch",
    covers: ["lab", "lch"],
    syntax: "lab(<lightness> <a> <b>) | lch(<lightness> <chroma> <hue>)",
    description:
      "The CIE Lab color space of CSS, built on how the eye sees: the lightness goes from 0 (black) to 100 (white), `a` from green to red, `b` from blue to yellow. `lch()` is the same space, written with a chroma (how colorful) and a hue.",
    details: "Percentages work as in CSS: 100% is 100 for the lightness, 125 for `a` and `b`, 150 for the chroma. A color the screen cannot show is clipped to it.",
    examples: [
      {
        name: "lab()",
        text: "An orange, in Lab.",
        code: "@scene { sphere; } sphere { color: lab(62 52 48); }",
      },
      {
        name: "lch()",
        text: "Six hues of the same lightness and chroma.",
        code: "@scene { sphere.dot * 6; } .dot { radius: 0.3; translate: calc(2.6 - sibling-index() * 0.75) 0.5 0; color: lch(65 60 calc(sibling-index() * 60)); }",
      },
      {
        name: "lab() and lch() together",
        text: "A green in `lab()`, and one in `lch()`.",
        code: "@scene { cube#a; cube#b; } #a { translate: 0.7 0.5 0; color: lab(55 -40 30); } #b { translate: -0.7 0.5 0; color: lch(55 50 140); }",
      },
    ],
  },
  {
    name: "oklab(), oklch()",
    anchor: "fn-oklab-oklch",
    covers: ["oklab", "oklch"],
    syntax: "oklab(<lightness> <a> <b>) | oklch(<lightness> <chroma> <hue>)",
    description:
      "The OKLab color space of CSS: its lightness matches the eye much better than `hsl()`, so colors of the same lightness look equally light, whatever their hue. With `sibling-index()` on its hue, `oklch()` gives a rainbow whose colors all look as light.",
    details: "The lightness goes from 0 to 1, or 0% to 100%. `oklch()` adds a chroma, from about 0 to 0.4 (100% is 0.4), and a hue. A color the screen cannot show is clipped to it.",
    examples: [
      {
        name: "oklab()",
        text: "A warm color, in OKLab.",
        code: "@scene { sphere; } sphere { color: oklab(0.72 0.12 0.1); }",
      },
      {
        name: "oklch()",
        text: "A rainbow whose colors look equally light.",
        code: "@scene { sphere.dot * 8; } .dot { radius: 0.25; translate: calc(2.7 - sibling-index() * 0.6) 0.5 0; color: oklch(72% 0.15 calc(sibling-index() * 45)); }",
      },
      {
        name: "oklab() and oklch() together",
        text: "A blue in `oklab()`, and a red in `oklch()`.",
        code: "@scene { cube#a; cube#b; } #a { translate: 0.7 0.5 0; color: oklab(60% -0.1 -0.1); } #b { translate: -0.7 0.5 0; color: oklch(60% 0.14 30deg); }",
      },
    ],
  },
  {
    name: "color()",
    anchor: "fn-color",
    covers: ["color"],
    syntax: "color(<space> <r> <g> <b>)",
    description:
      "A color in a named color space, like CSS, with three channels from 0 to 1, or percentages.",
    valuesTitle: "Color spaces",
    values: [
      ["srgb", "The space of hex colors."],
      ["srgb-linear", "The same colors, without the gamma curve: the channels are amounts of light."],
      ["display-p3", "A wider gamut. What the sRGB render cannot show is clipped."],
      ["xyz, xyz-d65, xyz-d50", "The CIE XYZ space, with a D65 white (`xyz` is `xyz-d65`) or a D50 white."],
    ],
    examples: [
      {
        name: "display-p3 and srgb-linear",
        code: "@scene { sphere#a; sphere#b; } #a { translate: 0.8 0.6 0; color: color(display-p3 0.95 0.35 0.2); } #b { translate: -0.8 0.6 0; color: color(srgb-linear 0.1 0.3 0.8); }",
      },
    ],
  },
  {
    name: "color-mix()",
    anchor: "fn-color-mix",
    covers: ["color-mix"],
    syntax:
      "color-mix(in <space> [shorter | longer hue]?, <color> <percentage>?, <color> <percentage>?)",
    description:
      "Mixes two colors in a color space, like CSS. Without percentages, half of each; with one, the other color takes the rest; with both, they are scaled to add up to 100%.",
    valuesTitle: "Color spaces",
    values: [
      ["oklab", "The most even mixes."],
      ["srgb", "The mix of hex colors: duller middle colors."],
      ["srgb-linear", "A mix of the light itself: brighter middle colors."],
      ["lab", "Like `oklab`, in CIE Lab."],
      ["oklch, lch, hsl, hwb", "Spaces with a hue: it goes the shorter way round the wheel, or the longer one with `longer hue`. A gray takes the hue of the other color."],
    ],
    details: "Like CSS, when the percentages add up to less than 100%, the color becomes transparent, which only `color`, `background` and `mask-image` take: anywhere else, it is an error. A percentage set from JavaScript is kept between 0% and 100%, and percentages that add up to less are scaled up to 100%.",
    examples: [
      {
        name: "from orange to blue",
        text: "Each cube takes 20% more blue, mixed in `oklab`.",
        code: "@scene { cube.step * 6; } .step { size: 0.6; translate: calc(2.6 - sibling-index() * 0.75) 0.3 0; color: color-mix(in oklab, #ff5a36, #3a7bff calc(sibling-index() * 20% - 20%)); }",
      },
    ],
  },
  {
    name: "light-dark()",
    anchor: "fn-light-dark",
    covers: ["light-dark"],
    syntax: "light-dark(<light color>, <dark color>)",
    description:
      "The first color in light mode, the second in dark mode, like CSS. The scene follows the system as it changes: it works like `@media (prefers-color-scheme: dark)`, and counts as one of the queries of the scene.",
    examples: [
      {
        name: "light and dark mode",
        code: "@scene { sphere; } scene { background: light-dark(#f4f1ea, #0b0b10); floor: light-dark(#e8e3db, #16161d); } sphere { color: light-dark(#ff5a36, #7cb4ff); }",
      },
    ],
  },
  {
    name: "contrast-color()",
    anchor: "fn-contrast-color",
    covers: ["contrast-color"],
    syntax: "contrast-color(<color>)",
    description:
      "White or black, whichever contrasts most with the color, like CSS: the way to keep an object readable against a background held in a variable.",
    examples: [
      {
        name: "readable on any background",
        text: "The sphere is white or black, whatever `--bg` holds.",
        code: "@scene { cube; sphere; } scene { --bg: #3a7bff; background: var(--bg); } cube { translate: 0 0.5 0; color: var(--bg); } sphere { radius: 0.3; translate: 0 1.3 0; color: contrast-color(var(--bg)); }",
      },
    ],
  },
  {
    name: "currentColor",
    anchor: "fn-currentcolor",
    covers: [],
    syntax: "currentColor",
    description:
      "A keyword, like CSS: the object's own `color`, wherever a color is expected. `color-mix(in oklab, currentColor 60%, white)` is a lighter version of whatever color the object has, so one rule can tint many objects.",
    details: "As the color of a material, `metal(currentColor, 0.2)` is `metal(0.2)`: the material follows the color, animated, on `:hover`, or a gradient. It also works in the stops of a gradient, in `light-dark()` and in a variable, read with the color of the object that uses the variable. An object without color uses the initial `#e6e6e6`. It can be written `currentcolor` too. `color: currentColor` is an error: a group passes no color down, and the scene has none.",
    examples: [
      {
        name: "a lighter shell for every color",
        text: "Three spheres, each in a jelly lighter than its own color.",
        code: "@scene { sphere * 3; } sphere { radius: 0.4; translate: calc((sibling-index() - 2) * -1.1) 0.5 0; material: jelly(color-mix(in oklab, currentColor 55%, white), 0.4); } sphere:nth-child(1) { color: #ff5a36; } sphere:nth-child(2) { color: #3ad16b; } sphere:nth-child(3) { color: #3a7bff; }",
      },
      {
        name: "in a variable",
        text: "One gradient in a variable, read with the color of each cube.",
        code: "@scene { cube#a; cube#b; } scene { --shade: linear-gradient(currentColor, color-mix(in srgb, currentColor, black 60%)); } cube { size: 0.8; material: metal(var(--shade), 0.3); } #a { translate: 0.7 0.4 0; color: #ff5a36; } #b { translate: -0.7 0.4 0; color: #3a7bff; }",
      },
    ],
  },
  {
    name: "var()",
    anchor: "fn-var",
    covers: ["var"],
    syntax: "var(--<name>) | var(--<name>, <fallback>)",
    description:
      "Reads a custom property, like CSS. A property whose name starts with `--` is a variable: declared on the scene (like `:root`), on a group or on an object, it is inherited down to the object, and the closest one wins.",
    valuesTitle: "Forms",
    values: [
      ["var(--name)", "The value of the variable. A missing variable is an error, so a typo is never ignored."],
      ["var(--name, fallback)", "The fallback, when the variable is not defined."],
    ],
    details: "A variable can hold several values (`translate: var(--pos)`), use another one (`--big: calc(var(--size) * 2)`), and go inside `calc()`. A frame of `@keyframes` can set a variable: every animatable property that uses it moves with it. The compiler replaces the variables with their values, unless `@property` registers them: the shader receives only numbers.",
    examples: [
      {
        name: "a color and a radius",
        text: "`#b` overrides the `--r` of the scene.",
        code: "@scene { sphere#a; sphere#b; } scene { --accent: #ff5a36; --r: 0.4; } sphere { radius: var(--r); color: var(--accent); } #a { translate: 0.8 0.5 0; } #b { --r: 0.6; translate: -0.8 0.6 0; }",
      },
      {
        name: "inherited from a group",
        text: "The cones read `--green` from their group, and each computes its own `--size`.",
        code: "@scene { group#tree { cone.level * 5; } } #tree { --green: #3ad16b; } .level { --size: calc(sibling-index() * 0.12); radius: var(--size); height: var(--size); translate: 0 calc(1.3 - sibling-index() * 0.18) 0; color: var(--green); }",
      },
      {
        name: "set by @keyframes",
        text: "The frame sets `--lift`, and the `translate` of each sphere moves with it.",
        code: "@scene { sphere * 3; } sphere { --lift: 0; radius: 0.3; translate: calc(1.8 - sibling-index() * 0.9) calc(0.4 + var(--lift) * sibling-index()) 0; color: #ff5a36; animation: rise 2s ease-in-out alternate; } @keyframes rise { to { --lift: 0.4; } }",
      },
    ],
  },
  {
    name: "random()",
    anchor: "fn-random",
    covers: ["random"],
    syntax:
      "random([--<name> || element-shared | fixed <number>,]? <min>, <max>, <step>?)",
    description:
      "A random value between a minimum and a maximum, like CSS: `random(0.2, 1.4)`, `random(0deg, 360deg)`. The value is chosen once, when the scene compiles, and stays the same at every reload.",
    valuesTitle: "Forms",
    values: [
      ["random(<min>, <max>)", "Any value between them. Each object, property and call gets its own, so one rule scatters every copy."],
      ["random(<min>, <max>, <step>)", "One of `min`, `min + step`… up to `max`: `random(0deg, 180deg, 45deg)`."],
      ["random(--<name>, …)", "One value shared by the calls of an object that use this name: the same number for x and z."],
      ["random(element-shared, …)", "The same value for every object."],
      ["random(fixed <number>, …)", "The random number set by hand, from 0 to just below 1."],
    ],
    details: "The values must share a unit.",
    examples: [
      {
        name: "a sky of stars",
        text: "Thirty stars, each with its own size, place and hue.",
        code: "@scene { sphere.star * 30; } .star { radius: random(0.05, 0.2); translate: random(-2.5, 2.5) random(0.3, 2.2) random(-2, 1); color: hsl(random(180, 260) 80% 70%); }",
      },
      {
        name: "random() with a step and --name",
        text: "`--size` gives each block one size for its width and its height, and its turn goes by steps of 15°.",
        code: "@scene { cube.block * 16; } .block { --s: random(--size, 0.2, 0.5); size: var(--s); translate: calc(1.2 - mod(sibling-index() - 1, 4) * 0.8) calc(var(--s) / 2) calc(round(down, calc((sibling-index() - 1) / 4)) * 0.8 - 1.2); rotate-y: random(0deg, 90deg, 15deg); color: oklch(70% 0.15 random(0, 360, 60)); }",
      },
    ],
  },
  {
    name: "if()",
    anchor: "fn-if",
    covers: ["if"],
    syntax: "if(<condition>: <value>; …; else: <value>)",
    description:
      "Picks a value by condition, like CSS: the first branch whose condition is true gives its value. End with `else`: when no branch is true, it is an error.",
    valuesTitle: "Conditions",
    values: [
      ["media(<query>)", "True when the screen matches the query, like `@media`."],
      ["style(--x)", "True when the custom property is set on the object, or inherited."],
      ["style(--x: <value>)", "True when it has that value."],
      ["else", "Always true."],
      ["not, and, or", "Combine conditions; `and` and `or` cannot be mixed without parentheses."],
    ],
    details: "A `media()` condition makes a version of the scene for its query, like `@media`, and counts as one of its queries.",
    examples: [
      {
        name: "if() with style()",
        text: "Each group sets `--theme`, and its spheres pick their color from it.",
        code: "@scene { group#warm { sphere * 3 } group#cool { sphere * 3 } } #warm { --theme: warm; translate: 1 0 0; } #cool { --theme: cool; translate: -1 0 0; } sphere { radius: 0.3; translate: 0 calc(sibling-index() * 0.7) 0; color: if(style(--theme: warm): #ff5a36; else: #3a7bff); }",
      },
      {
        name: "if() with media()",
        text: "A smaller sphere on a narrow screen, and a blue one in dark mode.",
        code: "@scene { sphere; } sphere { radius: if(media(width < 600px): 0.4; else: 0.8); translate: 0 1 0; color: if(media(prefers-color-scheme: dark): #7cb4ff; else: #ff5a36); }",
      },
    ],
  },
  {
    name: "calc()",
    anchor: "fn-calc",
    covers: ["calc"],
    syntax: "calc(<expression>)",
    description:
      "Computes a value, like CSS `calc()`: `+ - * /` and parentheses, with numbers, angles (`deg`, `rad`, `turn`) and durations (`s`, `ms`). Like CSS, `+` and `-` need a space on each side.",
    details: "The compiler computes it once per object: the shader receives only the result, so the math costs nothing on the GPU. `calc()` and the other math functions work in any value, even inside another function: `metal(#fff, calc(0.1 * 2))`.",
    examples: [
      {
        name: "a staircase",
        text: "Each copy climbs a step higher, with `sibling-index()`.",
        code: "@scene { cube.step * 5; } .step { size: 0.4; translate: calc(1.8 - sibling-index() * 0.6) calc(sibling-index() * 0.25) 0; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "sibling-index()",
    anchor: "fn-sibling-index",
    covers: ["sibling-index"],
    syntax: "sibling-index()",
    description:
      "The position of the object among its siblings, from 1, like the CSS function: `cube * 12` makes 12 siblings numbered 1 to 12. With `calc()`, one rule gives each copy its own place, angle or size: no loop needed.",
    details: "Siblings are the objects of the same `@scene` block or group. A group is a sibling too, and the count starts again inside each group. It means nothing in `scene { }` or in `@keyframes`, shared by every object.",
    examples: [
      {
        name: "a ring of petals",
        text: "Twelve copies, each placed and turned 30° further than the one before.",
        code: "@scene { cube.petal * 12; } .petal { size: 0.25 0.6 0.25; translate: calc(cos(sibling-index() * 30deg) * -1.6) 0.5 calc(sin(sibling-index() * 30deg) * 1.6); rotate-y: calc(sibling-index() * 30deg); color: #ff5a36; }",
      },
    ],
  },
  {
    name: "sibling-count()",
    anchor: "fn-sibling-count",
    covers: ["sibling-count"],
    syntax: "sibling-count()",
    description:
      "How many siblings the object has, itself included, like the CSS function. Divided into a full turn, it spreads objects evenly, whatever their number: change `* 8` into `* 20`, and the ring follows.",
    examples: [
      {
        name: "beads in a ring",
        code: "@scene { sphere.bead * 8; } .bead { radius: 0.2; translate: calc(cos(sibling-index() * 1turn / sibling-count()) * -1.4) 0.5 calc(sin(sibling-index() * 1turn / sibling-count()) * 1.4); material: jelly(0.6); color: #ff5a36; }",
      },
    ],
  },
  {
    name: "sin(), cos(), tan()",
    anchor: "fn-trig",
    covers: ["sin", "cos", "tan"],
    syntax: "sin(<angle> | <number>)",
    description:
      "The trigonometric functions of CSS: they take an angle (`deg`, `rad`, `turn`) or a number of radians, and return a number. `cos()` and `sin()` of the same angle give a point on a circle: the way to place objects in a ring, a spiral or a wave. `pi` is known too: `cos(pi)` is -1.",
    examples: [
      {
        name: "sin()",
        text: "A wave: the height of each sphere follows `sin()`.",
        code: "@scene { sphere.wave * 9; } .wave { radius: 0.18; translate: calc(2 - sibling-index() * 0.4) calc(0.8 + sin(sibling-index() * 40deg) * 0.5) 0; color: #7cb4ff; }",
      },
      {
        name: "cos()",
        text: "Columns whose heights follow `cos()`.",
        code: "@scene { cube.col * 9; } .col { --h: calc(0.9 + cos(sibling-index() * 40deg) * 0.6); size: 0.25 var(--h) 0.25; translate: calc(2 - sibling-index() * 0.4) calc(var(--h) / 2) 0; color: #ff5a36; }",
      },
      {
        name: "tan()",
        text: "Steps that climb faster and faster with `tan()`.",
        code: "@scene { cube.step * 7; } .step { --h: calc(tan(sibling-index() * 10deg) * 1.2); size: 0.35 var(--h) 0.35; translate: calc(2 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #3ad16b; }",
      },
      {
        name: "sin(), cos() and tan() together",
        text: "A ring of beads that rises and falls.",
        code: "@scene { sphere.bead * 12; } .bead { radius: calc(0.1 + tan(sibling-index() * 5deg) * 0.2); translate: calc(cos(sibling-index() * 30deg) * -1.5) calc(0.6 + sin(sibling-index() * 60deg) * 0.3) calc(sin(sibling-index() * 30deg) * 1.5); color: hsl(calc(sibling-index() * 30) 85% 60%); }",
      },
    ],
  },
  {
    name: "min(), max(), clamp()",
    anchor: "fn-min-max-clamp",
    covers: ["min", "max", "clamp"],
    syntax: "min(<value>, …) | max(<value>, …) | clamp(<min>, <value>, <max>)",
    description:
      "The smallest or the largest of their values, or a value kept between two bounds, like CSS. The values must share a unit: `max(10deg, 20deg)`, not `max(10deg, 2)`.",
    valuesTitle: "Functions",
    values: [
      ["min(<value>, …)", "The smallest."],
      ["max(<value>, …)", "The largest."],
      ["clamp(<min>, <value>, <max>)", "The value, kept between `min` and `max`."],
    ],
    examples: [
      {
        name: "min()",
        text: "Bars that grow, up to 1.2.",
        code: "@scene { cube.bar * 6; } .bar { --h: min(sibling-index() * 0.35, 1.2); size: 0.3 var(--h) 0.3; translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #ff5a36; }",
      },
      {
        name: "max()",
        text: "Bars never shorter than 0.6.",
        code: "@scene { cube.bar * 6; } .bar { --h: max(0.6, sibling-index() * 0.3); size: 0.3 var(--h) 0.3; translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #3a7bff; }",
      },
      {
        name: "clamp()",
        text: "Bars kept between 0.5 and 1.4.",
        code: "@scene { cube.bar * 6; } .bar { --h: clamp(0.5, sibling-index() * 0.35, 1.4); size: 0.3 var(--h) 0.3; translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #3ad16b; }",
      },
      {
        name: "min(), max() and clamp() together",
        text: "Heights and widths, each one bounded.",
        code: "@scene { cube.bar * 8; } .bar { --h: max(0.3, min(sibling-index() * 0.3, 1.5)); --w: clamp(0.15, sibling-index() * 0.05, 0.35); size: var(--w) var(--h) var(--w); translate: calc(2.25 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: hsl(calc(sibling-index() * 40) 80% 60%); }",
      },
    ],
  },
  {
    name: "abs(), sqrt(), pow()",
    anchor: "fn-abs-sqrt-pow",
    covers: ["abs", "sqrt", "pow"],
    syntax: "abs(<value>) | sqrt(<number>) | pow(<number>, <number>)",
    description:
      "Like CSS: `abs()` drops the sign, `sqrt()` is the square root, and `pow(a, b)` is `a` to the power `b`. `pow()` grows fast: good for sizes that double.",
    examples: [
      {
        name: "abs()",
        text: "A V: the bars grow away from the middle.",
        code: "@scene { cube.v * 9; } .v { --h: calc(0.3 + abs(sibling-index() - 5) * 0.25); size: 0.3 var(--h) 0.3; translate: calc(2.25 - sibling-index() * 0.45) calc(var(--h) / 2) 0; color: #7cb4ff; }",
      },
      {
        name: "sqrt()",
        text: "Sizes that grow slower and slower.",
        code: "@scene { sphere.dot * 6; } .dot { --r: calc(sqrt(sibling-index()) * 0.15); radius: var(--r); translate: calc(2.45 - sibling-index() * 0.7) var(--r) 0; color: #3ad16b; }",
      },
      {
        name: "pow()",
        text: "Each sphere 1.4 times bigger than the one before.",
        code: "@scene { sphere.dot * 5; } .dot { radius: calc(pow(1.4, sibling-index()) * 0.08); translate: calc(2.4 - sibling-index() * 0.8) 0.6 0; color: #ff5a36; }",
      },
      {
        name: "abs(), sqrt() and pow() together",
        text: "A sunflower head of 24 seeds.",
        code: "@scene { sphere.seed * 24; } .seed { --d: calc(sqrt(sibling-index()) * 0.4); radius: calc(0.06 + pow(sibling-index() / 24, 2) * 0.14); translate: calc(-1 * cos(sibling-index() * 137.5deg) * var(--d)) calc(0.25 + abs(sibling-index() - 12) * 0.03) calc(sin(sibling-index() * 137.5deg) * var(--d)); color: hsl(calc(sibling-index() * 15) 80% 60%); }",
      },
    ],
  },
  {
    name: "asin(), acos(), atan(), atan2()",
    anchor: "fn-inverse-trig",
    covers: ["asin", "acos", "atan", "atan2"],
    syntax:
      "asin(<number>) | acos(<number>) | atan(<number>) | atan2(<y>, <x>)",
    description:
      "The inverse trigonometric functions of CSS: they take a number and return an angle, in `deg`. `atan2(y, x)` gives the angle of the point (x, y), whatever its quarter: the way to turn an object toward a point. Its two values must share a unit.",
    examples: [
      {
        name: "asin()",
        text: "Bars tilted by `asin()`.",
        code: "@scene { cube.tilt * 5; } .tilt { size: 0.2 0.9 0.2; translate: calc(1.8 - sibling-index() * 0.6) 0.45 0; rotate-z: asin(calc(0.6 - sibling-index() * 0.2)); color: #ff5a36; }",
      },
      {
        name: "acos()",
        text: "A fan opened by `acos()`.",
        code: "@scene { cube.fan * 5; } .fan { size: 0.9 0.1 0.2; translate: 0 calc(sibling-index() * 0.3) 0; rotate-y: acos(calc(1.2 - sibling-index() * 0.4)); color: #7cb4ff; }",
      },
      {
        name: "atan()",
        text: "Ramps that tilt more and more, toward 90°.",
        code: "@scene { cube.ramp * 5; } .ramp { size: 0.8 0.08 0.3; translate: calc(2.7 - sibling-index() * 0.9) 0.5 0; rotate-z: atan(calc(sibling-index() * -0.4)); color: #3ad16b; }",
      },
      {
        name: "atan2()",
        text: "Needles turned along the ring by `atan2()`.",
        code: "@scene { cube.needle * 8; } .needle { --a: calc(sibling-index() * 45deg); size: 0.5 0.08 0.08; translate: calc(cos(var(--a)) * -1.4) 0.5 calc(sin(var(--a)) * 1.4); rotate-y: atan2(sin(var(--a)), cos(var(--a))); color: #ff5a36; }",
      },
      {
        name: "asin(), acos(), atan() and atan2() together",
        text: "A curve drawn with all four.",
        code: "@scene { sphere.dot * 10; } .dot { --x: calc(sibling-index() * 0.2 - 1.1); radius: 0.12; translate: calc(var(--x) * -2) calc(1 + sin(asin(var(--x)) + acos(var(--x))) * 0.4) calc(atan(var(--x)) / 90deg); rotate-y: atan2(var(--x), 1); color: hsl(calc(sibling-index() * 36) 80% 60%); }",
      },
    ],
  },
  {
    name: "sign(), round(), mod(), rem()",
    anchor: "fn-stepped",
    covers: ["sign", "round", "mod", "rem"],
    syntax:
      "sign(<value>) | round([nearest | up | down | to-zero,]? <value>, <step>?) | mod(<value>, <value>) | rem(<value>, <value>)",
    description:
      "The stepped functions of CSS. Their values must share a unit: `round(37deg, 15deg)` is `30deg`.",
    valuesTitle: "Functions",
    values: [
      ["sign(<value>)", "-1, 0 or 1."],
      ["round(<value>, <step>)", "The value snapped to a multiple of its step (1 by default): `nearest` (halfway goes up), `up`, `down` or `to-zero`, written first."],
      ["mod(<value>, <value>)", "The rest of a division, with the sign of the divisor: `mod(-7, 3)` is 2."],
      ["rem(<value>, <value>)", "The rest, with the sign of the value: `rem(-7, 3)` is -1."],
    ],
    examples: [
      {
        name: "sign()",
        text: "Above or below, by the sign of each position.",
        code: "@scene { cube.side * 9; } .side { size: 0.3; translate: calc(2.25 - sibling-index() * 0.45) calc(0.6 + sign(sibling-index() - 5) * 0.4) 0; color: #7cb4ff; }",
      },
      {
        name: "round()",
        text: "Stairs that climb by steps of 0.5.",
        code: "@scene { cube.stair * 9; } .stair { --h: round(down, calc(sibling-index() * 0.3), 0.5); size: 0.4 calc(var(--h) + 0.1) 0.4; translate: calc(2.25 - sibling-index() * 0.45) calc(var(--h) / 2 + 0.05) 0; color: #ff5a36; }",
      },
      {
        name: "mod()",
        text: "A grid: `mod()` gives the column of each copy.",
        code: "@scene { cube.row * 12; } .row { size: 0.3; translate: calc(0.75 - mod(sibling-index() - 1, 4) * 0.5) 0.15 calc(round(down, calc((sibling-index() - 1) / 4)) * 0.5 - 0.5); color: #3ad16b; }",
      },
      {
        name: "rem()",
        text: "A pattern that repeats every 3.",
        code: "@scene { sphere.ball * 9; } .ball { radius: 0.18; translate: calc(2.25 - sibling-index() * 0.45) calc(0.3 + rem(sibling-index(), 3) * 0.4) 0; color: #ff5a36; }",
      },
      {
        name: "sign(), round(), mod() and rem() together",
        text: "A grid of tiles, of three heights.",
        code: "@scene { cube.tile * 16; } .tile { --col: mod(sibling-index() - 1, 4); --row: round(down, calc((sibling-index() - 1) / 4)); size: 0.4 calc(0.2 + rem(sibling-index(), 3) * 0.2) 0.4; translate: calc(0.75 - var(--col) * 0.5) 0.2 calc(var(--row) * 0.5 - 0.75); rotate-y: calc(sign(var(--col) - 1.5) * -15deg); color: hsl(calc(sibling-index() * 22) 80% 60%); }",
      },
    ],
  },
  {
    name: "hypot(), log(), exp()",
    anchor: "fn-exponential",
    covers: ["hypot", "log", "exp"],
    syntax: "hypot(<value>, …) | log(<number>, <base>?) | exp(<number>)",
    description:
      "The exponential functions of CSS, for sizes and distances that grow fast or slowly.",
    valuesTitle: "Functions",
    values: [
      ["hypot(<value>, …)", "The length of a vector: `hypot(3, 4)` is 5, the distance from the center to the point (3, 4)."],
      ["log(<number>, <base>)", "The natural logarithm, or the logarithm in a base: `log(8, 2)` is 3."],
      ["exp(<number>)", "`e` to a power. `e` is also a constant."],
    ],
    examples: [
      {
        name: "hypot()",
        text: "Bigger and bigger away from the center.",
        code: "@scene { sphere.dot * 9; } .dot { --x: calc(mod(sibling-index() - 1, 3) - 1); --z: calc(round(down, calc((sibling-index() - 1) / 3)) - 1); radius: calc(0.12 + hypot(var(--x), var(--z)) * 0.1); translate: calc(var(--x) * -0.9) 0.4 calc(var(--z) * 0.9); color: #7cb4ff; }",
      },
      {
        name: "log()",
        text: "Bars that grow slower and slower.",
        code: "@scene { cube.bar * 8; } .bar { --h: calc(0.2 + log(sibling-index(), 2) * 0.4); size: 0.3 var(--h) 0.3; translate: calc(2 - sibling-index() * 0.45) calc(var(--h) / 2) 0; color: #3ad16b; }",
      },
      {
        name: "exp()",
        text: "Spheres that grow faster and faster.",
        code: "@scene { sphere.dot * 6; } .dot { radius: calc(exp(sibling-index() / 3) * 0.06); translate: calc(2.45 - sibling-index() * 0.7) 0.6 0; color: #ff5a36; }",
      },
      {
        name: "hypot(), log() and exp() together",
        text: "A spiral of seeds that shrink outward.",
        code: "@scene { sphere.seed * 12; } .seed { --a: calc(sibling-index() * 30deg); --d: calc(log(sibling-index() + 1) * 0.8); radius: calc(exp(0 - sibling-index() / 8) * 0.25); translate: calc(-1 * cos(var(--a)) * var(--d)) calc(0.3 + hypot(cos(var(--a)), 1) * 0.2) calc(sin(var(--a)) * var(--d)); color: hsl(calc(sibling-index() * 30) 80% 60%); }",
      },
    ],
  },
  {
    name: "progress()",
    anchor: "fn-progress",
    covers: ["progress"],
    syntax: "progress(<value>, <start>, <end>)",
    description:
      "Where a value sits between a start and an end, from 0 to 1, like the CSS function: `progress(sibling-index(), 1, sibling-count())` goes from 0 for the first copy to 1 for the last. The result is kept between 0 and 1, and the three values must share a unit.",
    examples: [
      {
        name: "a ramp of heights and hues",
        text: "Each bar grows and changes hue with its progress.",
        code: "@scene { cube.fade * 8; } .fade { --p: progress(sibling-index(), 1, sibling-count()); size: 0.35 calc(0.2 + var(--p)) 0.35; translate: calc(2.25 - sibling-index() * 0.5) calc(0.1 + var(--p) / 2) 0; color: hsl(calc(200 + var(--p) * 160) 80% 60%); }",
      },
    ],
  },
];
