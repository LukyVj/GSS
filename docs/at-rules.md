<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Language

# At-rules

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#at-rules).

<a name="at-keyframes"></a>

## `@keyframes`

Defines the steps of an animation, played by the `animation` property, like CSS.

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

- **Syntax:** `@media <media-query> { <rule> … }`

### Queries

- **(max-width: 600px):** The width of the viewport; also `min-width`, in `px` or `em`.
- **(orientation: portrait):** Taller than wide; `landscape` otherwise.
- **(prefers-color-scheme: dark):** The dark mode of the system; `light` for the light mode.
- **(prefers-reduced-motion):** The visitor asks for less motion.
- **and, not, ,:** Combine queries, like CSS.

The browser reads the query, so any media query CSS knows works. Inside, the rules join the cascade where the `@media` is written, with their usual specificity. A scene can use up to 4 different queries, and `@media` holds rules only: `@scene` and `@keyframes` go outside it. On a page, the viewport is the window, like CSS. In the playground and in Try it, it is the render, like the result of CodePen: make the render narrower to see a `max-width` query apply.

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

- **Syntax:** `@paint <name> { <fragment shader> }`
- **See also:** [paint()](textures.md#fn-paint), [texture](textures.md#texture)

### Uniforms

- **time:** The time of the scene, in seconds, a `float`. `u_time` works too. A shader that reads it is drawn again at every frame; one that does not is drawn once.
- **resolution:** The size of the texture in pixels, `vec2(512.0, 512.0)`. `u_resolution` works too.
- **mouse:** The pointer over the scene, in the pixels of the texture, from its bottom left like `gl_FragCoord`. `u_mouse` works too.

The block is a whole fragment shader: its uniforms, its functions and its `main()`. Write `out vec4 color;` and set it, or set `gl_FragColor` as in WebGL1; GSS adds `#version 300 es` and a `precision` when the code has none. It is drawn into a texture of 512 by 512 pixels, which the object shows like an image, on each of its faces, with `texture-size` and `image-rendering`. Each `@paint` runs on its own: its names never meet the rest of the scene, and an error in its GLSL names the `@paint` and its line in the file. A scene with `paint()` is drawn with WebGL2: `<gss-scene>`, `mountAsync()` and the playground pick it by themselves in `auto`; with WebGPU chosen, the object shows its `color` instead, and the console says why.

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

- **Syntax:** `@property --<name> { syntax: "<number>" | "<angle>" | "<percentage>" | "<color>" | "<length>"; inherits: true | false; initial-value: <value>; }`
- **See also:** [Set variables from JavaScript](installation.md#set-variables), [@property-panel](#at-property-panel)

### Descriptors

- **syntax:** What the variable holds: `"<number>"`, `"<angle>"`, `"<percentage>"`, `"<color>"`, or `"<length>"` in px, for the radius of `blur()` and `bloom()`.
- **inherits:** Required, like CSS: `true` or `false`.
- **initial-value:** Its value until the page sets another one. `scene { --lift: 2; }` gives another start value; declared anywhere else, on an object, a group, a `:hover` rule or a frame, the variable is an error. A frame can read it.

It goes wherever the shader reads a value at each frame: the transforms (`translate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale`, `transform-origin`), `color`, `opacity`, `background`, `mask-image`, the sizes of the shapes (`size`, `radius`, `height`, `thickness`, `corner-radius`, `stroke-width`, `depth`), the numbers of a gradient, `material`, `floor`, `ambient`, `light` and the `intensity` of the point lights, `fog`, `camera-target`, `blend`, `offset-distance`, `offset-rotate`, `texture-size` and `filter`, alone or inside the math and color functions. It cannot go where the scene is built when it compiles: the copies of `* n`, `d` and `view-box`, the timing of animations and transitions, the camera the mouse moves, `dpr` and `random()`. A value set from JavaScript is never refused: it is kept in its range, so a size never goes below 0. With `@property-panel`, the playground and Try it show a control for each registered variable over the render.

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

- **Syntax:** `@property-panel { display: open | folded | none; }`
- **See also:** [@property](#at-property), [Set variables from JavaScript](installation.md#set-variables)

### Descriptors

- **display:** `open`, the default: the panel shows its controls. `folded`: only its title, `variables · 2`, which opens it. `none`: no panel, as without the rule.

A slider goes from 0 to twice the start value of its variable, at least from 0 to 1, and around 0 for a negative value; an angle from 0 to 360deg, a percentage from 0% to 100%. A number typed past the end of a slider widens it, and the reset button gives the start value back. When the code changes a start value, the code wins over the slider. The panel never writes into the code, and a page that embeds the scene shows no panel: it sets the variables with `setProperty()`.

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

---

Next: [Selectors](selectors.md)
