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

export type Example = {
  name?: string;
  code: string;
  html?: string; // the HTML elements the scene shows with element(#id) (decision 101)
};

export type PropertyDef = {
  name: string;
  appliesTo: "object" | "scene" | "everywhere" | (Shape | "light")[]; // [...]: only these shapes (or lights); everywhere: the scene too
  syntax: string;
  initial: string;
  description: string;
  examples: Example[];
  animatable?: boolean; // can be changed by @keyframes (decision 24)
};

// A block of the language: @scene, @keyframes
export type AtRuleDef = {
  name: string; // without the @: "keyframes"
  syntax: string;
  description: string;
  examples: Example[];
  see?: { anchor: string; label: string }[]; // other pages of the docs, linked under the syntax
};

// A shape that can be declared in @scene. Its own properties are not listed here:
// the docs find them in PROPERTIES, through appliesTo.
export type ShapeDef = {
  name: Shape | "group" | "light"; // the Shape type checks the spelling; group is drawn by its children, light draws nothing
  description: string;
  examples: Example[];
  takes?: string[]; // only these properties have an effect (a group); otherwise every object property
};

// A way to target objects, or to win the cascade: cube, .class, #id, *, a, b, !important
export type SelectorDef = {
  name: string; // what the reader writes: "*", ".class"
  anchor: string; // its id in the docs: "selector-universal" (a name like "*" cannot be an id)
  specificity: string; // shown as is: "0", "100", or a sentence
  description: string;
  examples: Example[];
};

// A function that computes a value at compile time: calc(), sibling-index(), sin()… (decision 52), var() (decision 55)
export type FunctionDef = {
  name: string; // what the docs show: "calc()", or "sin(), cos(), tan()"
  anchor: string; // its id in the docs: "fn-calc"
  covers: string[]; // the functions of calc.ts it documents: ["sin", "cos", "tan"]
  syntax: string;
  computed?: string; // when it is computed, if not at compile time (a gradient, element())
  description: string;
  examples: Example[];
};

export const PROPERTIES: PropertyDef[] = [
  {
    name: "translate",
    appliesTo: "object",
    animatable: true,
    syntax: "<number>{3}",
    initial: "0 0 0",
    description:
      "Moves the object along the x, y and z axes. Like CSS, x points to the right and z toward the viewer; y points up, and the floor is at y = 0. On a group, it moves everything inside it, and the positions of its children become relative to the group.",
    examples: [
      {
        name: "translate",
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
      "Sets the base color of the object's surface: a hex color (#ff5a36), rgb(), hsl() or one of the 148 CSS named colors (tomato), turned into a hex color by the compiler. It can also be a gradient (linear-gradient(), radial-gradient(), conic-gradient()), painted on the object as seen from the front, and taken by every material, a noise() cut in the object's own space, or one of them moved by a map with displace(). A gradient can be animated and changed by :hover: it changes into another gradient of the same kind with as many colors, and each of its numbers moves on its own, the angle, the center, the positions and the colors. Through a variable, like a registered @property in CSS, one number is enough: linear-gradient(var(--angle), …) turns when a @keyframes changes --angle. A color cannot change into a gradient. On a light of @scene, color is the color of its light: a plain color, not a gradient.",
    examples: [
      {
        name: "color",
        code: "@scene { sphere; } sphere { color: #ff5a36; }",
      },
      {
        name: "color",
        code: "@scene { sphere#a; sphere#b; } #a { translate: 0.8 0.5 0; color: tomato; } #b { translate: -0.8 0.5 0; color: hsl(210 80% 60%); }",
      },
      {
        name: "animated gradient",
        code: "@scene { plane; } plane { size: 4 3; translate: 0 0.05 0; --angle: 0deg; color: linear-gradient(var(--angle), #ff6540, #722cff); animation: spin 6s; } scene { camera-angle: 0deg 60deg; } @keyframes spin { to { --angle: 1turn; } }",
      },
      {
        name: "gradient on :hover",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: radial-gradient(circle at 30% 70%, #ffd27a, #ff5a36); transition: 0.4s; } cube:hover { color: radial-gradient(circle at 70% 30%, #7ad2ff, #3a3aff); }",
      },
    ],
  },
  {
    name: "material",
    appliesTo: "object",
    syntax:
      "matte([<color>]) | metal([<color>,] [<roughness>]) | jelly([<color>,] [<density>]) | gold | chrome | jelly | glass([<color>,] [<refraction-index>] [, [frosted | wavy | hammered | blurred] <frost>]) | glass | ice",
    initial: "matte()",
    description:
      "Sets how the surface of the object reacts to light. matte() only scatters light, like chalk. metal() reflects the scene: roughness goes from 0, a mirror, to 1, a brushed metal (0.2 by default). Without a color, the material uses the color property, like currentColor in CSS, so color stays animatable. jelly() lets light through its thin parts, like a gummy candy: density goes from 0, clear, to 1, deep (0.5 by default). gold, chrome and jelly are shortcuts for metal(#d4af37, 0.2), metal(#ffffff, 0.05) and jelly(). glass() lets you see through the object, bent by its refraction index (1 to 3, 1.5 by default: 1.33 is water, 2.4 is diamond). The frost, from 0 to 1, comes with an optional style: frosted (white patches, the default), wavy (big waves), hammered (small bumps) or blurred (soft blur). glass is glass(), ice is glass(#cfeaff, 1.31, frosted 0.25). The color of a material can also be a gradient: metal(linear-gradient(#ffd27a, #ff5a36), 0.2).",
    examples: [
      {
        name: "matte()",
        code: "@scene { sphere; } sphere { color: #ff5a36; material: matte(); }",
      },
      {
        name: "metal()",
        code: "@scene { sphere#a; sphere#b; sphere#c; } #a { translate: 1.3 0.6 0; radius: 0.6; material: gold; } #b { translate: 0 0.6 0; radius: 0.6; material: chrome; } #c { translate: -1.3 0.6 0; radius: 0.6; color: #d4af37; material: metal(0.7); }",
      },
      {
        name: "jelly()",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; radius: 0.6; color: #ff5a36; material: jelly; } cube { translate: -0.8 0.5 0; rotate-y: -30deg; color: #3ad16b; material: jelly(0.3); }",
      },
      {
        name: "glass()",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass; }",
      },
      {
        name: "glass() with color and refraction index",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: glass(#ffffff, 1.5, 0.3); }",
      },
      {
        name: "ice()",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.6; material: ice; }",
      },
      {
        name: "glass() with frost",
        code: "@scene { sphere; cube; } sphere { translate: 0 0.7 0; radius: 0.6; material: glass; } cube { translate: -0.3 0.5 -1.5; color: #ff5a36; }",
      },
      {
        name: "glass() with frost and style",
        code: "@scene { sphere#a; sphere#b; cube; } #a { translate: 0.7 0.7 0; radius: 0.6; material: glass(1.5, wavy 0.6); } #b { translate: -0.7 0.7 0; radius: 0.6; material: glass(1.5, blurred 0.6); } cube { translate: 0 0.5 -1.8; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "texture",
    appliesTo: "object",
    syntax: 'url("<file>") | element(<id>)',
    initial: "none",
    description:
      "Projects an image onto the surface of the object: one image per face, the top, the bottom and the sides, whatever the size of the object. The image replaces the base color of the material, and moves, turns and scales with the object. element(#card) shows a live image of an HTML element instead, like CSS element(): the browser draws it with the page's own CSS and fonts, and the object shows it again each time it changes. The element goes inside the scene: inside <gss-scene>, next to its script, or inside the canvas given to mount(). It stays in the page, so it stays accessible, but it is only seen on the object. This needs a browser that draws HTML in a canvas (Chromium, for now); elsewhere, the object keeps its color. A scene with an element is drawn with WebGL2.",
    examples: [
      {
        name: "texture",
        code: '@scene { cube; } cube { translate: 0 0.5 0; texture: url("/textures/dirt.png"); }',
      },
      {
        name: "an HTML element, with element()",
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
      "How the image of texture is drawn. pixelated reads the nearest pixel of the image: every pixel stays a sharp square, the look of pixel art (a 16×16 Minecraft-style block). auto and smooth blend the pixels, for photos and painted textures. crisp-edges is the same as pixelated.",
    examples: [
      {
        name: "image-rendering",
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
      "The size of one image on the surface, in the object's units, like background-size: the image repeats to cover the face. texture-size: 0.5 on a cube of size 3 shows 6 × 6 images per face. auto, the default, fits one image to each face, whatever the size of the object.",
    examples: [
      {
        name: "texture-size",
        code: "@scene { cube; } cube { size: 3 0.2 3; translate: 0 0.1 0; texture: url('/textures/dirt.png'); texture-size: 0.5; image-rendering: pixelated; }",
      },
    ],
  },
  {
    name: "mask-image",
    appliesTo: "object",
    animatable: true,
    syntax: "none | <gradient>",
    initial: "none",
    description:
      "Cuts holes in the object, like a CSS mask: where the image covers the surface, the object is there; where the image is transparent, the surface is not drawn, and the eye sees the inside of the object, then what is behind it. The image is a gradient or a noise(), or one of them moved by displace(), read like a gradient in color: seen from the front in the object's own space, and noise() in 3D, so the holes move and turn with the object. Its colors can be transparent: transparent, #00000000, rgb(0 0 0 / 0%), a color-mix() under 100%. By default the alpha of the image counts (see mask-mode). A part covered less than half is a hole, so the edge of a hole is sharp: unlike CSS, a mask does not fade the object. It can be animated and changed by :hover like a gradient in color: moving the stops of a noise() dissolves the object. The holes are seen everywhere, in the reflections too, and the mouse goes through them: :hover reaches the object behind a hole.",
    examples: [
      {
        name: "holes from a noise",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: #ff5a36; mask-image: noise(4 3, black 48%, transparent 52%); }",
      },
      {
        name: "a sphere seen through a cube",
        code: "@scene { cube; sphere; } scene { camera-angle: 20deg 15deg; } cube { translate: 0 0.7 0; size: 1.4; color: #3a7bff; mask-image: radial-gradient(circle, transparent 35%, black 36%); } sphere { translate: 0 0.7 0; radius: 0.35; color: #ff5a36; }",
      },
      {
        name: "a dissolve",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: #ff5a36; mask-image: noise(4 3, black 20%, transparent 20%); animation: dissolve 3s ease-in-out alternate; } @keyframes dissolve { to { mask-image: noise(4 3, black 80%, transparent 80%); } }",
      },
    ],
  },
  {
    name: "mask-mode",
    appliesTo: "object",
    syntax: "alpha | luminance | match-source",
    initial: "match-source",
    description:
      "Which part of mask-image counts, like CSS. alpha: the transparency of its colors, so black and white are both there. luminance: their brightness, times their alpha, like an SVG mask: white is there, black is a hole. match-source, the default, reads a gradient by its alpha, like CSS.",
    examples: [
      {
        name: "a cage, with luminance",
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
      "Rotates the object around the x axis. Like CSS rotateX(), a positive angle turns its top away from the viewer. On a group, it turns everything inside it around the group's origin.",
    examples: [
      {
        name: "rotate-x",
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
      "Rotates the object around the y axis. Like CSS rotateY(), a positive angle turns its right side away from the viewer. On a group, it turns everything inside it around the group's origin.",
    examples: [
      {
        name: "rotate-y",
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
      "Rotates the object around the z axis. Like CSS rotate(), a positive angle turns it clockwise. On a group, it turns everything inside it around the group's origin.",
    examples: [
      {
        name: "rotate-z",
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
      "Scales the object along the x, y and z axes. On a group, it scales everything inside it, the positions of its children included.",
    examples: [
      {
        name: "scale",
        code: "@scene { cube; } cube { scale: 2.0; }",
      },
    ],
  },
  {
    name: "transform-origin",
    appliesTo: "object",
    animatable: true,
    syntax: "[ left | center | right | top | bottom | <percentage> | <number> ]{1,2} <number>?",
    initial: "center",
    description:
      "The point the object turns and scales around, like CSS: rotate-x, rotate-y, rotate-z and scale keep it in place, and a motion path carries it along the path. The keywords and the percentages are read on the box of the object, like CSS: left and 0% are its left side, right and 100% its right side, top and 0% its top, bottom and 100% its bottom; two keywords can come in any order (top left). A number is a point of the object's own space, from its center, with y up, like translate: transform-origin: 0 0.5 0 is 0.5 above the center. The third value, z, is a number. On a group, which has no box, it takes numbers and center. Unlike CSS, where a length is measured from the top left corner, a number is measured from the center, as everything is in GSS.",
    examples: [
      {
        name: "a door on its hinge",
        code: "@scene { cube#door; cube#frame; } #frame { size: 0.1 1.6 0.1; translate: -0.6 0.8 0; color: #3a7bff; } #door { size: 1.1 1.5 0.08; translate: 0 0.8 0; transform-origin: left; animation: open 3s ease-in-out infinite alternate; color: #ff5a36; } @keyframes open { to { rotate-y: -80deg; } }",
      },
      {
        name: "grow from the floor",
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
      "Sets how the object combines with the objects declared before it in @scene: union adds it, subtract carves it out of them, intersect keeps only their common part. The floor is never affected.",
    examples: [
      {
        name: "operation",
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
      "Smooths the junction between the object and the objects declared before it, over the given distance. 0 keeps a sharp junction. Works with every operation.",
    examples: [
      {
        name: "blend",
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
      "Glides the object to its :hover state and back, instead of jumping, like CSS. The first time is the duration, the second one a delay, and the easing is ease by default; it can be any keyword, cubic-bezier(), linear() or steps(). One transition covers every property :hover changes on the object. Like CSS, the object enters :hover with the transition written in its :hover rule, if there is one, and leaves it with the transition written at rest. Leaving halfway goes back from where it is, in the time already spent.",
    examples: [
      {
        name: "transition",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: #ff5a36; transition: 0.4s ease-out; } cube:hover { scale: 1.3; rotate-y: -45deg; color: #3a7bff; }",
      },
      {
        name: "transition",
        code: "@scene { sphere * 5; } sphere { radius: 0.35; translate: calc(2.7 - sibling-index() * 0.9) 0.4 0; color: #3ad16b; transition: 0.8s cubic-bezier(0.3, -0.4, 0.7, 1.4); } sphere:hover { translate: calc(2.7 - sibling-index() * 0.9) 1.4 0; transition: 0.4s ease-out; }",
      },
      {
        name: "transition",
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
      "Plays a @keyframes animation on the object, like CSS. After the name: the duration (s or ms), then if needed an easing, a delay, a number of iterations, a direction and a fill mode, in any order. Unlike CSS, an animation loops forever unless you give it a number of iterations. The second time is the delay: the animation starts after it, or partway with a negative delay. A number plays that many times (1.5 stops halfway through the second), infinite loops. alternate plays it forward then backward, reverse backward, alternate-reverse backward first. The fill mode says what the object shows outside the animation: none, its own value, like CSS; backwards, the first frame during the delay; forwards, the last frame once it is over; both, the two. The easing shapes each step: linear, the default, keeps a constant speed; ease, ease-in, ease-out and ease-in-out speed up and slow down; cubic-bezier() and linear() draw your own curve; steps() moves by jumps. In an animation, ease-in-out is computed as a smoothstep, a very close curve. Each part also has its own property: animation-duration, animation-delay, animation-iteration-count, animation-direction, animation-fill-mode and animation-timing-function, which win over what animation says. Animatable properties: translate, rotate-x, rotate-y, rotate-z, scale, color (a gradient too), mask-image and offset-distance, and background on the scene. On a group, it animates translate, the rotations and scale of the whole group. On the scene, it animates the background and the variables of the scene that the background uses; the objects do not follow the variables a scene animates, they play their own animation.",
    examples: [
      {
        name: "animation",
        code: "@scene { sphere; } sphere { animation: float 2s ease-in-out alternate; } @keyframes float { from { translate: 0 1 0; } to { translate: 0 2 0; } }",
      },
      {
        name: "animation",
        code: "@scene { cube; } cube { translate: 0 0.5 0; animation: bounce 1s; } @keyframes bounce { 0%, 100% { translate: 0 0.5 0; } 50% { translate: 0 1.5 0; scale: 1.2; } }",
      },
      {
        name: "animation",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: #ff5a36; animation: turn 4s linear; } @keyframes turn { to { rotate-y: -1turn; color: #3a7bff; } }",
      },
      {
        name: "animation",
        code: "@scene { sphere; } sphere { translate: 0 0.5 0; radius: 0.5; color: #ff5a36; animation: jump 1.2s cubic-bezier(0.3, -0.4, 0.7, 1.4) alternate; } @keyframes jump { to { translate: 0 2 0; } }",
      },
      {
        name: "animation",
        code: "@scene { cube; } cube { translate: 0 3 0; color: #ff5a36; animation: drop 1s ease-in 0.5s 1 both; } @keyframes drop { to { translate: 0 0.5 0; rotate-y: -90deg; } }",
      },
      {
        name: "animation on the scene",
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
      "The duration of one iteration of the animation, in s or ms. It wins over the duration written in animation.",
    examples: [
      {
        name: "animation-duration",
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
      "How long the animation waits before it starts, in s or ms. A negative delay starts it partway, as if it had begun earlier. It wins over the delay written in animation.",
    examples: [
      {
        name: "animation-delay",
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
      "How many times the animation plays: a number (1.5 stops halfway through the second time) or infinite. Unlike CSS, where it plays once, a GSS animation loops forever by default. It wins over the count written in animation.",
    examples: [
      {
        name: "animation-iteration-count",
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
      "The way the animation plays: forward (normal), backward (reverse), forward then backward (alternate), or backward then forward (alternate-reverse). It wins over the direction written in animation.",
    examples: [
      {
        name: "animation-direction",
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
      "What the object shows outside the animation, like CSS: none, its own value; backwards, the first frame during the delay; forwards, the last frame once the animation is over; both, the two. It only matters with a delay or a number of iterations.",
    examples: [
      {
        name: "animation-fill-mode",
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
      "The easing of each step of the animation: a keyword (linear, ease, ease-in, ease-out, ease-in-out, step-start, step-end), cubic-bezier(), linear() or steps(). It wins over the easing written in animation.",
    examples: [
      {
        name: "animation-timing-function",
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
      "Drives the animation with the scroll of the page instead of the time, like CSS scroll-driven animations. auto, the default, plays it in time. scroll() follows a scroll container from its start (0%) to its end (100%): nearest, the default, is the closest one around the scene, root is the page; the axis is block (vertical, the default), inline (horizontal), y or x. view() follows the scene itself crossing its scroll container: 0% when it enters at the bottom, 100% when it leaves at the top. The whole timeline is the whole animation, so the duration and the delay do not count: write any duration, like animation: spin 1s linear; animation-timeline: scroll();. The number of iterations and the direction still do, and an animation without an iteration count plays once along the scroll. Scrolling back plays it backwards, and the easing applies as usual. Write it after animation, which needs a name and a duration. A scene takes up to 4 different timelines. In the playground, which does not scroll, a slider stands in for the scroll; the Shadertoy export shows the start.",
    examples: [
      {
        name: "turn with the page",
        code: "@scene { cube; } cube { translate: 0 0.6 0; corner-radius: 0.1; color: #ff5a36; animation: turn 1s linear; animation-timeline: scroll(); } @keyframes turn { from { rotate-y: 0deg; } to { rotate-y: -360deg; translate: 0 1.6 0; } }",
      },
      {
        name: "rise into view",
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
      "A motion path, like CSS: the way the object travels along, placed by offset-distance and turned by offset-rotate. path() takes the d of an SVG path, in the object's own xy plane, facing the camera like the path shape: centered on itself, y up, one path unit for one scene unit, so a path shape with the same d draws the track the object follows. For a path on the floor, turn a group with rotate-x: 90deg. A path that ends with Z is closed: the object goes round it. ray() is a straight line from the object's place, at an angle: 0deg up, 90deg right, like CSS. Like CSS, the motion path comes after translate, the rotations and scale: translate moves the whole path, scale scales it. It works on groups too.",
    examples: [
      {
        name: "along a track",
        code: '@scene { path#track; sphere#ball; } #track { translate: 0 1.2 0; d: path("M-2 0 C-1 2 1 -2 2 0"); stroke-width: 0.04; color: #555555; } #ball { translate: 0 1.2 0; radius: 0.2; color: #ff5a36; offset-path: path("M-2 0 C-1 2 1 -2 2 0"); animation: go 3s ease-in-out alternate; } @keyframes go { to { offset-distance: 100%; } }',
      },
      {
        name: "round a closed path, turned along it",
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
      "How far along its offset-path the object is: a number, in the units of the path, or a percentage of its length, like CSS. Animate it with @keyframes, a transition on :hover or the scroll. On an open path, the object stops at its ends; on a closed path (with Z), it goes round, so 150% is halfway round the second lap. A ray has no length: give it a number.",
    examples: [
      {
        name: "three places on one path",
        code: '@scene { sphere * 3; } sphere { translate: 0 1 0; radius: 0.25; color: #e6e6e6; offset-path: path("M-2 0 Q0 2 2 0"); offset-distance: calc((sibling-index() - 1) * 50%); } sphere:nth-child(2) { color: #ff5a36; }',
      },
      {
        name: "on :hover, along a ray",
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
      "How the object turns on its offset-path, like CSS. auto, the default, turns its x axis along the path, like a car on a road; reverse turns it the other way. An angle alone keeps a fixed turn, like rotate-z; with auto or reverse, it is added to the turn along the path: auto 90deg. Write offset-rotate: 0deg to keep the object upright.",
    examples: [
      {
        name: "along the path, or upright",
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
      "Sets the size of the cube along the x, y and z axes: one value makes a cube, three values make a box. On a plane, sets its width and depth: one value makes a square.",
    examples: [
      {
        name: "size of a cube",
        code: "@scene { cube; } cube { translate: 0 0.5 0; size: 2 1 1; }",
      },
      {
        name: "size of a plane",
        code: "@scene { plane; } plane { translate: 0 1 0; rotate-x: 90deg; size: 2 1.5; color: #ff5a36; }",
      },
      {
        name: "size of a plane with a different rotation",
        code: "@scene { plane; } plane { translate: 0 1 0; rotate-x: 90deg; size: 2 1.5; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "corner-radius",
    appliesTo: ["cube"],
    syntax: "<number>",
    initial: "0.08",
    description: "Rounds the edges of the cube. 0 gives sharp edges.",
    examples: [
      {
        name: "corner-radius",
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
      "Sets the radius of the sphere, the cylinder or the capsule, or the radius of the torus ring, measured to the center of its tube. A cone takes a bottom and a top radius, like border-radius takes several values: the top one is 0 by default, which makes a point, and a positive top radius makes a truncated cone.",
    examples: [
      {
        name: "radius of a sphere",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 1; }",
      },
      {
        name: "radius of a cone",
        code: "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
      },
      {
        name: "radius of a cone with a different rotation",
        code: "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
      },
    ],
  },
  {
    name: "thickness",
    appliesTo: ["torus"],
    syntax: "<number>",
    initial: "0.28",
    description: "Sets the radius of the torus tube.",
    examples: [
      {
        name: "thickness",
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
      "Sets the full height of the cylinder, the cone or the capsule, along the y axis. The height of a capsule counts its round ends, so it must be at least twice its radius. The shape is centered on its origin: to stand it on the floor, set its y to half its height.",
    examples: [
      {
        name: "height of a cylinder",
        code: "@scene { cylinder; } cylinder { translate: 0 1 0; radius: 0.4; height: 2; }",
      },
      {
        name: "height of a cone",
        code: "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
      },
      {
        name: "height of a cone with a different rotation",
        code: "@scene { cone; } cone { translate: 0 0.75 0; radius: 0.5 0.2; height: 1.5; }",
      },
      {
        name: "height of a capsule",
        code: "@scene { capsule; } capsule { translate: 0 0.75 0; radius: 0.25; height: 1.5; }",
      },
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
      {
        name: "d of a path",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0.5 C-1 -1 1 -1 1 0.5"); stroke-width: 0.25; color: #ff5a36; }',
      },
      {
        name: "d of a path with a different scale",
        code: '@scene { path; } path { translate: 0 1.2 0; d: path("M0 0 L1 1.5 L2 0 L3 1.5 L4 0"); stroke-width: 0.3; scale: 0.5; material: gold; }',
      },
      {
        name: "d of a path with a different rotation",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0 A1 1 0 1 1 1 0 A1 1 0 1 1 -1 0 M-0.4 -0.3 A0.5 0.5 0 0 0 0.4 -0.3"); stroke-width: 0.15; color: #ff5a36; }',
      },
      {
        name: "d of a path with a different stroke-width",
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
      "The thickness of the tube that follows the path, in path units, like the stroke-width of an SVG. The ends of the tube are round.",
    examples: [
      {
        name: "stroke-width",
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
      "The full thickness of a prism along the z axis, centered on its origin: depth: 1 goes from z = -0.5 to z = 0.5.",
    examples: [
      {
        name: "depth",
        code: "@scene { prism; } prism { translate: 0 1 0; d: polygon(0 -1, 1 1, -1 1); depth: 1; color: #ff5a36; }",
      },
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
      {
        name: "view-box",
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
      "Sets the sun: first its direction, its azimuth around the vertical axis (0deg points to +z, 90deg to +x), then its elevation above the horizon (90deg is straight overhead); then, if needed, its color (white by default) and its intensity (1 by default), in any order. The default lights the scene from the upper left, in front. none turns the sun off, for a scene lit only by its own lights (the light elements of @scene) and its ambient light. The scene can animate it, with animation on the scene: a sun that turns, changes color, or rises from none.",
    examples: [
      {
        name: "light",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { light: -120deg 30deg; }",
      },
      {
        name: "a warm sun",
        code: "@scene { sphere; } sphere { translate: 0 0.6 0; radius: 0.6; } scene { light: -60deg 25deg #ffb36b 1.2; ambient: 0.2 #6b8cff; }",
      },
      {
        name: "no sun",
        code: "@scene { sphere; light#lamp; } sphere { translate: 0 0.6 0; radius: 0.6; } #lamp { translate: 1 1.5 1; intensity: 2.5; } scene { light: none; ambient: 0.05; }",
      },
      {
        name: "a day",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { animation: day 6s ease-in-out infinite alternate; } @keyframes day { from { light: -80deg 5deg #ff8a5c 0.6; } to { light: 60deg 70deg #ffffff 1; } }",
      },
    ],
  },
  {
    name: "intensity",
    appliesTo: ["light"],
    animatable: true,
    syntax: "<number>",
    initial: "1",
    description:
      "How much light a light of @scene gives: what a surface facing it receives at 1 unit, then less with the square of the distance (a quarter at 2 units, a ninth at 3). 0 turns it off. It can be animated, changed by :hover and set from JavaScript.",
    examples: [
      {
        name: "intensity",
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
      "Sets the minimum light received by surfaces facing away from the sun, from 0 (black shadows) to 1 (no shadows). The sun gives the rest. A color can follow, for the light of the sky in the shadows: ambient: 0.2 #9db4ff gives bluish shadows under a warm sun.",
    examples: [
      {
        name: "ambient",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { ambient: 0.4; }",
      },
    ],
  },
  {
    name: "camera-target",
    appliesTo: "scene",
    syntax: "<number>{3}",
    initial: "0 0.5 0",
    description: "Sets the point the camera looks at and orbits around.",
    examples: [
      {
        name: "camera-target",
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
      "Sets the starting distance between the camera and its target, from 3 to 15. The mouse wheel changes it.",
    examples: [
      {
        name: "camera-distance",
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
      "Sets the starting position of the camera around its target: first the angle around the vertical axis (0deg in front, on +z; 90deg on the right, on +x), then the height above the horizon, from 0deg to 80deg. Dragging with the mouse changes it.",
    examples: [
      {
        name: "camera-angle",
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
      "Sets how long the camera takes to turn once around its target, in s or ms. none stops the automatic rotation.",
    examples: [
      {
        name: "camera-spin",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { camera-spin: 40s; }",
      },
    ],
  },
  {
    name: "floor",
    appliesTo: "scene",
    syntax: "<color> | none",
    initial: "#e8e3db",
    description:
      "Sets the color of the floor, an infinite plane at y = 0 that is lit like the objects. none removes it: the objects float over the background, like the GSS logo.",
    examples: [
      {
        name: "floor",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { floor: #1a1a1f; }",
      },
      {
        name: "floor with a different background",
        code: "@scene { sphere; } sphere { color: #ff5a36; material: jelly(0.6); } scene { floor: none; background: #0a0a0c; }",
      },
    ],
  },
  {
    name: "filter",
    appliesTo: "everywhere",
    syntax: "none | <filter-function>+",
    initial: "none",
    description:
      "Post-processing, like CSS filter: a list of functions applied in order, on the whole image (scene { filter }), on an object, or on a group and everything in it. On an object or a group, the filters change only its own pixels, and reflections see them too: a blur() spreads it over what is around it, a bloom() makes only its bright parts glow. Like CSS, an object's filter comes before its group's, and the scene's comes last; on an object, the filters that read only their own pixel come before blur() and bloom(), and an object and its group cannot both have a blur() or a bloom(). brightness(), contrast(), saturate(), grayscale(), sepia(), invert() take a number or a percentage (1 or 100% changes nothing; grayscale(), sepia() and invert() go up to 1), hue-rotate() an angle; they cost almost nothing. grain() adds a film-like noise that moves at every frame (0.1 by default). blur() blurs by a length in px, like CSS; bloom() makes the bright parts glow: an amount (0.6 by default) and a radius in px (16px by default). blur() and bloom() read the pixels around each pixel: the scene is first drawn into an image, then blurred, which costs more as the radius grows. opacity() and drop-shadow() need transparency, which GSS does not have. The Shadertoy export keeps the filters that read only their own pixel, not blur() and bloom().",
    examples: [
      {
        name: "brightness()",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { filter: brightness(1.4); }",
      },
      {
        name: "contrast()",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: contrast(1.6); }",
      },
      {
        name: "saturate()",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: saturate(2); }",
      },
      {
        name: "grayscale()",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: grayscale(1); }",
      },
      {
        name: "sepia()",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: sepia(0.8); }",
      },
      {
        name: "hue-rotate()",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: hue-rotate(120deg); }",
      },
      {
        name: "invert()",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { filter: invert(1); }",
      },
      {
        name: "grain()",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { background: #1a1a22; filter: grain(0.15); }",
      },
      {
        name: "blur()",
        code: "@scene { sphere; cube; } sphere { translate: 0.8 0.6 0; color: #ff5a36; } cube { translate: -0.8 0.5 0; color: #3a7bff; } scene { filter: blur(3px); }",
      },
      {
        name: "bloom()",
        code: "@scene { sphere.light * 5; } .light { radius: 0.25; translate: calc(2.4 - sibling-index() * 0.8) 0.8 0; color: hsl(calc(sibling-index() * 40) 100% 70%); } scene { floor: none; background: #07070a; ambient: 1; filter: bloom(0.9, 20px); }",
      },
      {
        name: "filter on objects",
        code: "@scene { sphere#a; sphere#b; sphere#c; } sphere { radius: 0.5; color: #ff5a36; } #a { translate: 1.3 0.6 0; filter: grayscale(1); } #b { translate: 0 0.6 0; filter: blur(4px); } #c { translate: -1.3 0.6 0; filter: hue-rotate(180deg) brightness(1.3); }",
      },
      {
        name: "filter on a group",
        code: "@scene { group#lights { sphere * 4 } cube; } #lights { filter: bloom(0.9, 18px); } #lights sphere { radius: 0.2; translate: calc(1.75 - sibling-index() * 0.7) 1.4 0; color: #ffd27a; } cube { translate: 0 0.5 0; color: #3a7bff; } scene { floor: none; background: #07070a; }",
      },
      {
        name: "filters together",
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
      "Sets the background, visible wherever there is no object and no floor: a color, or a gradient drawn over the canvas like a CSS background (linear-gradient(), radial-gradient(), conic-gradient() and their repeating forms), a noise() or a displace(). The scene can animate it, with animation on the scene: a color into another color, a gradient into another gradient of the same kind with as many colors, or through the variables of the scene. A scene without objects and without a floor is then a flat, moving image. Like CSS, a background can have several layers, separated by commas, the first on top: background: noise(3, #ffffff00 40%, #ffffff), linear-gradient(#2f6bd8, #9fc4ff); only the last can be a color. The colors of these layers can be transparent (transparent, #ffffff80, rgb(… / 50%), a color-mix() under 100%), so a layer shows the ones below it, and background-blend-mode blends them; apart from mask-image, GSS has no transparency anywhere else.",
    examples: [
      {
        name: "background",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { background: #42429f; }",
      },
      {
        name: "background with a gradient",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { floor: none; background: radial-gradient(circle at 50% 40%, #2a2a3a, #07070a); }",
      },
      {
        name: "layers: clouds over a sky",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: noise(2 4, #ffffff00 45%, #ffffff 80%), linear-gradient(#2f6bd8, #9fc4ff); }",
      },
      {
        name: "animated background",
        code: "@scene { } scene { floor: none; --x: 20%; background: radial-gradient(circle at var(--x) 40%, #ffb36b, #ff6540 30%, #722cff 70%, #171322); animation: drift 8s ease-in-out alternate; filter: grain(0.06); } @keyframes drift { to { --x: 80%; } }",
      },
    ],
  },
  {
    name: "background-blend-mode",
    appliesTo: "scene",
    syntax: "<blend-mode>#",
    initial: "normal",
    description:
      "How each layer of background blends with what is below it, like CSS: normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color or luminosity. One mode per layer, the first for the top layer; a shorter list repeats over the layers. The transparency of a layer still applies: a transparent part blends nothing.",
    examples: [
      {
        name: "a grain over a gradient",
        code: "@scene { } scene { floor: none; background: noise(40 2, #808080, #ffffff), linear-gradient(135deg, #ff5a36, #3a7bff); background-blend-mode: multiply; }",
      },
      {
        name: "two noises, screened",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: noise(3 3, #000000 45%, #ff5a36), noise(2 4 seed 3, #000000 40%, #3a7bff), #000000; background-blend-mode: screen; }",
      },
    ],
  },
  {
    name: "fog",
    appliesTo: "scene",
    animatable: true,
    syntax: "none | [ <color> ]? <number> <number> [ <color> ]?",
    initial: "none",
    description:
      "Fills the scene with fog, measured from the camera: no fog before the first number, only fog after the second, and more and more of it between. Without a color, each object fades into the background seen behind it, gradients included: the far objects melt into the sky. With a color, the fog takes that color, and so does the background, since past the end of the fog only the fog is seen. The scene draws nothing more than 20 units away from the camera: a fog that ends before that hides the far edge of the floor. The scene can animate it, with animation on the scene or through its variables, and it can move from none into a fog. The reflections and the refractions show the objects without fog.",
    examples: [
      {
        name: "into the background",
        code: "@scene { cube * 7; } cube { size: 0.6; translate: calc((sibling-index() - 4) * -1.1) 0.3 calc(sibling-index() * -1.6); color: #ff5a36; } scene { background: #c9d6e3; fog: 3 13; }",
      },
      {
        name: "a colored fog",
        code: "@scene { sphere * 5; } sphere { radius: 0.4; translate: 0 0.4 calc(sibling-index() * -2); color: #3a7bff; } scene { fog: #e8e0d4 2 11; camera-angle: 20deg 12deg; }",
      },
      {
        name: "the fog rolls in",
        code: "@scene { cylinder * 9; } cylinder { radius: 0.15; height: 1.6; translate: calc((sibling-index() - 5) * -0.9) 0.8 calc(sibling-index() * -1.2); color: #e6e6e6; } scene { background: #1a1d2b; floor: #2a2e40; fog: none; animation: roll 6s ease-in-out infinite alternate; } @keyframes roll { to { fog: 1 7; } }",
      },
    ],
  },
  {
    name: "shadows",
    appliesTo: "scene",
    syntax: "none | hard | soft",
    initial: "none",
    description:
      "Lets the objects cast shadows, on the floor and on each other: each point of the scene looks toward each light, and an object on the way keeps that light from it, so only the ambient light is left. soft gives the edge of a shadow a penumbra that grows with the distance to the object that casts it, like the shadow of the sun; hard cuts it sharp; none, the default, draws no shadow. The sun and every light of @scene cast shadows, and the holes of mask-image let the light through. Each light costs one more ray per pixel. The reflections and the refractions show the objects without shadows.",
    examples: [
      {
        name: "soft shadows",
        code: "@scene { sphere; cube; } scene { shadows: soft; light: -30deg 50deg; } sphere { translate: -0.6 0.9 0; radius: 0.5; color: #ff5a36; } cube { translate: 0.7 0.4 0.3; size: 0.8; color: #3a7bff; }",
      },
      {
        name: "hard shadows from a lamp",
        code: "@scene { light; sphere; } scene { shadows: hard; light: none; ambient: 0.15; } light { translate: 0.8 2.4 0.6; intensity: 4; color: #ffd27a; } sphere { translate: 0 0.7 0; radius: 0.6; }",
      },
      {
        name: "light through holes",
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
      "Sets the pixel density of the render, like the device pixel ratio of the screen. auto follows the screen up to 2. max follows the screen, however dense: the sharpest image, and the slowest. A number from 0.25 to 4 sets the density, never above the screen's: below 1, the render is coarser and faster.",
    examples: [
      {
        name: "dpr",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { dpr: max; }",
      },
      {
        name: "dpr",
        code: "@scene { cube; } cube { translate: 0 0.5 0; } scene { dpr: 0.5; }",
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
      "Declares the objects of the scene, one per line: a shape (see the Shapes section), an optional #id (only one), any number of .classes, and an optional * n to create n copies. Multiplied ids are numbered: torus#ring * 3 creates ring-1, ring-2 and ring-3. The ; after an object is optional: a new object or a } is enough. A group { … } holds objects and other groups, to move, turn or scale them together; a multiplied group copies everything inside it. Objects are combined in this order (see operation).",
    examples: [
      {
        name: "scene",
        code: "@scene { cube; }",
      },
      {
        name: "scene",
        code: "@scene { cube#base; sphere.ball * 3; } #base { translate: 0 0.5 0; } .ball { translate: 0 1.5 0; radius: 0.3; }",
      },
      {
        name: "scene",
        code: "@scene {\n  cube#base\n  group#tower {\n    cube#a\n    cube#b\n  }\n}\n#base { translate: 1 0.5 0; }\n#tower { translate: -1 0 0; rotate-y: -30deg; }\n#a { translate: 0 0.5 0; }\n#b { translate: 0 1.5 0; scale: 0.7; }",
      },
    ],
  },
  {
    name: "keyframes",
    syntax: "@keyframes <name> { <offset>[, <offset>]* { <declaration>* } … }",
    description:
      "Defines the steps of an animation, played by the animation property. An offset is from (0%), to (100%) or a percentage. A missing 0% or 100% uses the object's own value, and a frame only changes the properties it declares. Only animatable properties can be used in a frame.",
    examples: [
      {
        name: "keyframes",
        code: "@scene { sphere; } sphere { animation: float 2s ease-in-out alternate; } @keyframes float { from { translate: 0 1 0; } to { translate: 0 2 0; } }",
      },
      {
        name: "keyframes",
        code: "@scene { cube; } cube { translate: 0 0.5 0; animation: pulse 1s; } @keyframes pulse { 0%, 100% { scale: 1; } 50% { scale: 1.3; color: #ff5a36; } }",
      },
    ],
  },
  {
    name: "property",
    syntax: '@property --<name> { syntax: "<number>" | "<angle>" | "<percentage>" | "<color>" | "<length>"; inherits: true | false; initial-value: <value>; }',
    description:
      "Registers a variable that the page sets from JavaScript without compiling the scene again, like CSS @property. The syntax says what it holds: a number, an angle, a percentage, a color, or a length in px (the radius of blur() and bloom()); inherits is required, like CSS; initial-value is its value until the page sets another one. A registered variable has one value for the whole scene, like a variable on :root: scene { --speed: 8; } gives its start value, and declaring it on an object, a group, a :hover rule or a @keyframes frame is an error (a frame can read it). The page sets it with scene.setProperty(\"--lift\", \"2\"), on the scene that mount() returns or on the scene property of <gss-scene>: see Set variables from JavaScript. It goes wherever a value reaches the shader: the transforms (translate, rotate-x, rotate-y, rotate-z, scale, transform-origin), color, background and mask-image, the sizes of the shapes (radius, size, height, thickness, corner-radius, stroke-width, depth), the numbers of a gradient (its angle, center, stops and colors), material, floor, ambient, light (and the color and intensity of the lights of @scene), fog, camera-target, blend, offset-distance and offset-rotate, texture-size, and filter, alone (translate: 0 var(--lift) 0), inside the math functions (calc(var(--lift) * 2), sin(), clamp()…) and inside the color functions (hsl(var(--hue) 80% 60%), oklch(), color-mix()…, computed in the same color spaces as the others). The GPU computes them at every frame. It cannot go where the scene is built when it compiles: the copies of * n, d and view-box, the timing of animations and transitions, the camera the mouse moves (camera-distance, camera-angle, camera-spin) and dpr. A value known only when the scene runs cannot be refused like a value written as is: it is kept in its range (a size is never below 0, a roughness stays between 0 and 1), and in color-mix(), a percentage set from JavaScript is kept between 0% and 100%, and percentages that add up to less than 100% are scaled up to 100% instead of being an error. An object whose size or place a variable sets is always drawn: its bounding sphere is not known. random() cannot use it: a random value is chosen once. The Shadertoy export keeps the initial values.",
    examples: [
      {
        name: "property",
        code: '@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; } @scene { sphere; } sphere { translate: 0 var(--lift) 0; radius: 0.5; color: #ff5a36; }',
      },
      {
        name: "property",
        code: '@property --tint { syntax: "<color>"; inherits: false; initial-value: #3a7bff; } @property --turn { syntax: "<angle>"; inherits: false; initial-value: 30deg; } @scene { cube; } scene { --tint: #ff5a36; } cube { translate: 0 0.8 0; rotate-y: var(--turn); color: var(--tint); }',
      },
      {
        name: "property",
        code: '@property --hue { syntax: "<number>"; inherits: false; initial-value: 20; } @scene { sphere * 5; } sphere { radius: 0.35; translate: calc(sibling-index() * 0.8 - 2.4) calc(0.6 + sin(var(--hue) * 1deg) * 0.3) 0; color: oklch(70% 0.16 calc(var(--hue) + sibling-index() * 30)); }',
      },
    ],
    see: [{ anchor: "set-variables", label: "Set variables from JavaScript" }],
  },
  {
    name: "media",
    syntax: "@media <media-query> { <rule> … }",
    description:
      "Applies rules only when the screen matches a media query, like CSS: (max-width: 600px), (min-width: 40em), (orientation: portrait), (prefers-color-scheme: dark), (prefers-reduced-motion), joined with and, not or commas. The browser reads the query, so any media query CSS knows works. Inside, the rules join the cascade where the @media is written, with their usual specificity. When the screen changes (a window resized, the system switching between light and dark mode), the scene follows at once and the camera stays where it is. (prefers-color-scheme: dark) and (prefers-color-scheme: light) follow the light or dark mode of the system, like CSS. A common use: a lighter render on small screens with scene { dpr: 1; }, and no motion for people who ask for less with * { animation: none !important; }. A scene can use up to 4 different queries. @media holds rules only: @scene and @keyframes go outside it.",
    examples: [
      {
        name: "media",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } @media (max-width: 600px) { scene { dpr: 1; } sphere { color: #3a7bff; } }",
      },
      {
        name: "media",
        code: "@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; animation: bob 2s ease-in-out alternate; } @keyframes bob { to { translate: 0 1.6 0; } } @media (prefers-reduced-motion) { * { animation: none !important; } }",
      },
      {
        name: "media",
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
      "A shape name targets every object of that shape. Every shape is listed in the Shapes section. group targets every group.",
    examples: [
      {
        name: "selector-type",
        code: "@scene { cube; sphere; } cube { translate: 0.8 0.5 0; color: #ff5a36; } sphere { translate: -0.8 0.5 0; }",
      },
    ],
  },
  {
    name: ".class",
    anchor: "selector-class",
    specificity: "100 per class",
    description:
      "Targets every object that has this class in @scene. An object can have several classes, and a selector can ask for several: .a.b.",
    examples: [
      {
        name: "selector-class",
        code: "@scene { cube#a.red; cube#b; } #a { translate: 0.8 0.5 0; } #b { translate: -0.8 0.5 0; } .red { color: #ff5a36; }",
      },
    ],
  },
  {
    name: "#id",
    anchor: "selector-id",
    specificity: "10000",
    description:
      "Targets the object with this id. An id multiplied in @scene (torus#hero * 3) is numbered: hero-1, hero-2, hero-3.",
    examples: [
      {
        name: "selector-id",
        code: "@scene { sphere#hero; sphere; } sphere { translate: -0.8 0.5 0; } #hero { translate: 0.8 0.5 0; color: #ff5a36; }",
      },
    ],
  },
  {
    name: "*",
    anchor: "selector-universal",
    specificity: "0",
    description:
      "Targets every object, never the scene settings. Any other selector beats it, wherever it is written: use it for defaults.",
    examples: [
      {
        name: "selector-universal",
        code: "@scene { cube; sphere; } * { color: #ff5a36; } cube { translate: 0.8 0.5 0; } sphere { translate: -0.8 0.5 0; color: #3ad16b; }",
      },
    ],
  },
  {
    name: "a, b",
    anchor: "selector-list",
    specificity: "Each selector keeps its own",
    description:
      "A selector list gives the same declarations to every selector it names, like writing the rule once for each.",
    examples: [
      {
        name: "selector-list",
        code: "@scene { cube#a; cube#b; sphere; } #a, #b { color: #ff5a36; } #a { translate: 1.2 0.5 0; } #b { translate: 0 0.5 0; } sphere { translate: -1.2 0.5 0; }",
      },
    ],
  },
  {
    name: "a b",
    anchor: "selector-descendant",
    specificity: "The sum of its parts",
    description:
      'A space means "inside": #letters cube targets the cubes that are in the group #letters, at any depth. It reads from right to left, like CSS: the last part is the object, each part before it is one of its groups, further out each time. #letters#S would ask for one object with two ids, which never happens: that is an error.',
    examples: [
      {
        name: "selector-descendant",
        code: "@scene { cube#a; group#letters { cube#b; cube#c; } } cube { translate: 1.2 0.5 0; } #letters cube { color: #ff5a36; } #b { translate: 0 0.5 0; } #c { translate: -1.2 0.5 0; }",
      },
    ],
  },
  {
    name: "a > b",
    anchor: "selector-child",
    specificity: "The sum of its parts",
    description:
      "Targets direct children: #g > cube selects the cubes immediately inside #g, excluding those inside a nested group. Combine it with spaces and sibling combinators: #g > group cube. Whitespace around > is optional. Combinators add no specificity.",
    examples: [
      {
        name: "selector-child",
        code: "@scene { group#g { cube#direct; group { cube#nested; } } } cube { translate: 0.8 0.5 0; } #nested { translate: -0.8 0.5 0; } #g > cube { color: #ff5a36; }",
      },
    ],
  },
  {
    name: "a + b",
    anchor: "selector-adjacent",
    specificity: "The sum of its parts",
    description:
      "Targets the immediately following sibling with the same parent: sphere + cube selects a cube directly after a sphere in @scene or a group. Order is the declaration order after multiplication, not the position in 3D. Groups count as siblings, including empty groups. sphere:hover + cube reacts only to the preceding sphere. Whitespace around + is optional.",
    examples: [
      {
        name: "selector-adjacent",
        code: "@scene { sphere; cube#a; cube#b; } sphere { translate: 1.4 0.5 0; radius: 0.4; } #a { translate: 0 0.5 0; } #b { translate: -1.4 0.5 0; } sphere + cube { color: #ff5a36; } sphere:hover + cube { scale: 1.2; }",
      },
    ],
  },
  {
    name: "a ~ b",
    anchor: "selector-sibling",
    specificity: "The sum of its parts",
    description:
      "Targets any following sibling with the same parent: sphere ~ cube selects every cube after a sphere, even with other elements between them. It never selects preceding siblings or children of a sibling. Each copy of * n counts separately; groups, including empty ones, also count. Chains can mix all combinators, and whitespace around ~ is optional.",
    examples: [
      {
        name: "selector-sibling",
        code: "@scene { cube#before; sphere; cube#after * 2; } * { translate: calc((sibling-index() - 2.5) * -1.3) 0.5 0; } sphere { radius: 0.4; } sphere ~ cube { color: #ff5a36; }",
      },
    ],
  },
  {
    name: "&",
    anchor: "selector-nesting",
    specificity: "The sum of the rule around it and of the nested selector",
    description:
      "Nesting, like CSS: a rule can hold other rules, and & stands for the selector of the rule around it. In #g { &:hover { … } }, the nested rule is #g:hover; in .a { #g & { … } }, it is #g .a. A nested selector without & gets the parent in front, followed by a space: #g { cube { … } } is #g cube, and #g { > sphere { … } } is #g > sphere. & also works inside :has() and :not(). Rules nest at any depth, and a @media can go inside a rule: its declarations then apply to that rule when the query matches. The declarations written after a nested rule come after it in the cascade, like CSS. With a list as the parent, a, b { & c { … } } gives a c and b c, and each one keeps its own specificity, where CSS gives both the specificity of the most specific selector of the list.",
    examples: [
      {
        name: "a group and what it holds",
        code: "@scene { group#row { cube.a * 3; sphere; } } #row { color: #e6e6e6; cube { size: 0.6; translate: calc((sibling-index() - 2.5) * -1) 0.3 0; &:hover { color: #ff5a36; } } > sphere { radius: 0.35; translate: -1.5 0.35 0; color: #3a7bff; } }",
      },
      {
        name: "a @media inside a rule",
        code: "@scene { torus; } torus { radius: 0.8; thickness: 0.25; rotate-x: 70deg; color: #3a7bff; @media (max-width: 600px) { color: #ff5a36; } }",
      },
    ],
  },
  {
    name: "::face(), ::top, ::bottom",
    anchor: "selector-face",
    specificity: "1, like a tag, added to the rest",
    description:
      "A pseudo-element, like ::part() in CSS: the rule styles one face of the object, not the object. ::face() takes top, bottom, front, back, left or right, in the object's own space, so the faces turn with it: top is up (+y), front faces +z, right faces +x. ::top and ::bottom are shortcuts for ::face(top) and ::face(bottom). A face without a rule of its own shows the object's texture. On a round shape, a face is the part that faces that way the most: a sphere is cut like the cube around it. A face only takes texture, and it goes at the end of the selector, like CSS: cube.grass::top, never #g::top cube.",
    examples: [
      {
        name: "::face()",
        code: '@scene { cube.furnace; } .furnace { translate: 0 0.5 0; rotate-y: -30deg; texture: url("/textures/dirt.png"); image-rendering: pixelated; } .furnace::face(front) { texture: url("/textures/grass-top.png"); }',
      },
      {
        name: "::top",
        code: '@scene { cube.grass; } .grass { translate: 0 0.5 0; texture: url("/textures/grass-side.png"); image-rendering: pixelated; } .grass::top { texture: url("/textures/grass-top.png"); }',
      },
      {
        name: "::bottom",
        code: '@scene { cube.flip; } .flip { translate: 0 0.6 0; rotate-x: 150deg; texture: url("/textures/grass-side.png"); image-rendering: pixelated; } .flip::bottom { texture: url("/textures/dirt.png"); }',
      },
      {
        name: "::face(), ::top and ::bottom together",
        code: '@scene { cube.grass * 2; } .grass { translate: calc(2.1 - sibling-index() * 1.4) 0.5 0; rotate-y: -30deg; rotate-x: calc(sibling-index() * 150deg - 150deg); texture: url("/textures/grass-side.png"); image-rendering: pixelated; } .grass::top { texture: url("/textures/grass-top.png"); } .grass::bottom { texture: url("/textures/dirt.png"); } .grass::face(front) { texture: url("/textures/dirt.png"); }',
      },
    ],
  },
  {
    name: ":hover",
    anchor: "selector-hover",
    specificity: "100, like a class, added to the rest",
    description:
      "A pseudo-class, like CSS: the rule applies while the mouse is over the object. It can go anywhere after the shape name (cube:hover.big) on a preceding sibling (sphere:hover + cube), or on a group: #letters:hover cube lifts every cube of #letters as soon as the mouse is over any object of the group, like hovering a child hovers its parent in CSS. The :hover rules join the cascade like any other: #a { color: blue; } beats cube:hover { color: red; }, and a normal !important beats them all. A :hover rule changes the animatable properties only (translate, rotate-x, rotate-y, rotate-z, scale, color, mask-image, offset-distance, and variables), never a face, and it styles objects, not groups: #g:hover { translate: 0 1 0; } is an error, write #g:hover cube. With transition, the change glides instead of jumping.",
    examples: [
      {
        name: "selector-hover",
        code: "@scene { cube#a; cube#b; } cube { translate: 0.8 0.5 0; color: #e6e6e6; } #b { translate: -0.8 0.5 0; } cube:hover { translate: 0.8 1 0; color: #ff5a36; rotate-y: -45deg; } #b:hover { translate: -0.8 1 0; }",
      },
      {
        name: "selector-hover",
        code: "@scene { group#letters { cube#l1; cube#l2; cube#l3; } sphere; } #letters { translate: 1.6 0.5 0; } #letters cube { size: 0.4 1 0.4; color: #e6e6e6; } #l2 { translate: -0.7 0 0; } #l3 { translate: -1.4 0 0; } #letters:hover cube { color: #ff5a36; scale: 1.15; } sphere { translate: -1.4 0.5 0; radius: 0.5; }",
      },
    ],
  },
  {
    name: ":active",
    anchor: "selector-active",
    specificity: "100, like a class, added to the rest",
    description:
      "A pseudo-class, like CSS: the rule applies while the object is pressed, with the mouse button or a finger. Like CSS, the object pressed stays pressed until the button goes up, even if the pointer leaves it. A pressed object is under the pointer, so the :hover rules still apply while it is pressed, and :active wins over them at equal specificity when written after them: cube:hover { scale: 1.1; } cube:active { scale: 0.95; } gives a button that grows under the mouse and sinks when clicked. It goes wherever :hover goes: on a preceding sibling (sphere:active + cube), on a group (#g:active cube presses every cube of #g when any of its objects is pressed), inside :has() (#lamp:has(#switch:active) #bulb). It changes the animatable properties only, and styles objects, not groups. With transition, pressing takes the transition of the :active rule, and releasing the one of the hovered state. On a touch screen, the finger presses the object it lands on.",
    examples: [
      {
        name: "a button that sinks when pressed",
        code: "@scene { cube#button; } #button { size: 1.2 0.3 1.2; corner-radius: 0.1; translate: 0 0.15 0; color: #e6e6e6; transition: 0.25s ease-out; } #button:hover { color: #ff5a36; translate: 0 0.25 0; } #button:active { translate: 0 0.05 0; color: #c2401f; transition: 0.06s; }",
      },
      {
        name: "press one, move another",
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
      "A pseudo-class, like CSS: a group matches when something inside it, at any depth, matches the selector in the parentheses. #g:has(sphere) cube styles the cubes of the groups that hold a sphere, once, when the scene is compiled. With :hover inside, it reacts to the mouse: #g:has(sphere:hover) cube changes the cubes of #g while a sphere of #g is under the mouse, so hovering one object can move another. Inside the parentheses, any selector works: a descendant selector, read from the group down (#g:has(#inner sphere:hover)), or a list, where one match is enough (#g:has(sphere:hover, cube:hover)). A leading combinator is relative to the subject: group:has(> sphere) checks direct children, cube:has(+ sphere) checks the next sibling, and cube:has(~ sphere:hover) reacts to a later sphere. These can be chained, as in cube:has(+ group > sphere). Without a leading sibling combinator, :has() goes on a group: an object holds nothing, so cube:has(sphere) is an error. Empty groups can match. A :has() cannot hold another one. As before, a list mixing a static match with :hover still waits for a hover in GSS.",
    examples: [
      {
        name: "selector-has",
        code: "@scene { group#a { sphere#sa; cube#ca; } group#b { cube#cb; } } #a { translate: 1 0 0; } #b { translate: -1 0 0; } sphere { translate: 0 1.4 0; radius: 0.3; } cube { translate: 0 0.5 0; color: #e6e6e6; } group:has(sphere) cube { color: #3a7bff; }",
      },
      {
        name: "selector-has",
        code: "@scene { cube; sphere; } cube { translate: 0.8 0.5 0; transition: 0.3s ease-out; } sphere { translate: -0.8 0.5 0; radius: 0.4; } cube:has(+ sphere:hover) { color: #ff5a36; scale: 1.2; }",
      },
      {
        name: "selector-has",
        code: "@scene { group#lamp { sphere#bulb; cylinder#stand; } } #bulb { translate: 0 1.6 0; radius: 0.35; color: #e6e6e6; } #stand { translate: 0 0.6 0; radius: 0.08; height: 1.2; color: #888888; transition: 0.3s ease-out; } #lamp:has(#bulb:hover) #stand { color: #ff5a36; scale: 1.2; }",
      },
    ],
  },
  {
    name: ":not()",
    anchor: "selector-not",
    specificity: "its most specific selector, added to the rest, like CSS",
    description:
      "A pseudo-class, like CSS: the object matches when none of the selectors in the parentheses does. cube:not(.red) is every cube without the class red; :not(.red, torus) leaves out both. Any selector works inside, read from the object outwards like the rest: cube:not(#g cube) is every cube outside the group #g, cube:not(:first-child, :last-child) the cubes in the middle, group:not(:has(sphere)) the groups without a sphere. Several :not() can follow each other: :not(.a):not(.b). It weighs like the most specific selector of its list, like CSS: cube:not(#hero) beats #hero alone. It is read once, when the scene is compiled: :hover cannot go inside it yet, nor a face.",
    examples: [
      {
        name: "every cube but the red ones",
        code: "@scene { cube.red; cube * 3; cube.red; } cube { size: 0.6; translate: calc((sibling-index() - 3) * -0.9) 0.3 0; } .red { color: #ff5a36; } cube:not(.red) { color: #e6e6e6; translate: calc((sibling-index() - 3) * -0.9) 0.8 0; }",
      },
      {
        name: "the ones in the middle",
        code: "@scene { sphere * 6; } sphere { radius: 0.3; translate: calc((sibling-index() - 3.5) * -0.75) 0.4 0; color: #e6e6e6; } sphere:not(:first-child, :last-child) { color: #3a7bff; }",
      },
    ],
  },
  {
    name: ":nth-child(), :nth-last-child()",
    anchor: "selector-nth-child",
    specificity: "100, like a class, plus the most specific selector after of",
    description:
      "A pseudo-class, like CSS: the object's position among its siblings, the elements of the same @scene block or group, counted from 1. It takes An+B: a number (:nth-child(3)), odd, even, or a formula where n runs from 0 up: 2n+1 is 1, 3, 5…, 3n is every third, -n+3 is the first three. Each copy of a * n is a sibling of its own, so in @scene { cube * 4; sphere; }, cube:nth-child(odd) is cubes 1 and 3, and the sphere is child 5; that is also what sibling-index() counts. Groups count as siblings, and the count starts again inside each group. :nth-last-child() counts from the end: :nth-last-child(-n+2) is the last two. With of, only the siblings that match the selector list count, and the object must match it: :nth-child(2 of .red) is the second .red. The position is read once, when the scene is compiled: of cannot hold :hover yet.",
    examples: [
      {
        name: "odd, and every third",
        code: "@scene { cube * 7; } cube { size: 0.6; translate: calc((sibling-index() - 4) * -0.8) 0.3 0; color: #e6e6e6; } cube:nth-child(odd) { color: #ff5a36; } cube:nth-child(3n) { translate: calc((sibling-index() - 4) * -0.8) 1 0; }",
      },
      {
        name: "even of .lit, and the last child",
        code: "@scene { sphere.lit * 3; sphere * 2; sphere.lit * 3; } sphere { radius: 0.3; translate: calc((sibling-index() - 4.5) * -0.75) 0.4 0; color: #555555; } .lit { color: #e6e6e6; } :nth-child(even of .lit) { color: #3a7bff; } :nth-last-child(1) { scale: 1.3; }",
      },
    ],
  },
  {
    name: ":nth-of-type(), :nth-last-of-type()",
    anchor: "selector-nth-of-type",
    specificity: "100, like a class",
    description:
      "Like :nth-child(), counting only the siblings of the same shape: in @scene { cube * 2; sphere; cube; }, cube:nth-of-type(3) is the last cube, though it is the fourth child. The type is the shape name (cube, sphere, group…), like the tag of an HTML element. It takes the same An+B, but no of.",
    examples: [
      {
        name: "even cubes, last sphere",
        code: "@scene { cube * 2; sphere; cube * 2; sphere; } * { translate: calc((sibling-index() - 3.5) * -0.9) 0.4 0; color: #e6e6e6; } cube { size: 0.6; } sphere { radius: 0.35; } cube:nth-of-type(even) { color: #ff5a36; } sphere:nth-last-of-type(1) { color: #3a7bff; }",
      },
    ],
  },
  {
    name: ":first-child, :last-child, :only-child, :first-of-type, :last-of-type, :only-of-type",
    anchor: "selector-first-child",
    specificity: "100, like a class",
    description:
      "Shortcuts, like CSS: :first-child is :nth-child(1), :last-child is :nth-last-child(1), and :only-child is an object without siblings. The -of-type versions count only the siblings of the same shape: cube:first-of-type is the first cube of its block, even after a sphere. They take no argument. They read the order of @scene, not the position in 3D.",
    examples: [
      {
        name: "first and last child",
        code: "@scene { cube * 5; } cube { size: 0.6; translate: calc((sibling-index() - 3) * -0.9) 0.3 0; color: #e6e6e6; } cube:first-child { color: #ff5a36; } cube:last-child { color: #3a7bff; }",
      },
      {
        name: "first of type, only child",
        code: "@scene { group#a { sphere; cube * 2; } group#b { cube; } } #a { translate: 1 0 0; } #b { translate: -1.4 0 0; } * { color: #e6e6e6; } sphere { translate: 0 1.2 0; radius: 0.3; } cube { size: 0.5; translate: calc(0.9 - sibling-index() * 0.6) 0.25 0; } cube:first-of-type { color: #ff5a36; } cube:only-child { color: #3a7bff; }",
      },
    ],
  },
  {
    name: "!important",
    anchor: "selector-important",
    specificity: "Beats every declaration without it",
    description:
      "Written after a value, it makes the declaration win against every normal one, whatever their selectors. Between two !important declarations, specificity decides again. The cascade picks one value and never combines them: * { scale: 0.5 !important; } gives every object a scale of 0.5, it does not halve their own.",
    examples: [
      {
        name: "selector-important",
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
      "A box with slightly rounded edges, centered on its origin: 1 × 1 × 1 by default.",
    examples: [
      {
        name: "cube",
        code: "@scene { cube; } cube { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "sphere",
    description:
      "A ball centered on its origin, with a radius of 0.5 by default.",
    examples: [
      {
        name: "sphere",
        code: "@scene { sphere; } sphere { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "torus",
    description:
      "A ring lying flat around the y axis: a radius of 1 to the center of its tube, and a tube of 0.28 by default.",
    examples: [
      {
        name: "torus",
        code: "@scene { torus; } torus { translate: 0 0.28 0; }",
      },
    ],
  },
  {
    name: "cylinder",
    description:
      "A cylinder standing on the y axis, centered on its origin: a radius of 0.5 and a height of 1 by default.",
    examples: [
      {
        name: "cylinder",
        code: "@scene { cylinder; } cylinder { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "cone",
    description:
      "A cone standing on the y axis, centered on its origin, pointing up: a radius of 0.5 and a height of 1 by default. A second radius makes a truncated cone.",
    examples: [
      {
        name: "cone",
        code: "@scene { cone; } cone { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "capsule",
    description:
      "A cylinder with round ends, standing on the y axis and centered on its origin. Its height counts the round ends: a radius of 0.25 and a height of 1 by default.",
    examples: [
      {
        name: "capsule",
        code: "@scene { capsule; } capsule { translate: 0 0.5 0; }",
      },
    ],
  },
  {
    name: "path",
    description:
      "A tube with round ends that follows an SVG path. It needs a d; stroke-width and view-box work like in SVG.",
    examples: [
      {
        name: "path",
        code: '@scene { path; } path { translate: 0 1 0; d: path("M-1 0.5 C-1 -1 1 -1 1 0.5"); stroke-width: 0.25; color: #ff5a36; }',
      },
    ],
  },
  {
    name: "plane",
    description:
      "A thin, flat rectangle lying in the xz plane, centered on its origin: 1 × 1 by default. size sets its width and depth, rotate-x: 90deg stands it up like a wall.",
    examples: [
      {
        name: "plane",
        code: "@scene { plane; } plane { translate: 0 0.01 0; size: 3 2; color: #3ad16b; }",
      },
    ],
  },
  {
    name: "prism",
    description:
      "A contour, filled, then given a depth: a star, a letter, an arrow, a logo. The contour is a polygon() or a path() (see d); a path can hold several contours, and one inside another is a hole. It stands in the xy plane, facing the camera, and is centered on its contours (or its view-box), like a path.",
    examples: [
      {
        name: "prism",
        code: "@scene { prism; } prism { translate: 0 1 0; d: polygon(0 -1, -0.25 -0.34, -0.95 -0.31, -0.4 0.13, -0.59 0.81, 0 0.42, 0.59 0.81, 0.4 0.13, 0.95 -0.31, 0.25 -0.34); depth: 0.3; material: gold; }",
      },
      {
        name: "prism",
        code: '@scene { prism; } prism { translate: 0 1 0; d: path("M-1 -1 H1 V1 H-1 Z M0 -0.6 A0.6 0.6 0 1 1 0 0.6 A0.6 0.6 0 1 1 0 -0.6 Z"); depth: 0.4; color: #ff5a36; }',
      },
    ],
  },
  {
    name: "group",
    description:
      "Not a shape: it holds objects and other groups, like <g> in SVG, and draws nothing itself. Its translate, rotations and scale apply to everything inside it, and the positions of its children become relative to it: move the group, everything follows. Other properties (color, material, size…) are not passed down to its children; to style them, use a descendant selector: #letters cube.",
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
        name: "group",
        code: "@scene { group#letters { cube#l; cube#u; cube#c; } } #letters { translate: 1 0.5 0; rotate-y: -20deg; } #letters cube { size: 0.3 1 0.3; color: #ff5a36; } #u { translate: -1 0 0; } #c { translate: -2 0 0; }",
      },
      {
        name: "group",
        code: "@scene { group#spin { sphere#a; sphere#b; } } #spin { translate: 0 0.6 0; animation: turn 4s linear; } #a { translate: 0.8 0 0; radius: 0.4; } #b { translate: -0.8 0 0; radius: 0.4; } @keyframes turn { to { rotate-y: -1turn; } }",
      },
    ],
  },
  {
    name: "light",
    description:
      "Not a shape: a point of light, which draws nothing. Its color is the color of its light (white by default), and intensity how much light it gives: what a surface facing it receives at 1 unit, then less with the square of the distance. It is placed like an object: translate, the groups it is in, animations, :hover through its group, a motion path, and rotations around a transform-origin (numbers only, since a light has no size). Several lights add up, on top of the sun of the scene (light on the scene, which none turns off) and its ambient light; a scene has 8 lights at most. A light is never drawn: to see the bulb, put a shape at its place; and since it is not drawn, it cannot be hovered or pressed itself: hover an object, like #lamp:hover light. Objects cast no shadow: the light goes through them.",
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
        code: "@scene { light#bulb; sphere; } scene { light: none; ambient: 0.05; } #bulb { translate: 0.9 1.6 0.9; color: #ffd27a; intensity: 2; } sphere { translate: 0 0.6 0; radius: 0.6; }",
      },
      {
        name: "colored lights",
        code: "@scene { light#warm; light#cold; cube; } scene { light: none; ambient: 0.05; } #warm { translate: -1.4 1.4 1; color: #ff5a36; intensity: 3; } #cold { translate: 1.4 1.4 1; color: #3a7bff; intensity: 3; } cube { translate: 0 0.5 0; color: #ffffff; }",
      },
      {
        name: "a light that moves",
        code: "@scene { light#firefly; sphere; } scene { light: none; ambient: 0.05; } #firefly { translate: 1.2 0.8 0; transform-origin: -1.2 0 0; color: #b6ff6b; intensity: 1.5; animation: circle 4s linear; } sphere { translate: 0 0.6 0; radius: 0.5; } @keyframes circle { to { rotate-y: 1turn; } }",
      },
      {
        name: "a lamp to hover",
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
      "An easing curve, like CSS, for animation and transition. The curve goes from (0, 0) to (1, 1), pulled by two handles: x is the time and stays from 0 to 1, y is the progress and can go below 0 or above 1, to overshoot and come back. The keywords are shortcuts for it: ease is cubic-bezier(0.25, 0.1, 0.25, 1), ease-in is cubic-bezier(0.42, 0, 1, 1), ease-out is cubic-bezier(0, 0, 0.58, 1) and ease-in-out is cubic-bezier(0.42, 0, 0.58, 1).",
    examples: [
      {
        name: "cubic-bezier()",
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
      "An easing drawn as straight segments, like CSS: each number is the progress at one moment, and the moment is a percentage of the duration. A missing moment is spread evenly between its neighbours; the first point starts at 0% and the last one ends at 100%. Two percentages on one number hold it still between them; two points at the same moment jump. With enough points, it draws bounces and springs. The linear keyword is linear(0, 1): a constant speed.",
    examples: [
      {
        name: "linear()",
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
      "An easing that moves by equal jumps instead of gliding, like CSS: steps(4) holds still, then jumps, four times. The position says where the jumps are: jump-end (the default, also written end) jumps at the end of each step, so the last value is only reached at the very end; jump-start (start) jumps at the start of each step; jump-both adds a jump at both ends; jump-none keeps the first and the last values for a whole step each. step-start and step-end are steps(1, jump-start) and steps(1, jump-end). Good for ticking hands, sprite-like motion and anything mechanical.",
    examples: [
      {
        name: "steps()",
        code: "@scene { cube; } cube { size: 1.2 0.15 0.15; translate: 0 0.6 0; color: #ff5a36; animation: tick 6s steps(12); } @keyframes tick { from { rotate-y: 0deg; } to { rotate-y: -360deg; } }",
      },
      {
        name: "step-start and step-end",
        code: "@scene { sphere#a; sphere#b; } sphere { radius: 0.4; } #a { translate: 0.8 0.5 0; color: #3a7bff; animation: blink 1s step-start; } #b { translate: -0.8 0.5 0; color: #3ad16b; animation: blink 1s step-end; } @keyframes blink { 50% { scale: 1.6; } }",
      },
    ],
  },
  {
    name: "linear-gradient(), radial-gradient(), conic-gradient()",
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
      "Gradients, like CSS, for the background of the scene, the color of an object and the color of a material. In the background, the gradient covers the canvas and follows its size; reflections and glass see it in the direction they look. On an object, it covers the object seen from the front, from left to right and from bottom to top (a plane is seen from above): to top goes from its bottom to its top, whatever its size, and it turns and moves with it. linear-gradient() goes to bottom by default; it takes an angle (0deg up, 90deg right) or to a side or a corner. radial-gradient() is an ellipse reaching the farthest corner from the center by default; it takes circle or ellipse, a size keyword and a position (at 30% 40%, at top). conic-gradient() turns around a center, clockwise from the top: from 90deg starts it a quarter turn later, at 30% 40% moves the center, and its colors can be placed with angles as well as percentages (a full turn is 100%), for a color wheel, a pie chart or the sweep of a watch hand. Each color can have one or two positions; the missing ones are spread like CSS, and two colors at the same place make a hard edge. repeating-linear-gradient(), repeating-radial-gradient() and repeating-conic-gradient() repeat the stops. Colors are mixed in sRGB, like CSS with hex colors.",
    examples: [
      {
        name: "linear-gradient()",
        code: "@scene { cube; } cube { translate: 0 0.5 0; color: #f4f1ea; } scene { floor: none; background: linear-gradient(to top right, #ff5a36, #3a7bff); }",
      },
      {
        name: "radial-gradient()",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: glass; } scene { floor: none; background: radial-gradient(circle closest-side, #ffd27a, #ff5a36 60%, #1a0f2e); }",
      },
      {
        name: "linear-gradient() on objects",
        code: "@scene { cylinder; sphere; cube; } cylinder { radius: 0.4; height: 2; translate: 1.4 1 0; color: linear-gradient(#ff5a36, #ffd27a); } sphere { radius: 0.7; translate: 0 0.7 0; material: metal(radial-gradient(circle at 35% 65%, #ffffff, #3a7bff 40%, #10183a), 0.15); } cube { size: 1; translate: -1.4 0.5 0; rotate-y: -30deg; color: repeating-linear-gradient(45deg, #3ad16b 0% 10%, #f4f1ea 10% 20%); }",
      },
      {
        name: "conic-gradient()",
        code: "@scene { cube#dial; sphere; } #dial { size: 2 2 0.1; corner-radius: 0.05; translate: 0.4 1.2 0; color: conic-gradient(#ff5a36, #ffd27a, #3ad16b, #3a7bff, #b15aff, #ff5a36); } sphere { radius: 0.5; translate: -1.4 0.5 0.6; material: metal(repeating-conic-gradient(from 45deg, #f4f1ea 0deg 30deg, #111111 30deg 60deg), 0.3); } scene { floor: none; background: conic-gradient(from 180deg at 50% 0%, #1c1c24, #2a2a3a, #1c1c24); }",
      },
      {
        name: "repeating-linear-gradient() and repeating-radial-gradient()",
        code: "@scene { sphere#a; sphere#b; } sphere { radius: 0.6; translate: 0 1 0; material: chrome; } #a { translate: 0.8 1 0; } #b { translate: -0.8 1 0; } scene { floor: none; background: repeating-linear-gradient(45deg, #111 0% 5%, #2a2a3a 5% 10%); }",
      },
    ],
  },
  {
    name: "noise()",
    anchor: "fn-noise",
    covers: ["noise"],
    computed: "on the GPU, at each pixel",
    syntax:
      "noise([turbulence]? <number> <integer>? [seed <integer>]? [at <number> <number> <number>]?, <color> <percentage>{0,2}, …)",
    description:
      "A noise image, wherever a gradient goes: the background of the scene, the color of an object, the color of a material. Its colors are placed like the stops of a gradient, at the value of a smooth 3D noise, like SVG feTurbulence: noise(4 3, #1a1d2b, #3a7bff 60%, #ffffff). The first number is the scale: how many patterns fit in one unit. The second, if any, is the number of octaves, from 1 to 8: each one adds detail twice as fine, like numOctaves. turbulence makes sharp creases instead of soft clouds (marble, fire, lightning); seed draws another pattern; at <x> <y> <z> moves it. On an object, the noise is cut in the object's own space, like a block of stone: no seam, and it turns and moves with the object. In the background, it follows the direction of the view. Like a gradient, it can be animated and changed by :hover, into another noise() of the same kind, with as many colors: animating at makes it drift, like clouds or smoke. Its numbers can be set from JavaScript.",
    examples: [
      {
        name: "noise() on an object",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: noise(3 4, #1a1d2b, #3a7bff 55%, #ffffff); }",
      },
      {
        name: "turbulence: marble",
        code: "@scene { cube; } cube { translate: 0 0.6 0; size: 1.2; corner-radius: 0.06; color: noise(turbulence 1.2 5, #4a4f5a, #f4f1ea 30%); }",
      },
      {
        name: "a sky that drifts",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: noise(2 4, #2f6bd8 40%, #ffffff 75%); animation: wind 20s linear infinite; } @keyframes wind { to { background: noise(2 4 at 1 0 0, #2f6bd8 40%, #ffffff 75%); } }",
      },
      {
        name: "noise() in a material",
        code: "@scene { torus; } torus { translate: 0 0.6 0; rotate-x: 70deg; material: metal(noise(turbulence 6 3, #6b4a2b, #d4af37), 0.25); }",
      },
    ],
  },
  {
    name: "displace()",
    anchor: "fn-displace",
    covers: ["displace"],
    computed: "on the GPU, at each pixel",
    syntax: "displace(<gradient> | <noise()>, <gradient> | <noise()>, <number> | <percentage>)",
    description:
      "Moves an image by another one, like SVG feDisplacementMap, wherever a gradient goes: the color of an object or of a material, the background and its layers, mask-image. The image is a gradient or a noise(). The map, usually a noise(), is read at each point, and its colors move the point where the image is read: on a gradient, red moves it to the right and green down, like SVG with the red and green channels; on a noise(), red, green and blue move it in 3D. A channel at 50% moves nothing, 0% and 100% move it the most, half the amount each way. The amount is a share of the size of the image: 0.3 or 30% moves it by up to 15% of its size. A noise() map gives each of its channels a noise of its own, like feTurbulence, so even a gray noise moves the image in every direction; a gradient map is read once, by its colors. Stripes moved by a turbulence make marble, rings make wood, a mask gets ragged edges. Like a gradient, it can be animated and changed by :hover, into another displace() whose image and map are of the same kinds: its amount and the numbers of its image and of its map move, and animating the at of a noise() map makes the image flow. They can be set from JavaScript too. The colors of the map are opaque.",
    examples: [
      {
        name: "marble",
        code: "@scene { cube; } cube { translate: 0 0.6 0; size: 1.2; corner-radius: 0.06; color: displace(repeating-linear-gradient(45deg, #f4f1ea 0% 9%, #9a9385 10%, #f4f1ea 11%), noise(turbulence 1 4, black, white), 0.35); }",
      },
      {
        name: "a ragged hole, in mask-image",
        code: "@scene { sphere; } sphere { translate: 0 1 0; radius: 0.8; color: #ff5a36; mask-image: displace(radial-gradient(circle, transparent 30%, black 31%), noise(4 3, black, white), 0.15); }",
      },
      {
        name: "water that flows",
        code: "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: none; background: displace(repeating-linear-gradient(#123a6b 0% 3%, #3a7bff 5% 8%), noise(2 3, black, white), 0.1); animation: flow 10s linear infinite; } @keyframes flow { to { background: displace(repeating-linear-gradient(#123a6b 0% 3%, #3a7bff 5% 8%), noise(2 3 at 0 1 0, black, white), 0.1); } }",
      },
    ],
  },
  {
    name: "element()",
    anchor: "fn-element",
    covers: [],
    syntax: "element(<id>)",
    computed: "by the browser, each time the element changes",
    description:
      "A live image of an HTML element of the page, like CSS element(), for texture. The browser draws the element itself, with the page's CSS and fonts, and the object shows it again each time the element changes: a card, a form, a chart, any web interface on a 3D surface. Put the element inside the scene: inside <gss-scene>, next to its script, or inside the canvas given to mount(). It stays in the page, so screen readers still read it, but it is only seen on the object. One image covers each face of the object, like any texture: give the element the proportions of the face, and use ::face(front) for one face only. This needs a browser that draws HTML in a canvas, Chromium for now; elsewhere, the object keeps its color. A scene with an element is drawn with WebGL2.",
    examples: [
      {
        name: "an HTML card",
        code: "@scene { cube; } scene { floor: none; camera-angle: -20deg 10deg; camera-target: 0 0.8 0; camera-distance: 3.2; ambient: 0.55; } cube { translate: 0 0.8 0; size: 1.6 1 0.06; corner-radius: 0.03; animation: sway 6s ease-in-out infinite alternate; } cube::face(front) { texture: element(#card); } @keyframes sway { to { rotate-y: 25deg; } }",
        html: "<article id=\"card\" style=\"\n  width: 320px; height: 200px; padding: 28px;\n  box-sizing: border-box; border-radius: 18px;\n  background: #f4f1ea; color: #1a1d2b;\n  font: 600 30px/1.2 system-ui, sans-serif;\">\n  Hello from <em style=\"color: #ff5a36;\">HTML</em>, on a 3D card\n</article>",
      },
    ],
  },
  {
    name: "rgb()",
    anchor: "fn-rgb",
    covers: ["rgb", "rgba"],
    syntax: "rgb(<red> <green> <blue>) | rgb(<red>, <green>, <blue>)",
    description:
      "A color from its red, green and blue channels, like CSS: numbers from 0 to 255, or percentages (100% is 255). Both syntaxes work, with spaces or with commas, and rgba() is the same function. Values outside the range are clamped. An alpha (rgb(255 0 0 / 50%)) makes the color transparent, which only the layers of background and mask-image take: anywhere else, it is an error. The math works inside, so one rule can give every copy its own color. It is turned into a hex color by the compiler, wherever a color is expected: color, floor, background, and the first argument of a material.",
    examples: [
      {
        name: "rgb()",
        code: "@scene { sphere; } sphere { color: rgb(255 90 54); }",
      },
      {
        name: "rgb()",
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
      "A color from its hue, saturation and lightness, like CSS. The hue is an angle on the color wheel (0 red, 120 green, 240 blue), as a number of degrees or in deg, rad or turn, and it goes round: -120 is 240. Saturation and lightness are percentages (or numbers, 100 meaning 100%); 50% lightness gives the pure color. With sibling-index(), the hue spreads a rainbow over the copies of an object. Commas, hsla() and the alpha work as in rgb().",
    examples: [
      {
        name: "hsl()",
        code: "@scene { sphere; } sphere { color: hsl(20 100% 60%); }",
      },
      {
        name: "hsl()",
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
      "A color from a hue, and how much white and black are mixed into it, like CSS: hwb(0 0% 0%) is the pure red, more whiteness makes it paler, more blackness darker. When whiteness and blackness add up to 100% or more, the color is a gray. The hue works as in hsl().",
    examples: [
      {
        name: "hwb()",
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
      "The CIE Lab color space of CSS, built on how the eye sees: the lightness goes from 0 (black) to 100 (white), a from green to red, b from blue to yellow. lch() is the same space written with a chroma (how colorful) and a hue. Percentages work as in CSS: 100% is 100 for the lightness, 125 for a and b, 150 for the chroma. A color outside what the screen shows is clipped to it.",
    examples: [
      {
        name: "lab()",
        code: "@scene { sphere; } sphere { color: lab(62 52 48); }",
      },
      {
        name: "lch()",
        code: "@scene { sphere.dot * 6; } .dot { radius: 0.3; translate: calc(2.6 - sibling-index() * 0.75) 0.5 0; color: lch(65 60 calc(sibling-index() * 60)); }",
      },
      {
        name: "lab() and lch() together",
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
      "The OKLab color space of CSS: its lightness matches what the eye sees much better than hsl(), so colors of the same lightness look equally light, whatever their hue. The lightness goes from 0 to 1 (or 0% to 100%); oklch() adds a chroma, around 0 to 0.4 (100% is 0.4), and a hue. With sibling-index() on the hue, oklch() gives a rainbow whose colors all look as light as each other. A color outside what the screen shows is clipped to it.",
    examples: [
      {
        name: "oklab()",
        code: "@scene { sphere; } sphere { color: oklab(0.72 0.12 0.1); }",
      },
      {
        name: "oklch()",
        code: "@scene { sphere.dot * 8; } .dot { radius: 0.25; translate: calc(2.7 - sibling-index() * 0.6) 0.5 0; color: oklch(72% 0.15 calc(sibling-index() * 45)); }",
      },
      {
        name: "oklab() and oklch() together",
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
      "A color in a named color space, like CSS: srgb, srgb-linear, display-p3, xyz (or xyz-d65) and xyz-d50, with three channels from 0 to 1, or percentages. A display-p3 color that the sRGB render cannot show is clipped to it.",
    examples: [
      {
        name: "color()",
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
      "Mixes two colors in a color space, like CSS: srgb, srgb-linear, lab, lch, oklab, oklch, hsl or hwb. Without percentages, half of each; with one, the other color takes the rest; with both, they are scaled to add up to 100%. Like CSS, when they add up to less than 100%, the color becomes transparent, which only the layers of background and mask-image take: anywhere else, it is an error; a percentage set from JavaScript (a variable registered with @property) is only known when the scene runs, so there it is kept between 0% and 100%, and percentages that add up to less are scaled up to 100% instead of being an error. In a space with a hue, the hue goes the shorter way round the wheel, or the longer one with longer hue; a gray takes the hue of the other color. oklab gives the most even mixes; mixing in srgb goes through duller middle colors.",
    examples: [
      {
        name: "color-mix()",
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
      "The first color when the page is in light mode, the second in dark mode, like CSS. The scene follows the setting of the system as it changes: it works like @media (prefers-color-scheme: dark), and counts as one of the @media queries of the scene.",
    examples: [
      {
        name: "light-dark()",
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
        name: "contrast-color()",
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
      "A keyword, like CSS: the object's own color, wherever a color is expected. color-mix(in oklab, currentColor 60%, white) is a lighter version of whatever color the object has, so one rule can tint many objects of different colors. As a material's color, metal(currentColor, 0.2) is the same as metal(0.2): the material follows the color, animated, changed on :hover, or a gradient. It also works in the stops of a gradient, in light-dark() and in a variable, where it is read with the color of the object that uses the variable. An object without color uses the initial #e6e6e6. Like CSS, it is written currentColor or currentcolor. color: currentColor is an error, since GSS does not inherit color from a group, and the scene has no color for currentColor to read.",
    examples: [
      {
        name: "a lighter shell for every color",
        code: "@scene { sphere * 3; } sphere { radius: 0.4; translate: calc((sibling-index() - 2) * -1.1) 0.5 0; material: jelly(color-mix(in oklab, currentColor 55%, white), 0.4); } sphere:nth-child(1) { color: #ff5a36; } sphere:nth-child(2) { color: #3ad16b; } sphere:nth-child(3) { color: #3a7bff; }",
      },
      {
        name: "in a variable",
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
      "Reads a custom property, like CSS. A property whose name starts with -- is a variable: it can be declared on the scene (like :root), on a group or on an object, and it is inherited from the scene, then from each group, down to the object: the closest one wins. var(--name, fallback) uses the fallback when the variable is not defined; without a fallback, a missing variable is an error, so a typo is never ignored. A variable can hold several values (translate: var(--pos)), use another variable (--big: calc(var(--size) * 2)), and be used inside calc(). A @keyframes frame can set a variable: every animatable property that uses it moves with it. Like everything in GSS, variables are replaced by the compiler: the shader only receives numbers.",
    examples: [
      {
        name: "var()",
        code: "@scene { sphere#a; sphere#b; } scene { --accent: #ff5a36; --r: 0.4; } sphere { radius: var(--r); color: var(--accent); } #a { translate: 0.8 0.5 0; } #b { --r: 0.6; translate: -0.8 0.6 0; }",
      },
      {
        name: "var()",
        code: "@scene { group#tree { cone.level * 5; } } #tree { --green: #3ad16b; } .level { --size: calc(sibling-index() * 0.12); radius: var(--size); height: var(--size); translate: 0 calc(1.3 - sibling-index() * 0.18) 0; color: var(--green); }",
      },
      {
        name: "var()",
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
      "A random value between a minimum and a maximum, like CSS: random(0.2, 1.4), random(0deg, 360deg). With a step, one of min, min + step, … up to max: random(0deg, 180deg, 45deg). The value is chosen once, when the scene compiles, and stays the same at every reload: each object, property and call gets its own, so a multiplied object scatters its copies with one rule. A --name shares one value between the calls of an object that use it (the same random number for x and z); element-shared gives every object the same value; fixed 0.25 sets the random number yourself, from 0 to just below 1. The values must share a unit.",
    examples: [
      {
        name: "random()",
        code: "@scene { sphere.star * 30; } .star { radius: random(0.05, 0.2); translate: random(-2.5, 2.5) random(0.3, 2.2) random(-2, 1); color: hsl(random(180, 260) 80% 70%); }",
      },
      {
        name: "random() with a step and --name",
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
      "Picks a value by condition, like CSS: the first branch whose condition is true gives its value. A condition is media(<query>), true when the screen matches the query, like @media; style(--x), true when the custom property is set on the object (or inherited), and style(--x: <value>), when it has that value; or else, always true. not, and, or combine them (and and or cannot be mixed without parentheses). If no branch is true the value is an error, so end with else. A media() query makes a version of the scene for it, like @media, and counts as one of its queries.",
    examples: [
      {
        name: "if() with style()",
        code: "@scene { group#warm { sphere * 3 } group#cool { sphere * 3 } } #warm { --theme: warm; translate: 1 0 0; } #cool { --theme: cool; translate: -1 0 0; } sphere { radius: 0.3; translate: 0 calc(sibling-index() * 0.7) 0; color: if(style(--theme: warm): #ff5a36; else: #3a7bff); }",
      },
      {
        name: "if() with media()",
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
      "Computes a value, like CSS calc(): + - * / and parentheses, with numbers, angles (deg, rad, turn) and durations (s, ms). Like in CSS, + and - need a space on each side. Everything is computed by the compiler, once per object: the shader only receives the result, so math costs nothing on the GPU. calc() and the other math functions work in any value, even inside another function: metal(#fff, calc(0.1 * 2)).",
    examples: [
      {
        name: "calc()",
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
      "The position of the object among its siblings, from 1, like the CSS function of the same name: cube * 12 gives 12 siblings numbered 1 to 12. Siblings are the objects of the same @scene block or of the same group; a group is a sibling too, and inside a group the count starts again. With calc(), one rule gives every copy of a multiplied object its own place, angle or size: no loop needed. It has no meaning in scene { } or in @keyframes, shared by every object.",
    examples: [
      {
        name: "sibling-index()",
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
      "How many siblings the object has, itself included, like the CSS function of the same name. Divided into a full turn, it spreads objects evenly whatever their number: change * 8 into * 20, the ring follows.",
    examples: [
      {
        name: "sibling-count()",
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
      "The trigonometric functions of CSS: they take an angle (deg, rad, turn), or a number of radians, and return a number. cos() and sin() of the same angle give a point on a circle: the way to place objects in a ring, a spiral or a wave. pi is also known: cos(pi) is -1.",
    examples: [
      {
        name: "sin()",
        code: "@scene { sphere.wave * 9; } .wave { radius: 0.18; translate: calc(2 - sibling-index() * 0.4) calc(0.8 + sin(sibling-index() * 40deg) * 0.5) 0; color: #7cb4ff; }",
      },
      {
        name: "cos()",
        code: "@scene { cube.col * 9; } .col { --h: calc(0.9 + cos(sibling-index() * 40deg) * 0.6); size: 0.25 var(--h) 0.25; translate: calc(2 - sibling-index() * 0.4) calc(var(--h) / 2) 0; color: #ff5a36; }",
      },
      {
        name: "tan()",
        code: "@scene { cube.step * 7; } .step { --h: calc(tan(sibling-index() * 10deg) * 1.2); size: 0.35 var(--h) 0.35; translate: calc(2 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #3ad16b; }",
      },
      {
        name: "sin(), cos() and tan() together",
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
      "The smallest or the largest of their values, or a value kept between two bounds, like in CSS. The values must share a unit: max(10deg, 20deg), not max(10deg, 2).",
    examples: [
      {
        name: "min()",
        code: "@scene { cube.bar * 6; } .bar { --h: min(sibling-index() * 0.35, 1.2); size: 0.3 var(--h) 0.3; translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #ff5a36; }",
      },
      {
        name: "max()",
        code: "@scene { cube.bar * 6; } .bar { --h: max(0.6, sibling-index() * 0.3); size: 0.3 var(--h) 0.3; translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #3a7bff; }",
      },
      {
        name: "clamp()",
        code: "@scene { cube.bar * 6; } .bar { --h: clamp(0.5, sibling-index() * 0.35, 1.4); size: 0.3 var(--h) 0.3; translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0; color: #3ad16b; }",
      },
      {
        name: "min(), max() and clamp() together",
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
      "abs() drops the sign, sqrt() is the square root, pow(a, b) is a to the power b, like in CSS. pow() grows fast: good for sizes that double.",
    examples: [
      {
        name: "abs()",
        code: "@scene { cube.v * 9; } .v { --h: calc(0.3 + abs(sibling-index() - 5) * 0.25); size: 0.3 var(--h) 0.3; translate: calc(2.25 - sibling-index() * 0.45) calc(var(--h) / 2) 0; color: #7cb4ff; }",
      },
      {
        name: "sqrt()",
        code: "@scene { sphere.dot * 6; } .dot { --r: calc(sqrt(sibling-index()) * 0.15); radius: var(--r); translate: calc(2.45 - sibling-index() * 0.7) var(--r) 0; color: #3ad16b; }",
      },
      {
        name: "pow()",
        code: "@scene { sphere.dot * 5; } .dot { radius: calc(pow(1.4, sibling-index()) * 0.08); translate: calc(2.4 - sibling-index() * 0.8) 0.6 0; color: #ff5a36; }",
      },
      {
        name: "abs(), sqrt() and pow() together",
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
      "The inverse trigonometric functions of CSS: they take a number and return an angle, in deg. atan2(y, x) gives the angle of the point (x, y), whatever its quarter: the way to turn an object toward a point. Its two values must share a unit.",
    examples: [
      {
        name: "asin()",
        code: "@scene { cube.tilt * 5; } .tilt { size: 0.2 0.9 0.2; translate: calc(1.8 - sibling-index() * 0.6) 0.45 0; rotate-z: asin(calc(0.6 - sibling-index() * 0.2)); color: #ff5a36; }",
      },
      {
        name: "acos()",
        code: "@scene { cube.fan * 5; } .fan { size: 0.9 0.1 0.2; translate: 0 calc(sibling-index() * 0.3) 0; rotate-y: acos(calc(1.2 - sibling-index() * 0.4)); color: #7cb4ff; }",
      },
      {
        name: "atan()",
        code: "@scene { cube.ramp * 5; } .ramp { size: 0.8 0.08 0.3; translate: calc(2.7 - sibling-index() * 0.9) 0.5 0; rotate-z: atan(calc(sibling-index() * -0.4)); color: #3ad16b; }",
      },
      {
        name: "atan2()",
        code: "@scene { cube.needle * 8; } .needle { --a: calc(sibling-index() * 45deg); size: 0.5 0.08 0.08; translate: calc(cos(var(--a)) * -1.4) 0.5 calc(sin(var(--a)) * 1.4); rotate-y: atan2(sin(var(--a)), cos(var(--a))); color: #ff5a36; }",
      },
      {
        name: "asin(), acos(), atan() and atan2() together",
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
      "The stepped functions of CSS. sign() gives -1, 0 or 1. round() snaps a value to a multiple of its step (1 by default): nearest (halfway goes up), up, down or to-zero. mod() and rem() give the rest of a division: mod() takes the sign of the divisor, rem() the sign of the value, so mod(-7, 3) is 2 and rem(-7, 3) is -1. Their values must share a unit: round(37deg, 15deg) is 30deg.",
    examples: [
      {
        name: "sign()",
        code: "@scene { cube.side * 9; } .side { size: 0.3; translate: calc(2.25 - sibling-index() * 0.45) calc(0.6 + sign(sibling-index() - 5) * 0.4) 0; color: #7cb4ff; }",
      },
      {
        name: "round()",
        code: "@scene { cube.stair * 9; } .stair { --h: round(down, calc(sibling-index() * 0.3), 0.5); size: 0.4 calc(var(--h) + 0.1) 0.4; translate: calc(2.25 - sibling-index() * 0.45) calc(var(--h) / 2 + 0.05) 0; color: #ff5a36; }",
      },
      {
        name: "mod()",
        code: "@scene { cube.row * 12; } .row { size: 0.3; translate: calc(0.75 - mod(sibling-index() - 1, 4) * 0.5) 0.15 calc(round(down, calc((sibling-index() - 1) / 4)) * 0.5 - 0.5); color: #3ad16b; }",
      },
      {
        name: "rem()",
        code: "@scene { sphere.ball * 9; } .ball { radius: 0.18; translate: calc(2.25 - sibling-index() * 0.45) calc(0.3 + rem(sibling-index(), 3) * 0.4) 0; color: #ff5a36; }",
      },
      {
        name: "sign(), round(), mod() and rem() together",
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
      "The exponential functions of CSS. hypot() is the length of a vector: hypot(3, 4) is 5, the distance from the center to the point (3, 4). log() is the natural logarithm, or the logarithm in a base: log(8, 2) is 3. exp() is e to a power. e is also known as a constant.",
    examples: [
      {
        name: "hypot()",
        code: "@scene { sphere.dot * 9; } .dot { --x: calc(mod(sibling-index() - 1, 3) - 1); --z: calc(round(down, calc((sibling-index() - 1) / 3)) - 1); radius: calc(0.12 + hypot(var(--x), var(--z)) * 0.1); translate: calc(var(--x) * -0.9) 0.4 calc(var(--z) * 0.9); color: #7cb4ff; }",
      },
      {
        name: "log()",
        code: "@scene { cube.bar * 8; } .bar { --h: calc(0.2 + log(sibling-index(), 2) * 0.4); size: 0.3 var(--h) 0.3; translate: calc(2 - sibling-index() * 0.45) calc(var(--h) / 2) 0; color: #3ad16b; }",
      },
      {
        name: "exp()",
        code: "@scene { sphere.dot * 6; } .dot { radius: calc(exp(sibling-index() / 3) * 0.06); translate: calc(2.45 - sibling-index() * 0.7) 0.6 0; color: #ff5a36; }",
      },
      {
        name: "hypot(), log() and exp() together",
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
      "Where a value sits between a start and an end, as a number from 0 to 1, like the CSS function of the same name: progress(sibling-index(), 1, sibling-count()) goes from 0 for the first copy to 1 for the last. The result is clamped to 0 and 1, and the three values must share a unit.",
    examples: [
      {
        name: "progress()",
        code: "@scene { cube.fade * 8; } .fade { --p: progress(sibling-index(), 1, sibling-count()); size: 0.35 calc(0.2 + var(--p)) 0.35; translate: calc(2.25 - sibling-index() * 0.5) calc(0.1 + var(--p) / 2) 0; color: hsl(calc(200 + var(--p) * 160) 80% 60%); }",
      },
    ],
  },
];
