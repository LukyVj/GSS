<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Gradients and noise

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#gradients).

<a name="fn-gradients"></a>

## `<gradient>`

The gradients of CSS, for the `background` of the scene, the `color` of an object, the color of a material and the `floor`. Each color can have one or two positions; the missing ones are spread like CSS, and two colors at the same place make a hard edge.

- **Syntax:** `linear-gradient([<angle> | to <side> <side>?]?, <color> <percentage>{0,2}, …) | radial-gradient([circle | ellipse]? [closest-side | farthest-side | closest-corner | farthest-corner]? [at <position>]?, <color> <percentage>{0,2}, …) | conic-gradient([from <angle>]? [at <position>]?, <color> [<angle> | <percentage>]{0,2}, …)`
- **Computed:** on the GPU, at each pixel

### Functions

- **linear-gradient():** Along a line, `to bottom` by default. It takes an angle (`0deg` up, `90deg` right), or `to` a side or a corner.
- **radial-gradient():** An ellipse that reaches the farthest corner by default. It takes `circle` or `ellipse`, a size keyword and a position: `at 30% 40%`, `at top`.
- **conic-gradient():** Around a center, clockwise from the top: `from 90deg` starts a quarter turn later, and `at 30% 40%` moves the center. Its colors take angles or percentages: a color wheel, a pie chart, the sweep of a hand.
- **repeating-linear-gradient():** Repeats the stops; also `repeating-radial-gradient()` and `repeating-conic-gradient()`.

In the background, the gradient covers the canvas and follows its size; reflections and glass see it in the direction they look. On an object, it covers the object as seen from the front, from left to right and from bottom to top (a plane is seen from above): `to top` goes from its bottom to its top, whatever its size, and it moves and turns with the object. On the `floor`, it covers a square of 40 units centered under the scene, seen from above. Colors are mixed in sRGB, like CSS with hex colors.

### linear-gradient()

A diagonal background, `to top right`.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  color: #f4f1ea;
}

scene {
  floor: none;
  background: linear-gradient(to top right, #ff5a36, #3a7bff);
}
```

### radial-gradient()

A `circle closest-side` behind a glass sphere.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  material: glass;
}

scene {
  floor: none;
  background: radial-gradient(circle closest-side, #ffd27a, #ff5a36 60%, #1a0f2e);
}
```

### linear-gradient() on objects

A gradient on a cylinder and on a cube, and one in the material of a sphere.

```css
@scene {
  cylinder;
  sphere;
  cube;
}

cylinder {
  radius: 0.4;
  height: 2;
  translate: 1.4 1 0;
  color: linear-gradient(#ff5a36, #ffd27a);
}

sphere {
  radius: 0.7;
  translate: 0 0.7 0;
  material: metal(radial-gradient(circle at 35% 65%, #ffffff, #3a7bff 40%, #10183a), 0.15);
}

cube {
  size: 1;
  translate: -1.4 0.5 0;
  rotate-y: -30deg;
  color: repeating-linear-gradient(45deg, #3ad16b 0% 10%, #f4f1ea 10% 20%);
}
```

### conic-gradient()

A color wheel on a dial, stripes in a metal, and a conic background.

```css
@scene {
  cube#dial;
  sphere;
}

#dial {
  size: 2 2 0.1;
  corner-radius: 0.05;
  translate: 0.4 1.2 0;
  color: conic-gradient(#ff5a36, #ffd27a, #3ad16b, #3a7bff, #b15aff, #ff5a36);
}

sphere {
  radius: 0.5;
  translate: -1.4 0.5 0.6;
  material: metal(repeating-conic-gradient(from 45deg, #f4f1ea 0deg 30deg, #111111 30deg 60deg), 0.3);
}

scene {
  floor: none;
  background: conic-gradient(from 180deg at 50% 0%, #1c1c24, #2a2a3a, #1c1c24);
}
```

### repeating-linear-gradient() and repeating-radial-gradient()

Stripes behind two chrome spheres.

```css
@scene {
  sphere#a;
  sphere#b;
}

sphere {
  radius: 0.6;
  translate: 0 1 0;
  material: chrome;
}

#a {
  translate: 0.8 1 0;
}

#b {
  translate: -0.8 1 0;
}

scene {
  floor: none;
  background: repeating-linear-gradient(45deg, #111 0% 5%, #2a2a3a 5% 10%);
}
```

<a name="fn-checker"></a>

## `checker()`

A checkerboard, wherever a gradient goes: the `color` of an object, the color of a material, the `background`, the `floor`. Like `noise()`, it is cut in the object's own space: a grid of cubes, one color and then the other.

- **Syntax:** `checker(<number> [at <number> <number> <number>]?, <color>, <color>)`
- **Computed:** on the GPU, at each pixel

### Arguments

- **<number>:** The scale: how many cells fit in one unit.
- **at <x> <y> <z>:** Moves the grid.
- **<color>, <color>:** The two colors of the cells.

On an object, the grid is cut in its own space, like a block of stone carved out of a checkered material: the cells keep their size whatever the shape, and move and turn with the object. On the `floor`, it is read in the units of the scene; in the background, it follows the direction of the view. Like `noise()`, it can be animated into another `checker()`, its numbers can be set from JavaScript, and it can be the map of `displace()`. The edges of the cells are sharp: far away, a fine checkerboard shimmers.

### a checkered floor

One cell per unit of the scene.

```css
@scene {
  sphere;
}

scene {
  floor: checker(1, #1a1d2b, #e8e6e1);
}

sphere {
  translate: 0 0.6 0;
  radius: 0.6;
  material: chrome;
}
```

### a checkered cube

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  size: 1.2;
  rotate-y: 30deg;
  color: checker(2.5, #ff5a36, #f4f1ea);
}
```

<a name="fn-displace"></a>

## `displace()`

Moves an image by another one, like SVG `feDisplacementMap`, wherever a gradient goes: `color`, a material, `background` and its layers, `mask-image`, `floor`. Stripes moved by a turbulence make marble, rings make wood, a mask gets ragged edges.

- **Syntax:** `displace(<gradient> | <noise()>, <gradient> | <noise()>, <number> | <percentage>)`
- **Computed:** on the GPU, at each pixel

### Arguments

- **<image>:** The gradient or the `noise()` to move.
- **<map>:** Usually a `noise()`: its colors move each point where the image is read. On a gradient, red moves it right and green down, like SVG; on a `noise()`, red, green and blue move it in 3D. A channel at 50% moves nothing, 0% and 100% the most.
- **<amount>:** A share of the size of the image: `0.3` or `30%` moves it by up to 15% of its size.

A `noise()` map gives each channel a noise of its own, like `feTurbulence`, so even a gray noise moves the image in every direction; a gradient map is read once, by its colors, which are opaque. Like a gradient, `displace()` can be animated and changed by `:hover`, into another `displace()` whose image and map are of the same kinds: animating the `at` of a noise map makes the image flow. Its numbers can be set from JavaScript.

### marble

Stripes moved by a turbulence.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  size: 1.2;
  corner-radius: 0.06;
  color: displace(repeating-linear-gradient(45deg, #f4f1ea 0% 9%, #9a9385 10%, #f4f1ea 11%), noise(turbulence 1 4, black, white), 0.35);
}
```

### a ragged hole, in mask-image

A round hole with ragged edges.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.8;
  color: #ff5a36;
  mask-image: displace(radial-gradient(circle, transparent 30%, black 31%), noise(4 3, black, white), 0.15);
}
```

### water that flows

Stripes that flow as `@keyframes` moves the `at` of their map.

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
  background: displace(repeating-linear-gradient(#123a6b 0% 3%, #3a7bff 5% 8%), noise(2 3, black, white), 0.1);
  animation: flow 10s linear infinite;
}

@keyframes flow {
  to {
    background: displace(repeating-linear-gradient(#123a6b 0% 3%, #3a7bff 5% 8%), noise(2 3 at 0 1 0, black, white), 0.1);
  }
}
```

<a name="fn-noise"></a>

## `noise()`

A noise image, wherever a gradient goes: the `background`, the `color` of an object, the color of a material, the `floor`. Its colors are placed like the stops of a gradient, along the value of a smooth 3D noise, like SVG `feTurbulence`.

- **Syntax:** `noise([turbulence]? <number> <integer>? [seed <integer>]? [at <number> <number> <number>]?, <color> <percentage>{0,2}, …)`
- **Computed:** on the GPU, at each pixel

### Arguments

- **<number>:** The scale: how many patterns fit in one unit.
- **<integer>:** The octaves, from 1 to 8, if any: each one adds detail twice as fine, like `numOctaves`.
- **turbulence:** Sharp creases instead of soft clouds: marble, fire, lightning.
- **seed <integer>:** Another pattern.
- **at <x> <y> <z>:** Moves the pattern.

On an object, the noise is cut in the object's own space, like a block of stone: no seam, and it moves and turns with the object. On the `floor`, it is read at each point of the floor, in the units of the scene. In the background, it follows the direction of the view. Like a gradient, it can be animated and changed by `:hover`, into another `noise()` of the same kind with as many colors: animating `at` makes it drift, like clouds or smoke. Its numbers can be set from JavaScript.

### noise() on an object

Blue clouds on a sphere.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.8;
  color: noise(3 4, #1a1d2b, #3a7bff 55%, #ffffff);
}
```

### turbulence: marble

Sharp creases, like the veins of marble.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  size: 1.2;
  corner-radius: 0.06;
  color: noise(turbulence 1.2 5, #4a4f5a, #f4f1ea 30%);
}
```

### a sky that drifts

A background noise that drifts as `@keyframes` moves its `at`.

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
  background: noise(2 4, #2f6bd8 40%, #ffffff 75%);
  animation: wind 20s linear infinite;
}

@keyframes wind {
  to {
    background: noise(2 4 at 1 0 0, #2f6bd8 40%, #ffffff 75%);
  }
}
```

### noise() in a material

A turbulence in the color of a metal.

```css
@scene {
  torus;
}

torus {
  translate: 0 0.6 0;
  rotate-x: 70deg;
  material: metal(noise(turbulence 6 3, #6b4a2b, #d4af37), 0.25);
}
```

<a name="fn-stripes"></a>

## `stripes()`

Bands of two colors across an axis, wherever a gradient goes. Like `checker()`, they are cut in the object's own space: across `y` by default, like the rings of a column.

- **Syntax:** `stripes(<number> [x | y | z]? [at <number> <number> <number>]?, <color>, <color>)`
- **Computed:** on the GPU, at each pixel

### Arguments

- **<number>:** The scale: how many pairs of bands fit in one unit.
- **x, y, z:** The axis the bands follow one another along: `y` by default, horizontal bands.
- **at <x> <y> <z>:** Moves the bands: animated, they scroll.
- **<color>, <color>:** The two colors, each half of a pair.

For bands seen from the front only, at any angle, `repeating-linear-gradient()` is the CSS way; `stripes()` goes all around the object, in its own space. Like `noise()`, it can be animated into another `stripes()` of the same axis, its numbers can be set from JavaScript, and it can be the map of `displace()`. The edges are sharp.

### a striped column

```css
@scene {
  cylinder;
}

cylinder {
  translate: 0 0.8 0;
  radius: 0.4;
  height: 1.6;
  color: stripes(3, #ff5a36, #f4f1ea);
}
```

### bands that scroll

`at` animated: the bands move up the capsule.

```css
@scene {
  capsule;
}

capsule {
  translate: 0 0.8 0;
  radius: 0.4;
  height: 1.6;
  color: stripes(4, #3a7bff, #e8e6e1);
  animation: rise 2s linear infinite;
}

@keyframes rise {
  to {
    color: stripes(4 at 0 -0.25 0, #3a7bff, #e8e6e1);
  }
}
```

---

Next: [Materials](materials.md)
