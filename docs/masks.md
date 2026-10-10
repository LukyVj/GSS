<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Visibility, opacity, outlines and masks

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#masks).

<a name="display"></a>

## `display`

`none` leaves the object out of the scene, like CSS: it is not drawn, casts no shadow and cannot be pointed at. On a group, every object inside it is left out; on a `light`, the light is off.

- **Syntax:** `none | block`
- **Initial value:** `block`
- **Applies to:** objects
- **Animatable:** no

The object still counts among its siblings, like an element of the page with `display: none`: `:nth-child()` and `sibling-index()` see it. It is set when the scene compiles, so it changes with `@media`, not on `:hover` or in `@keyframes`: to hide an object for a moment, use `visibility`. Like CSS, `@media (max-width: …)` reads the width of the window on a page; in the playground and in Try it, the width of the render.

### a whole group left out

The group of small spheres says `display: none`: only the torus is drawn. Remove the rule to see them.

```css
@scene {
  torus;
  group#moons {
    sphere * 3;
  }
}

torus {
  translate: 0 0.8 0;
  rotate-x: 70deg;
  radius: 0.7;
  thickness: 0.2;
}

#moons {
  display: none;
}

#moons sphere {
  radius: 0.18;
  translate: calc(sibling-index() * 0.6 - 1.2) 1.8 0;
  color: #ff5a36;
}
```

### with @media

The small spheres show only when the scene is wider than 400px: Try it is narrower, so they are left out; open it in the playground and drag the divider to see them come and go.

```css
@scene {
  torus;
  sphere.moon * 3;
}

torus {
  translate: 0 0.8 0;
  rotate-x: 70deg;
  radius: 0.7;
  thickness: 0.2;
}

.moon {
  radius: 0.18;
  translate: calc(sibling-index() * 0.6 - 1.2) 1.8 0;
  color: #ff5a36;
}

@media (max-width: 400px) {
  .moon {
    display: none;
  }
}
```

### every other one

`display: none` on every other cube: the others keep their places.

```css
@scene {
  cube * 7;
}

cube {
  size: 0.4;
  translate: calc(sibling-index() * 0.6 - 2.4) 0.3 0;
  color: #3a7bff;
}

cube:nth-child(even) {
  display: none;
}
```

<a name="mask-image"></a>

## `mask-image`

Cuts holes in the object, like a CSS mask: where the image covers the surface, the object is there; where it is transparent, the surface is not drawn, and the eye sees inside the object, then what is behind it. The image is a gradient, a `noise()`, or one of them moved by `displace()`.

- **Syntax:** `none | <gradient>`
- **Initial value:** `none`
- **Applies to:** objects
- **Animatable:** yes

It is read like a gradient in `color`: seen from the front in the object's own space, and in 3D for a `noise()`, so the holes move and turn with the object. A part covered less than half is a hole, so the edge of a hole is sharp: unlike CSS, a mask does not fade the object. `mask-mode` says what counts, the alpha by default. The holes show in the reflections too, and the mouse goes through them: `:hover` reaches the object behind a hole.

### holes from a noise

A `noise()` whose black covers and whose `transparent` cuts.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.8;
  color: #ff5a36;
  mask-image: noise(4 3, black 48%, transparent 52%);
}
```

### a sphere seen through a cube

A round hole in each face shows the sphere inside the cube.

```css
@scene {
  cube;
  sphere;
}

scene {
  camera-angle: 20deg 15deg;
}

cube {
  translate: 0 0.7 0;
  size: 1.4;
  color: #3a7bff;
  mask-image: radial-gradient(circle, transparent 35%, black 36%);
}

sphere {
  translate: 0 0.7 0;
  radius: 0.35;
  color: #ff5a36;
}
```

### a dissolve

Moving the stops of the `noise()` dissolves the sphere.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.8;
  color: #ff5a36;
  mask-image: noise(4 3, black 20%, transparent 20%);
  animation: dissolve 3s ease-in-out alternate;
}

@keyframes dissolve {
  to {
    mask-image: noise(4 3, black 80%, transparent 80%);
  }
}
```

<a name="mask-mode"></a>

## `mask-mode`

Which part of `mask-image` counts, like CSS.

- **Syntax:** `alpha | luminance | match-source`
- **Initial value:** `match-source`
- **Applies to:** objects
- **Animatable:** no

### Values

- **match-source:** The default: a gradient counts by its alpha, like CSS.
- **alpha:** The transparency of its colors: black and white are both there.
- **luminance:** Their brightness, times their alpha, like an SVG mask: white is there, black is a hole.

### a cage, with luminance

White stripes stay, black ones are holes: the sphere shows between the bars.

```css
@scene {
  cube;
  sphere;
}

cube {
  translate: 0 0.7 0;
  size: 1.4;
  mask-image: repeating-linear-gradient(90deg, white 0% 10%, black 10% 20%);
  mask-mode: luminance;
}

sphere {
  translate: 0 0.7 0;
  radius: 0.45;
  color: #ff5a36;
}
```

<a name="opacity"></a>

## `opacity`

How much the object covers what is behind it, like CSS: from 0, invisible, to 1, opaque (the default), as a number or a percentage; a value outside is kept between them. The alpha of its `color` and `opacity()` in `filter` multiply with it.

- **Syntax:** `<number> | <percentage>`
- **Initial value:** `1`
- **Applies to:** objects
- **Animatable:** yes

Through a transparent object, the eye sees its back face from the inside, then what is behind it: a sphere at 50% looks like a bubble. On a group, the opacity goes into each of its objects: unlike CSS, which fades a group as one picture, its objects show through each other. With `shadows`, the light goes through a transparent object like stained glass: a red glass at 50% casts a pink light. The mouse still points at a transparent object, like CSS, and the reflections show it opaque.

### a bubble

A sphere at 35%, with another one inside.

```css
@scene {
  sphere#bubble;
  sphere#core;
}

#bubble {
  translate: 0 1 0;
  radius: 0.8;
  color: #9fd8ff;
  opacity: 0.35;
}

#core {
  translate: 0 1 0;
  radius: 0.3;
  color: #ff5a36;
}
```

### fading on :hover

The cube fades to 25% under the mouse.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  size: 1.2;
  color: #3a7bff;
  transition: 0.4s;
}

cube:hover {
  opacity: 0.25;
}
```

### a colored shadow

A red pane at 50% casts a pink light.

```css
@scene {
  cube;
  sphere;
}

scene {
  shadows: soft;
  light: 30deg 55deg;
}

cube {
  translate: 0 0.9 0;
  size: 1.2 2.2 0.05;
  color: #ff2a2a;
  opacity: 0.5;
  animation: move 5s ease alternate;
}

sphere {
  translate: 0.9 0.4 -1;
  radius: 0.4;
}

@keyframes move {
  to {
    translate: 1 0.9 0;
  }
}
```

<a name="outline"></a>

## `outline`

A line around the silhouette of the object, like CSS `outline`: a width, a style and a color, in any order. Like CSS, it needs a style: `outline: 0.03 solid #111;`, or `dashed`, `dotted`, `double`…

- **Syntax:** `<outline-width> || <outline-style> || <outline-color>`
- **Initial value:** `medium none currentColor`
- **Applies to:** objects
- **Animatable:** yes

The line is drawn outside the object, where the eye passes close to its edge, and over what is behind it: another object, the floor or the background. It takes no room, is never lit and cannot be pointed at, like CSS, but the fog covers it. Unlike CSS, its width is in the units of the scene, not in pixels: it gets thinner far from the camera, like the object. `outline-width`, `outline-style`, `outline-color` and `outline-offset` set one part each, and win over `outline` wherever they are written, like the other longhands of GSS. It changes on `:hover` and in `@keyframes`.

### a drawn look

Dark lines around matte shapes, like a drawing.

```css
@scene {
  sphere;
  cube;
  torus;
}

* {
  outline: 0.03 solid #1a1a1a;
}

sphere {
  translate: -1.3 0.6 0;
  radius: 0.6;
  color: #ffd166;
}

cube {
  translate: 0 0.5 0;
  color: #ef476f;
  rotate-y: 30deg;
}

torus {
  translate: 1.4 0.6 0;
  rotate-x: 70deg;
  radius: 0.5;
  thickness: 0.18;
  color: #06d6a0;
}
```

### outlined under the mouse

Hovering the cube draws its outline, which glides in.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  color: #3a7bff;
  outline: 0 solid #ff5a36;
  transition: 0.25s;
  cursor: pointer;
}

cube:hover {
  outline-width: 0.06;
}
```

<a name="outline-color"></a>

## `outline-color`

The color of the line of `outline`. Like CSS, it is the object's own `color` by default; a gradient gives the mean of its colors.

- **Syntax:** `<color>`
- **Initial value:** `currentColor`
- **Applies to:** objects
- **Animatable:** yes

### a line that changes color

The outline goes from orange to blue and back.

```css
@scene {
  torus;
}

torus {
  translate: 0 0.8 0;
  rotate-x: 70deg;
  radius: 0.6;
  thickness: 0.2;
  color: #f4f4f6;
  outline: 0.04 solid #ff5a36;
  animation: hue 3s ease-in-out alternate;
}

@keyframes hue {
  to {
    outline-color: #3a7bff;
  }
}
```

<a name="outline-offset"></a>

## `outline-offset`

The gap between the object and the line of `outline`, in the units of the scene, like CSS: the line starts this far from the surface.

- **Syntax:** `<number>`
- **Initial value:** `0`
- **Applies to:** objects
- **Animatable:** yes

### a halo

The line floats away from the sphere and back.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.5;
  color: #ffd166;
  outline: 0.02 solid #ffd166;
  animation: halo 2s ease-in-out alternate;
}

@keyframes halo {
  to {
    outline-offset: 0.25;
  }
}
```

<a name="outline-style"></a>

## `outline-style`

How the line of `outline` is drawn, like CSS: `none`, the default, draws none; the others draw a line, plain, broken or shaded.

- **Syntax:** `none | auto | solid | dashed | dotted | double | groove | ridge | inset | outset`
- **Initial value:** `none`
- **Applies to:** objects
- **Animatable:** no

### Values

- **none:** No line, the default: an `outline` needs a style.
- **solid:** One plain line.
- **auto:** In CSS, the browser draws its own line, the one of a focused field. GSS has no browser look of its own: `auto` draws `solid`.
- **dashed:** Dashes three widths long, with gaps as long, all around the object.
- **dotted:** Round dots, as wide as the line, one width apart.
- **double:** Two thin lines, each a third of the width, with the third between them empty.
- **groove:** Carved into the scene: the outer half darker at the top left, the inner half at the bottom right.
- **ridge:** Raised out of the scene: `groove` the other way.
- **inset:** The line darker at the top left, as if the object sat in a hollow.
- **outset:** The line darker at the bottom right, as if the object stood out.

Dashes and dots are placed around the object, by the angle seen from the camera, and as many as fit around its size: they close without a broken one. The shaded styles take the light from the top left of the screen, like the borders of CSS, at half the color on their dark side. A `:hover` or `:active` rule can change the style; `@keyframes` cannot. When the object has no style at rest, the one of `:hover`, then of `:active`, is drawn.

### every style

Eight spheres, one style each, from left to right: solid, dashed, dotted, double, groove, ridge, inset and outset.

```css
@scene {
  sphere * 8;
}

scene {
  background: #14141c;
  camera-distance: 9;
}

sphere {
  radius: 0.4;
  translate: calc(sibling-index() * 1.05 - 4.7) 0.5 0;
  color: #f4f4f6;
  outline: 0.08 solid #ff5a36;
}

sphere:nth-child(2) {
  outline-style: dashed;
}

sphere:nth-child(3) {
  outline-style: dotted;
}

sphere:nth-child(4) {
  outline-style: double;
}

sphere:nth-child(5) {
  outline-style: groove;
}

sphere:nth-child(6) {
  outline-style: ridge;
}

sphere:nth-child(7) {
  outline-style: inset;
}

sphere:nth-child(8) {
  outline-style: outset;
}
```

### dashes on hover

Hovering the cube draws a dashed line around it.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  color: #3a7bff;
  outline-style: dashed;
  outline-width: 0;
  outline-color: #ff5a36;
  transition: 0.25s;
  cursor: pointer;
}

cube:hover {
  outline-width: 0.05;
  outline-offset: 0.05;
}
```

### solid

The style alone draws a medium line of the object's own color.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  color: #3a7bff;
  outline-style: solid;
  outline-offset: 0.06;
}
```

<a name="outline-width"></a>

## `outline-width`

How wide the line of `outline` is, in the units of the scene, unlike CSS pixels: `thin` is 0.01, `medium` 0.02 and `thick` 0.04.

- **Syntax:** `<number> | thin | medium | thick`
- **Initial value:** `medium`
- **Applies to:** objects
- **Animatable:** yes

### a thick line

A wide white line around a sphere.

```css
@scene {
  sphere;
}

scene {
  background: #14141c;
}

sphere {
  translate: 0 1 0;
  radius: 0.6;
  color: #ff5a36;
  outline-style: solid;
  outline-color: white;
  outline-width: 0.08;
}
```

<a name="visibility"></a>

## `visibility`

`hidden` hides the object, like CSS: it is not drawn, casts no shadow, and the mouse goes through it. `collapse` is `hidden`, as in CSS outside tables.

- **Syntax:** `visible | hidden | collapse`
- **Initial value:** `visible`
- **Applies to:** objects
- **Animatable:** yes

Like CSS, it is inherited: a hidden group hides its objects, and an object inside it can be `visible` again. It changes on `:hover` and in `@keyframes`, at once, like CSS: between `visible` and `hidden`, the object is there for the whole way, and gone only at `hidden`. A hidden object cannot be hovered: hide another object, like `#button:hover #label`. A group's own visibility is read when the scene compiles.

### a light that blinks

The sphere is gone for the second half of each second.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.5;
  material: emissive(#ff5a36);
  animation: blink 1s step-end;
}

@keyframes blink {
  50% {
    visibility: hidden;
  }
}
```

### shown under the mouse

Hovering the cube shows the sphere above it.

```css
@scene {
  group#g {
    cube;
    sphere;
  }
}

#g {
  translate: 0 0.5 0;
}

sphere {
  translate: 0 1.2 0;
  radius: 0.3;
  color: #ff5a36;
  visibility: hidden;
}

#g:hover sphere {
  visibility: visible;
}
```

### one visible in a hidden group

The group is hidden, but its sphere says `visible`.

```css
@scene {
  group#g {
    cube * 3;
    sphere;
  }
}

#g {
  visibility: hidden;
  translate: 0 0.6 0;
}

cube {
  size: 0.5;
  translate: calc(sibling-index() - 2) 0 0;
}

sphere {
  visibility: visible;
  radius: 0.4;
  color: #ff5a36;
}
```

---

Next: [Transforms](transforms.md)
