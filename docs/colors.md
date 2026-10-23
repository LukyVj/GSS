<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Colors

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#colors).

<a name="color"></a>

## `color`

Sets the base color of the surface of the object: a hex color (`#ff5a36`), `rgb()`, `hsl()` or one of the 148 named colors of CSS (`tomato`). It can also be a gradient, a `noise()`, or one of them moved by `displace()`.

- **Syntax:** `<color> | <gradient>`
- **Initial value:** `#e6e6e6`
- **Applies to:** objects
- **Animatable:** yes

### Values

- **<color>:** Any CSS color: the compiler turns it into a hex color.
- **<gradient>:** `linear-gradient()`, `radial-gradient()` or `conic-gradient()`, painted on the object as seen from the front, and taken by every material.
- **noise():** A noise cut in the object's own space, like a block of stone.
- **transparent:** A transparent color (`#ff000080`, `rgb(255 0 0 / 50%)`), or the transparent stops of a gradient, make the object transparent, like `opacity`.

A gradient can be animated and changed by `:hover`, into another gradient of the same kind with as many colors. A color cannot change into a gradient.

Each number of an animated gradient moves on its own. Through a variable, one number is enough: `linear-gradient(var(--angle), …)` turns when `@keyframes` changes `--angle`. On a point `light`, `color` is the color of its light: a plain color only.

### a hex color

```css
@scene {
  sphere;
}

sphere {
  color: #ff5a36;
}
```

### a named color and hsl()

`tomato`, and `hsl(210 80% 60%)`.

```css
@scene {
  sphere#a;
  sphere#b;
}

#a {
  translate: 0.8 0.5 0;
  color: tomato;
}

#b {
  translate: -0.8 0.5 0;
  color: hsl(210 80% 60%);
}
```

### animated gradient

`@keyframes` turns the angle of the gradient through `--angle`.

```css
@scene {
  plane;
}

plane {
  size: 4 3;
  translate: 0 0.05 0;
  --angle: 0deg;
  color: linear-gradient(var(--angle), #ff6540, #722cff);
  animation: spin 6s;
}

scene {
  camera-angle: 0deg 60deg;
}

@keyframes spin {
  to {
    --angle: 1turn;
  }
}
```

### gradient on :hover

Under the mouse, the center of the gradient moves and its colors change.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  color: radial-gradient(circle at 30% 70%, #ffd27a, #ff5a36);
  transition: 0.4s;
}

cube:hover {
  color: radial-gradient(circle at 70% 30%, #7ad2ff, #3a3aff);
}
```

### a transparent color

A sphere at 40% alpha: the cube behind it shows through.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0 1 0;
  radius: 0.7;
  color: rgb(58 123 255 / 40%);
}

cube {
  translate: 0 0.4 -1.2;
  size: 0.8;
  color: #ff5a36;
}
```

### a gradient that fades out

The cube fades out toward its bottom.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.7 0;
  size: 1.2;
  color: linear-gradient(#ff5a36, transparent);
}
```

<a name="background"></a>

## `background`

Sets the background of the scene, seen wherever there is no object and no floor: a color, a gradient drawn over the canvas like a CSS background, a `noise()` or a `displace()`.

**What the property changes in the scene:** `2`, `1`

- **Syntax:** `[ <gradient> , ]* [ <gradient> | <color> ]`
- **Initial value:** `#080808`
- **Applies to:** the scene
- **Animatable:** yes

Like CSS, a background can have several layers, separated by commas, the first on top. Only the last layer can be a plain color.

Two layers: `noise(3, #ffffff00 40%, #ffffff), linear-gradient(#2f6bd8, #9fc4ff)`. Transparent colors let the layers below show through, and `background-blend-mode` blends them. With `animation` on the scene, a color changes into a color and a gradient into a gradient of the same kind, also through variables: without objects and floor, the scene is a moving image.

### a color

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  background: #42429f;
}
```

### a gradient

A radial gradient, and no floor: the sphere floats in it.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
}

scene {
  floor: none;
  background: radial-gradient(circle at 50% 40%, #2a2a3a, #07070a);
}
```

### layers: clouds over a sky

A transparent `noise()` over a blue gradient.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  material: chrome;
}

scene {
  floor: none;
  background: noise(2 4, #ffffff00 45%, #ffffff 80%), linear-gradient(#2f6bd8, #9fc4ff);
}
```

### animated background

`@keyframes` moves the center of the gradient through `--x`.

```css
@scene {
}

scene {
  floor: none;
  --x: 20%;
  background: radial-gradient(circle at var(--x) 40%, #ffb36b, #ff6540 30%, #722cff 70%, #171322);
  animation: drift 8s ease-in-out alternate;
  filter: grain(0.06);
}

@keyframes drift {
  to {
    --x: 80%;
  }
}
```

<a name="background-blend-mode"></a>

## `background-blend-mode`

How each layer of `background` blends with what is below it, like CSS: one mode per layer, the first for the top layer. A shorter list repeats over the layers.

- **Syntax:** `<blend-mode>#`
- **Initial value:** `normal`
- **Applies to:** the scene
- **Animatable:** no

### Modes

- **normal:** Covers what is below: the default.
- **multiply, screen:** Darkens, where white changes nothing; lightens, where black changes nothing.
- **overlay, soft-light, hard-light:** More contrast: multiplies the darks, screens the lights.
- **darken, lighten:** The darker or the lighter of the two colors.
- **color-dodge, color-burn:** Brightens or darkens what is below, by the color of the layer.
- **difference, exclusion:** The difference of the two colors; softer with `exclusion`.
- **hue, saturation, color, luminosity:** One part of the color of the layer, over the rest of the color below.

The transparency of a layer still applies: a transparent part blends nothing.

### a grain over a gradient

A gray noise multiplied over a gradient, like a grain.

```css
@scene {
}

scene {
  floor: none;
  background: noise(40 2, #808080, #ffffff), linear-gradient(135deg, #ff5a36, #3a7bff);
  background-blend-mode: multiply;
}
```

### two noises, screened

Two noises over black, lightened together by `screen`.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  material: chrome;
}

scene {
  floor: none;
  background: noise(3 3, #000000 45%, #ff5a36), noise(2 4 seed 3, #000000 40%, #3a7bff), #000000;
  background-blend-mode: screen;
}
```

<a name="floor"></a>

## `floor`

Sets the color of the floor, an infinite plane at y = 0, lit like the objects. It can also be a gradient, a `noise()`, or one of them moved by `displace()`. `none` removes it: the objects float over the `background`, like the GSS logo.

- **Syntax:** `<color> | <gradient> | none`
- **Initial value:** `#e8e3db`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **<color>:** Any opaque CSS color.
- **<gradient>:** `linear-gradient()`, `radial-gradient()` or `conic-gradient()`, spread over a square of 40 units centered under the scene: everything the scene draws.
- **noise():** A noise read at each point of the floor, in the units of the scene: its scale is how many patterns fit in one unit.
- **none:** No floor.

The floor takes one image, not layers, and opaque colors only. It is not animated, but the numbers of its image can be set from JavaScript.

A gradient is seen from above, like on a `plane`: its top is away from the camera at rest, so `linear-gradient(#0b1020, #273d62)` goes from the horizon to the camera, and past the square it goes on with its first and last colors. A `displace()` moves the image by a share of that square: `0.02` moves it by up to 0.4 units. Reflections see it, and `fog` covers it like the rest of the scene.

### a dark floor

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  floor: #1a1a1f;
}
```

### no floor

`floor: none`, over a dark background.

```css
@scene {
  sphere;
}

sphere {
  color: #ff5a36;
  material: jelly(0.6);
}

scene {
  floor: none;
  background: #0a0a0c;
}
```

### a noise() on the floor

Blue stone under a chrome sphere, which reflects it.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  material: chrome;
}

scene {
  floor: noise(2 3, #10182b, #273d62 55%, #0b1020);
  background: #0b1020;
}
```

### a pool of light

A `radial-gradient()` that fades into the color of the background, around the scene.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  color: #ff5a36;
}

scene {
  floor: radial-gradient(circle, #4a4f6a, #0b1020 12%);
  background: #0b1020;
}
```

<a name="mix-blend-mode"></a>

## `mix-blend-mode`

How the color of the object blends with what is behind it, like CSS: the objects behind it, the floor and the background. It takes the modes of `background-blend-mode`, and `plus-lighter`, which adds the colors. `normal`, the default, covers what is behind.

- **Syntax:** `<blend-mode> | plus-lighter`
- **Initial value:** `normal`
- **Applies to:** objects
- **Animatable:** yes

### Modes

- **normal:** Covers what is behind: the default.
- **multiply, screen:** Darkens, where white changes nothing; lightens, where black changes nothing.
- **overlay, soft-light, hard-light:** More contrast: multiplies the darks, screens the lights.
- **darken, lighten:** The darker or the lighter of the two colors.
- **color-dodge, color-burn:** Brightens or darkens what is behind, by the color of the object.
- **difference, exclusion:** The difference of the two colors; softer with `exclusion`.
- **hue, saturation, color, luminosity:** One part of the color of the object, over the rest of the color behind it.
- **plus-lighter:** Adds the two colors, up to white.

On a group, the mode goes into each object, so they blend with each other too: CSS blends the group as one picture. On `:hover` and in `@keyframes`, the mode switches halfway through.

The eye sees through a blended object to what is behind it, like through a transparent one, and the color of the object, lit, blends with the color behind it. An object never blends with itself: it shows its nearest surface, over what is behind the whole object. Its `opacity` still applies: at 50%, half of the blend shows. On a group, an object with a mode of its own keeps it, and there is no `isolation`. The switch halfway through is the one of a discrete property of CSS. The reflections show a blended object with its own color, and the eye sees six surfaces behind one another at most.

### three lights, screened

A red, a green and a blue sphere over black: where they meet, `screen` adds them up to white.

```css
@scene {
  sphere#r;
  sphere#g;
  sphere#b;
}

scene {
  floor: none;
  background: #000000;
  ambient: 0.85;
}

sphere {
  radius: 0.75;
  mix-blend-mode: screen;
}

#r {
  translate: 0 1.45 0;
  color: #ff0000;
}

#g {
  translate: -0.45 0.75 0.2;
  color: #00ff00;
}

#b {
  translate: 0.45 0.75 0.4;
  color: #0000ff;
}
```

### multiply over the floor

A sphere multiplied over a checkered floor and a cube: the squares and the cube show through it, tinted.

```css
@scene {
  sphere;
  cube;
}

scene {
  floor: checker(0.5, #f4f1ea, #2a2a3a);
}

sphere {
  translate: 0 0.9 0.6;
  radius: 0.9;
  color: #ffcc33;
  mix-blend-mode: multiply;
}

cube {
  translate: 0.6 0.5 -0.8;
  size: 1;
  color: #3a7bff;
}
```

### difference on :hover

The white cube turns into the negative of the gradient behind it under the mouse.

```css
@scene {
  cube;
}

scene {
  floor: none;
  background: linear-gradient(90deg, #ff5a36, #3a7bff);
}

cube {
  translate: 0 0.5 0;
  size: 1.4;
  color: #ffffff;
  rotate-y: 30deg;
  transition: 0.3s;
}

cube:hover {
  mix-blend-mode: difference;
}
```

### on a group

The mode of the group goes into each of its cubes: `difference` turns the stripes behind them inside out.

```css
@scene {
  group#bars {
    cube * 3;
  }
}

scene {
  floor: none;
  ambient: 0.7;
  camera-distance: 4;
  background: repeating-linear-gradient(45deg, #ffcc33 0% 5%, #2a2a3a 5% 10%);
}

#bars {
  translate: 0 0.5 0;
  rotate-y: 20deg;
  mix-blend-mode: difference;
}

cube {
  size: 0.6 1.6 0.6;
  corner-radius: 0.08;
  translate: calc(sibling-index() * 0.9 - 1.8) 0 0;
  color: #ffffff;
}
```

---

Next: [Color functions](color-functions.md)
