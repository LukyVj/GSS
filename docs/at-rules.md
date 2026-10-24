<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Language

# At-rules

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#at-rules).

<a name="at-debug-panel"></a>

## `@debug-panel`

Shows the axes, their letters and a grid at the origin over the render, in the playground and in Try it, and a panel with everything known about the scene: where the camera is, what the scene holds, what each pixel costs, and how fast it draws.

**What the property changes in the scene:** `x`, `y`, `z`

- **Syntax:** `@debug-panel { display: open | folded | none; }`
- **See also:** [view](rendering.md#view), [@property-panel](#at-property-panel)

### Descriptors

- **display:** `open`, the default: the panel shows its numbers. `folded`: only its title, `debug`, which opens it; the axes and the grid stay. `none`: nothing, as without the rule.

x in red, y in green, z in blue, each with its letter, one unit apart on the grid, fainter behind the objects. A page that embeds the scene shows neither the panel nor the axes.

The grid lies on the plane where the floor is, out to 10 units from the origin; its lines are light on a dark scene and dark on a light one. The panel gives the backend that draws the scene (WebGL2 or WebGPU), the camera as the `camera-angle` and `camera-distance` that put it where the mouse left it, ready to copy into the code, the objects, the point lights, the images used out of the 16 a scene can take, the variables, the states of `:hover` and `:active`, the scroll timelines, the passes of `filter`, the `@media` queries, the lighter version of `@gpu` and the lines of the shader. With `view: steps`, it reads the render back: the mean and the max of the steps per pixel, and the share of pixels at 150 and over. In the playground, it adds the frames per second, the time of a frame on the GPU and on the CPU, the size of the render in pixels and the time the shader took to build, like the performance panel; while it is open, the scene draws every frame, so that the numbers measure it.

### the axes and the grid

A cube one unit to the right of the origin, along the red axis.

```css
@debug-panel {
  display: open;
}

@scene {
  cube;
}

cube {
  translate: 1 0.5 0;
  size: 0.6;
  color: #ff5a36;
}
```

### folded, on a dark scene

The panel starts folded: its title opens it. The grid turns light on the dark background.

```css
@debug-panel {
  display: folded;
}

@scene {
  sphere;
  torus;
}

scene {
  floor: none;
  background: #0a0a0c;
}

sphere {
  translate: 0 1 0;
  radius: 0.4;
  color: #e8e6e1;
}

torus {
  translate: 0 1 0;
  rotate-x: 90deg;
  color: #ff5a36;
}
```

<a name="at-gpu"></a>

## `@gpu`

Applies rules only when the computer cannot draw the scene fast enough, for a lighter version of it: fewer objects, simpler effects, a smaller value for a variable. CSS has no such rule; GSS writes it like `@media`, and the scene changes the same way.

**How it goes, from where it is written to what the scene shows:** `keeps up`, `slow frames`

- **Syntax:** `@gpu [not] (slow) { <rule> … }`
- **See also:** [@media](#at-media), [dpr](rendering.md#dpr)

### Conditions

- **(slow):** The frames stay slow even at a pixel density of 1, or the browser draws without a graphics card.
- **not (slow):** The computer keeps up: rules for the full version only.

The scene starts in its full version, never drawn under a `dpr` of 1. When the frames stay slow for a second, the lighter version takes its place until the page is closed. Without a graphics card, it starts lighter.

No browser says how busy the graphics card is, so GSS watches its own frames: whatever slows them down, a weak card, another program, heat or a battery saver, the scene follows. The lighter version is ready in advance, like the versions of `@media`: the switch takes a frame or two, and the camera stays where it is. `@gpu` holds rules only, and counts among the 4 conditions of a scene with the `@media` queries; it cannot hold a `@media` or sit in one, for now. On a page, `<gss-scene gpu="slow">` and `mount(canvas, scene, { gpu: "slow" })` show the lighter version from the start. In the playground and in Try it, the gpu menu over the render switches between the two versions.

### fewer objects

On a slow computer, 8 spheres instead of 16, smaller and orange. Pick slow in the gpu menu over the render to see it.

```css
@scene {
  sphere * 16;
}

scene {
  --r: 0.3;
  camera-distance: 7;
}

sphere {
  radius: var(--r);
  translate: calc(sibling-index() * 0.7 - 6) 0.5 0;
  color: #3a7bff;
}

@gpu (slow) {
  scene {
    --r: 0.2;
  }
  sphere {
    color: #ff5a36;
  }
  sphere:nth-child(n + 9) {
    display: none;
  }
}
```

### simpler effects

Soft shadows and glass when the computer keeps up; hard shadows and a plain color on a slow one.

```css
@scene {
  sphere * 3;
}

scene {
  shadows: hard;
}

sphere {
  radius: 0.5;
  translate: calc(sibling-index() * 1.2 - 2.4) 0.5 0;
  color: #3a7bff;
}

@gpu not (slow) {
  scene {
    shadows: soft;
  }
  sphere {
    material: glass(1.5, blurred 0.3);
  }
}
```

<a name="at-keyframes"></a>

## `@keyframes`

Defines the steps of an animation, played by the `animation` property, like CSS.

**A ball between its two frames, and the time that passes:** `from`, `to`, `0%`, `100%`

- **Syntax:** `@keyframes <name> { <offset>[, <offset>]* { <declaration>* } … }`

### Offsets

- **from:** The start: `0%`.
- **to:** The end: `100%`.
- **<percentage>:** A step in between. Several offsets can share a frame: `0%, 100% { … }`.

A missing `0%` or `100%` uses the object's own value, and a frame changes only the properties it declares. A frame takes animatable properties only.

### up and down

Two frames, played forward then backward by `alternate`.

```css
@scene {
  sphere;
}

sphere {
  animation: float 2s ease-in-out alternate;
}

@keyframes float {
  from {
    translate: 0 1 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

### a pulse

`0%` and `100%` share a frame; at `50%`, the cube grows and changes color.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  animation: pulse 1s;
}

@keyframes pulse {
  0%, 100% {
    scale: 1;
  }
  50% {
    scale: 1.3;
    color: #ff5a36;
  }
}
```

<a name="at-media"></a>

## `@media`

Applies rules only when the screen matches a media query, like CSS. When the screen changes, a window resized or the system switching to dark mode, the scene follows at once and the camera stays where it is.

**How it goes, from where it is written to what the scene shows:** `900px wide`, `480px wide`

- **Syntax:** `@media <media-query> { <rule> … }`

### Queries

- **(max-width: 600px):** The width of the viewport; also `min-width`, in `px` or `em`.
- **(orientation: portrait):** Taller than wide; `landscape` otherwise.
- **(prefers-color-scheme: dark):** The dark mode of the system; `light` for the light mode.
- **(prefers-reduced-motion):** The visitor asks for less motion.
- **and, not, ,:** Combine queries, like CSS.

Any media query CSS knows works: the browser reads it. `@media` holds rules only, so `@scene` and `@keyframes` go outside it.

Inside, the rules join the cascade where the `@media` is written, with their usual specificity. A scene can use up to 4 different queries. On a page, the viewport is the window, like CSS. In the playground and in Try it, it is the render, like the result of CodePen: make the render narrower to see a `max-width` query apply.

### a small screen

Under 600px wide, the render is lighter, with `dpr: 1`, and the sphere turns blue.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
}

@media (max-width: 600px) {
  scene {
    dpr: 1;
  }
  sphere {
    color: #3a7bff;
  }
}
```

### less motion

`* { animation: none !important; }` stops every animation for the visitors who ask for less motion.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
  animation: bob 2s ease-in-out alternate;
}

@keyframes bob {
  to {
    translate: 0 1.6 0;
  }
}

@media (prefers-reduced-motion) {
  * {
    animation: none !important;
  }
}
```

### dark mode

The background, the floor and the sphere follow the light or dark mode of the system.

```css
@scene {
  sphere;
}

scene {
  background: #f2efe9;
  floor: #e8e3db;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
}

@media (prefers-color-scheme: dark) {
  scene {
    background: #080808;
    floor: #1a1a1f;
  }
  sphere {
    color: #3a7bff;
  }
}
```

<a name="at-paint"></a>

## `@paint`

A texture drawn by a fragment shader, for `texture: paint(<name>)`: an image that comes from code, like `paint()` in CSS. The block is GLSL, the shader language of WebGL, written as it is for the web. WebGL2 only, for now: with WebGPU, the object keeps its color.

> [!NOTE]
> **WebGL2 only, for now. GLSL, not CSS.** The GLSL of a `@paint` runs on WebGL2, not on WebGPU, which reads another shader language: a scene with `paint()` is drawn with WebGL2. And everything else in GSS is CSS: `@paint` is a way out for the textures CSS cannot describe. Try the gradients, `noise()`, `checker()` and `stripes()` first: they are lighter, and they work with WebGPU too.

**From the shader to the faces of the object:** `@paint rings { … }`, `512 × 512 px`, `texture: paint(rings);`

- **Syntax:** `@paint <name> { <fragment shader> }`
- **See also:** [paint()](textures.md#fn-paint), [texture](textures.md#texture)

### Uniforms

- **time:** The time of the scene, in seconds, a `float`. `u_time` works too. A shader that reads it is drawn again at every frame; one that does not is drawn once.
- **resolution:** The size of the texture in pixels, `vec2(512.0, 512.0)`. `u_resolution` works too.
- **mouse:** The pointer over the scene, in the pixels of the texture, from its bottom left like `gl_FragCoord`. `u_mouse` works too.

The block is a whole fragment shader, with its own `main()`: write `out vec4 color;` and set it. It is drawn into a texture of 512 by 512 pixels, which the object shows like an image.

The shader holds its uniforms, its functions and its `main()`. `gl_FragColor` works too, as in WebGL1, and GSS adds `#version 300 es` and a `precision` when the code has none. The texture goes on each face of the object, with `texture-size` and `image-rendering`. Each `@paint` runs on its own: its names never meet the rest of the scene, and an error in its GLSL names the `@paint` and its line in the file. A scene with `paint()` is drawn with WebGL2: `<gss-scene>`, `mountAsync()` and the playground pick it by themselves in `auto`; with WebGPU chosen, the object shows its `color` instead, and the console says why.

### rings that flow

The shader reads `time`: it is drawn again at every frame, and the colors flow over the cube.

```css
@paint rings {
  uniform float time;
  uniform vec2 resolution;
  out vec4 color;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    color = vec4(0.5 + 0.5 * cos(time + uv.xyx * 6.0 + vec3(0.0, 2.0, 4.0)), 1.0);
  }
}

@scene {
  cube;
}

cube {
  translate: 0 0.8 0;
  rotate-y: 30deg;
  texture: paint(rings);
}
```

### a checkerboard, drawn once

Without `time`, the shader is drawn once, and the texture stays.

```css
@paint checks {
  out vec4 color;

  void main() {
    vec2 cell = floor(gl_FragCoord.xy / 64.0);
    float on = mod(cell.x + cell.y, 2.0);
    color = vec4(mix(vec3(0.12), vec3(0.95), on), 1.0);
  }
}

@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  texture: paint(checks);
}
```

<a name="at-property"></a>

## `@property`

Registers a variable that the page changes from JavaScript while the scene runs, without compiling it again, like CSS `@property`. Like a variable on `:root`, it has one value for the whole scene.

**How it goes, from where it is written to what the scene shows:** `--lift`

- **Syntax:** `@property --<name> { syntax: "<number>" | "<angle>" | "<percentage>" | "<color>" | "<length>"; inherits: true | false; initial-value: <value>; }`
- **See also:** [Set variables from JavaScript](installation.md#set-variables), [@property-panel](#at-property-panel)

### Descriptors

- **syntax:** What the variable holds: `"<number>"`, `"<angle>"`, `"<percentage>"`, `"<color>"`, or `"<length>"` in px, for the radius of `blur()` and `bloom()`.
- **inherits:** Required, like CSS: `true` or `false`.
- **initial-value:** Its value until the page sets another one. `scene { --lift: 2; }` gives another start value; declared anywhere else, on an object, a group, a `:hover` rule or a frame, the variable is an error. A frame can read it.

A registered variable goes in transforms, colors, sizes, materials, lights, `fog` and `filter`. It cannot go where the scene is built when it compiles: the copies of `* n`, `d`, timings, `dpr` and `random()`.

The full list, wherever the shader reads a value at each frame: the transforms (`translate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale`, `transform-origin`), `color`, `opacity`, `background`, `mask-image`, the sizes of the shapes (`size`, `radius`, `height`, `thickness`, `corner-radius`, `stroke-width`, `depth`), the numbers of a gradient, `material`, `floor`, `ambient`, `light` and the `intensity` of the point lights, `fog`, `camera-target`, `blend`, `offset-distance`, `offset-rotate`, `texture-size` and `filter`, alone or inside the math and color functions. Out of reach, built when the scene compiles: the copies of `* n`, `d` and `view-box`, the timing of animations and transitions, the camera the mouse moves, `dpr` and `random()`. A value set from JavaScript is never refused: it is kept in its range, so a size never goes below 0. With `@property-panel`, the playground and Try it show a control for each registered variable over the render.

### a number

The sphere rises with `--lift`, which the page sets with `scene.setProperty("--lift", "2")`.

```css
@property --lift {
  syntax: "<number>";
  inherits: false;
  initial-value: 1;
}

@scene {
  sphere;
}

sphere {
  translate: 0 var(--lift) 0;
  radius: 0.5;
  color: #ff5a36;
}
```

### a color and an angle

`scene { --tint: … }` gives a start value other than `initial-value`.

```css
@property --tint {
  syntax: "<color>";
  inherits: false;
  initial-value: #3a7bff;
}

@property --turn {
  syntax: "<angle>";
  inherits: false;
  initial-value: 30deg;
}

@scene {
  cube;
}

scene {
  --tint: #ff5a36;
}

cube {
  translate: 0 0.8 0;
  rotate-y: var(--turn);
  color: var(--tint);
}
```

### inside math and color functions

`--hue` goes through `calc()`, `sin()` and `oklch()`, computed by the GPU at each frame.

```css
@property --hue {
  syntax: "<number>";
  inherits: false;
  initial-value: 20;
}

@scene {
  sphere * 5;
}

sphere {
  radius: 0.35;
  translate: calc(sibling-index() * 0.8 - 2.4) calc(0.6 + sin(var(--hue) * 1deg) * 0.3) 0;
  color: oklch(70% 0.16 calc(var(--hue) + sibling-index() * 30));
}
```

<a name="at-property-panel"></a>

## `@property-panel`

Shows a control for each variable of `@property` over the render, in the playground and in Try it: a slider and its number, or a color picker for a color. Moving a control sets the variable without compiling the scene again.

**How it goes, from where it is written to what the scene shows:** `variables · 1`

- **Syntax:** `@property-panel { display: open | folded | none; range: [<variable> <min> <max> <step>?]#; }`
- **See also:** [@property](#at-property), [Set variables from JavaScript](installation.md#set-variables)

### Descriptors

- **display:** `open`, the default: the panel shows its controls. `folded`: only its title, `variables · 2`, which opens it. `none`: no panel, as without the rule.
- **range:** The ends of the slider of a variable, and its step if you like: `--col 0 3 1`. One per variable, separated by commas: `range: --col 0 3, --row 0 3;`. They are written like the values of the variable: `0deg 180deg` for an angle, `0% 50%` for a percentage.

The panel never writes into the code. A page that embeds the scene shows no panel: it sets the variables with `setProperty()`.

A slider goes from 0 to twice the start value of its variable, at least from 0 to 1, and around 0 for a negative value; an angle from 0 to 360deg, a percentage from 0% to 100%. A number typed past the end of a slider widens it, and the reset button gives the start value back. With a `range`, the slider keeps the ends of the scene: a number typed past one is held there, and the panel says what the end is. A color has a color picker and no range. When the code changes a start value, the code wins over the slider.

### a slider

Drag `--lift` and the sphere rises, without compiling again.

```css
@property --lift {
  syntax: "<number>";
  inherits: false;
  initial-value: 1;
}

@property-panel {
  display: open;
}

@scene {
  sphere;
}

sphere {
  translate: 0 var(--lift) 0;
  radius: 0.5;
  color: #ff5a36;
}
```

### folded, with a color and an angle

The panel starts folded: its title opens it.

```css
@property --tint {
  syntax: "<color>";
  inherits: false;
  initial-value: #3a7bff;
}

@property --turn {
  syntax: "<angle>";
  inherits: false;
  initial-value: 30deg;
}

@property-panel {
  display: folded;
}

@scene {
  cube;
}

cube {
  translate: 0 0.8 0;
  rotate-y: var(--turn);
  color: var(--tint);
}
```

### a cube on a board of 4 by 4

`range` gives each slider the squares of the board, from 0 to 3, one square at a time.

```css
@property --col {
  syntax: "<number>";
  inherits: false;
  initial-value: 0;
}

@property --row {
  syntax: "<number>";
  inherits: false;
  initial-value: 0;
}

@property-panel {
  range: --col 0 3 1, --row 0 3 1;
}

@scene {
  path#grid;
  cube#piece;
}

#grid {
  d: path("M0 0 H4 M0 1 H4 M0 2 H4 M0 3 H4 M0 4 H4 M0 0 V4 M1 0 V4 M2 0 V4 M3 0 V4 M4 0 V4");
  stroke-width: 0.04;
  rotate-x: 90deg;
  translate: 0 0.02 0;
  color: #1a1a1f;
}

#piece {
  size: 0.6;
  translate: calc(var(--col) - 1.5) 0.3 calc(var(--row) - 1.5);
  color: #ff5a36;
}
```

<a name="at-scene"></a>

## `@scene`

Declares the objects of the scene, one per line: a shape, then an optional `#id`, any number of `.classes`, and `* n` for n copies. Objects are combined in the order they are declared: see `operation`.

- **Syntax:** `@scene { <shape>[#<id>][.<class>]* [* <integer>][;] … group[#<id>][.<class>]* [* <integer>] { … } }`

### Parts

- **<shape>:** `cube`, `sphere`, `torus`… one of the shapes, or a point `light`.
- **#<id>:** One per object. A multiplied id is numbered: `torus#ring * 3` makes `ring-1`, `ring-2` and `ring-3`.
- **.<class>:** Any number of them: `sphere.ball.big`.
- *** <integer>:** Copies of the object, each a sibling of its own.
- **group { … }:** Holds objects and other groups, to move, turn or scale them together. A multiplied group copies everything inside it.

The `;` after an object is optional: a new object or a `}` is enough.

### a single cube

The smallest scene: one object, with the default style.

```css
@scene {
  cube;
}
```

### ids, classes and copies

A `#base` cube and three `.ball` spheres, styled by their id and their class.

```css
@scene {
  cube#base;
  sphere.ball * 3;
}

#base {
  translate: 0 0.5 0;
}

.ball {
  translate: 0 1.5 0;
  radius: 0.3;
}
```

### a group

The two cubes of `#tower` move and turn with their group.

```css
@scene {
  cube#base
  group#tower {
    cube#a
    cube#b
  }
}

#base {
  translate: 1 0.5 0;
}

#tower {
  translate: -1 0 0;
  rotate-y: -30deg;
}

#a {
  translate: 0 0.5 0;
}

#b {
  translate: 0 1.5 0;
  scale: 0.7;
}
```

<a name="at-mixin"></a>

## `@mixin`

Names a block of declarations and rules, written once and put into any rule with `@apply`, like the mixins of CSS. Its parameters are read with `var()`, and each can have a default. The scene compiles as if the block were written in each rule that applies it.

**How it goes, from where it is written to what the scene shows:** `@mixin --polished {`, `material: metal(0.15);`, `corner-radius: 0.12;`, `}`, `#a { @apply --polished; }`, `#b { @apply --polished; }`

- **Syntax:** `@mixin --<name>[(--<parameter> [<type>] [: <default>], …)] { <declaration> … <rule> … [@contents;] }`
- **See also:** [@apply](#at-apply), [var()](variables-conditions.md#fn-var)

### Parts

- **--<name>:** Starts with `--`, like a variable: `@mixin --card { … }`.
- **(--size, --tint: #ff5a36):** The parameters, given by `@apply` in order and read with `var(--size)` inside. After `:`, the default for a value left out. A type, like `--size <number>`, is read as in CSS; the property that gets the value checks it.
- **{ … }:** Declarations, rules nested with `&`, `@media`, and other `@apply`.
- **@contents:** Where the block given to `@apply` goes. `@contents { … }` holds what goes there when `@apply` gives none.

A mixin goes outside the rules, before or after the rules that apply it. From Sass: `@apply` replaces `@include`, `var()` replaces `$`, and `@contents` replaces `@content`.

With two mixins of the same name, the last one wins, like CSS. A parameter hides a variable of the same name, and cannot be declared inside the mixin. The block given to `@apply` does not see the parameters: it belongs to the rule that applies the mixin.

### a mixin, and the rules it saves

Both cubes take the two declarations of `--polished`: the scene is the same as with them written in each rule.

```css
@mixin --polished {
  material: metal(0.15);
  corner-radius: 0.12;
}

@scene {
  cube#a;
  cube#b;
}

#a {
  translate: -0.9 0.5 0;
  color: #ff5a36;
  @apply --polished;
}

#b {
  translate: 0.9 0.5 0;
  color: #3a7bff;
  @apply --polished;
}
```

### parameters and their defaults

`--ball` reads `--x`, `--size` and `--tint` with `var()`; a value left out takes its default.

```css
@mixin --ball(--x, --size: 0.4, --tint: #3a7bff) {
  translate: var(--x) var(--size) 0;
  radius: var(--size);
  color: var(--tint);
}

@scene {
  sphere#a;
  sphere#b;
}

#a {
  @apply --ball(-1);
}

#b {
  @apply --ball(0.8, 0.7, #ff5a36);
}
```

### nested rules

A mixin holds rules too: its `&:hover` becomes `#a:hover`, then `#b:hover`.

```css
@mixin --lively {
  transition: 0.3s;
  &:hover {
    scale: 1.2;
    color: #ff5a36;
  }
}

@scene {
  cube#a;
  cube#b;
}

#a {
  translate: -0.9 0.5 0;
  @apply --lively;
}

#b {
  translate: 0.9 0.5 0;
  @apply --lively;
}
```

### @contents

`--on-small-screens` holds the `@media`, and each rule gives the block to put inside it. Make the render narrower to see it.

```css
@mixin --on-small-screens {
  @media (max-width: 600px) {
    @contents;
  }
}

@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #3a7bff;
  @apply --on-small-screens {
    color: #ff5a36;
    radius: 0.6;
  }
}
```

<a name="at-apply"></a>

## `@apply`

Puts the declarations and rules of a `@mixin` in the rule where it is written, like CSS. Values in parentheses go to the parameters of the mixin, in order; a block goes where the mixin writes `@contents`.

**How it goes, from where it is written to what the scene shows:** `#a { color: #3a7bff; @apply --warm; }`, `color: #ff5a36;`, `#b { @apply --warm; color: #3a7bff; }`, `color: #ff5a36;`

- **Syntax:** `@apply --<name>[(<value>, …)] [{ <declaration> … }];`
- **See also:** [@mixin](#at-mixin), [& (nesting)](selectors.md#selector-nesting)

### Forms

- **@apply --card;:** No values: each parameter takes its default. `@apply --card();` is the same.
- **@apply --card(0.7, #ff5a36);:** One value per parameter, in order; those left out take their default. A value with a comma of its own goes between braces: `{color 1s, scale 2s}`.
- **@apply --card { … }:** The block goes where the mixin writes `@contents`. Values in parentheses can come before it: `@apply --card(0.7) { … }`.

The mixin takes the place of `@apply` in the cascade: a declaration written after it in the same rule wins, one written before loses.

`@apply` goes in any rule: an object, a group, the scene, a `:hover` or `:active` rule, a nested rule, a `@media`, and a frame of `@keyframes` when the mixin holds declarations only. An unknown mixin, more values than parameters, a parameter with no value and no default, or a mixin that applies itself is an error that points at it.

### where it stands in the rule

The mixin takes the place of `@apply`: in `#a`, its `color` comes after the blue one and wins; in `#b`, the blue one comes after it and wins.

```css
@mixin --warm {
  color: #ff5a36;
}

@scene {
  cube#a;
  cube#b;
}

#a {
  translate: -0.9 0.5 0;
  color: #3a7bff;
  @apply --warm;
}

#b {
  translate: 0.9 0.5 0;
  @apply --warm;
  color: #3a7bff;
}
```

### in a frame of @keyframes

`--pose` gives a height and a size, at rest and at the end of the hop.

```css
@mixin --pose(--h, --s) {
  translate: 0 var(--h) 0;
  scale: var(--s);
}

@scene {
  cube;
}

cube {
  color: #ff5a36;
  @apply --pose(0.5, 1);
  animation: hop 1.2s ease-in-out alternate;
}

@keyframes hop {
  to {
    @apply --pose(1.6, 1.3);
  }
}
```

<a name="at-for"></a>

## `@for`

Writes its block once for each number it counts, with `var(--i)` replaced by that number, like the `@for` of Sass. It goes anywhere: in `@scene` to make objects, around rules, in a rule, in `@keyframes`. The scene compiles as if each step were written by hand.

- **Syntax:** `@for --<name> from <number> through | to <number> [by <number>] { … }`
- **See also:** [@each](#at-each), [sibling-index()](values.md#fn-sibling-index)

### Parts

- **--<name>:** The variable of the loop, read with `var(--i)` anywhere in the block: in a value, a selector, an attribute of `@scene`, after `*`.
- **from 1 through 4:** Counts 1, 2, 3, 4: `through` counts the last number.
- **from 1 to 4:** Counts 1, 2, 3: `to` stops before the last number. From the larger to the smaller, the loop counts down.
- **by 0.5:** The size of a step, more than 0. Without it, 1.
- **0deg, 50%:** The numbers can take a unit, the same for all three: `from 0deg to 360deg by 45deg`.

`* n` and `sibling-index()` already repeat an object; `@for` is for what they cannot do, like a grid that needs two indices, or rules written for each step.

A loop takes 1000 steps at most. Loops can be nested, each with its own name. Inside the block, the variable of the loop hides a variable of the same name. The numbers are written in the file: a `var()` of a variable or of a parameter cannot set them.

### objects and rules for each step

The loop in `@scene` makes five cubes; the loop around the rule gives each its height, and stands it on the floor.

```css
@scene {
  @for --i from 1 through 5 {
    cube.step;
  }
}

.step {
  color: #ff5a36;
}

@for --i from 1 through 5 {
  .step:nth-child(var(--i)) {
    size: 0.8 calc(var(--i) * 0.4) 0.8;
    translate: calc(var(--i) * 1.1 - 3.3) calc(var(--i) * 0.2) 0;
  }
}
```

### a grid

Two loops, one in the other, give each cube its row and its column in attributes; the rules read them back.

```css
@scene {
  @for --row from 0 to 3 {
    @for --col from 0 to 3 {
      cube[data-row=var(--row)][data-col=var(--col)];
    }
  }
}

cube {
  scale: 0.8;
}

@for --row from 0 to 3 {
  @for --col from 0 to 3 {
    [data-row=var(--row)][data-col=var(--col)] {
      translate: calc(var(--col) - 1) 0.4 calc(var(--row) - 1);
      color: hsl(calc(var(--row) * 50 + var(--col) * 20) 80% 60%);
    }
  }
}
```

<a name="at-each"></a>

## `@each`

Writes its block once for each value of a list, with `var(--x)` replaced by that value, like the `@each` of Sass. A value can be a number, a color, a word, even a shape: `@each --shape in cube, sphere { var(--shape); }` makes a cube, then a sphere.

- **Syntax:** `@each --<name> in <value>, <value>, … { … }`
- **See also:** [@for](#at-for), [@scene](#at-scene)

### Parts

- **--<name>:** The variable of the loop, read with `var(--x)` anywhere in the block, even in the place of a shape in `@scene`.
- **in tomato, gold, teal:** The values, split at the commas. A value can hold several words: `in 0 1 0, 1 0 0`.
- **{a, b}:** A value with a comma of its own goes between braces, like a value of `@apply`.

It goes anywhere `@for` goes: in `@scene`, around rules, in a rule, in `@keyframes`. Each value is written in place of the `var()`, as if the block were written by hand for it.

A list takes 1000 values at most. An empty value is an error. Inside the block, the variable of the loop hides a variable of the same name.

### a different shape at each step

The variable stands in the place of the shape: four objects of four shapes, in a row.

```css
@scene {
  @each --shape in cube, sphere, cone, torus {
    var(--shape).piece;
  }
}

.piece {
  translate: calc(sibling-index() * 1.6 - 4) 0.6 0;
  color: #3a7bff;
}
```

### a list of colors

Each sphere keeps its color in an attribute, and one rule per color paints it.

```css
@scene {
  @each --c in tomato, gold, teal, orchid {
    sphere[data-color=var(--c)];
  }
}

sphere {
  translate: calc(sibling-index() * 1.3 - 3.25) 0.5 0;
}

@each --c in tomato, gold, teal, orchid {
  [data-color=var(--c)] {
    color: var(--c);
  }
}
```

---

Next: [Selectors](selectors.md)
