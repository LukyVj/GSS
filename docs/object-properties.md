<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Structure

# Geometry

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#object-properties).

<a name="corner-radius"></a>

## `corner-radius`

Rounds the edges of a cube; 0 keeps them sharp.

- **Syntax:** `<number>`
- **Initial value:** `0.08`
- **Applies to:** cube
- **Animatable:** no

### rounded edges

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  corner-radius: 0.3;
}
```

<a name="d"></a>

## `d`

The line a `path` follows, written like the `d` of an SVG path or CSS `path()`. On a `prism`, the contour to fill; on a `lathe`, the contour to turn around its axis: a `polygon()` or a `path()`.

- **Syntax:** `path("<svg path>") | polygon(<x> <y>, …) (prism, lathe)`
- **Initial value:** `none (required)`
- **Applies to:** path, prism, lathe
- **Animatable:** no

### Commands

- **M:** Moves, without drawing.
- **L, H, V:** A line; a horizontal line; a vertical line.
- **C, S, Q, T:** Curves, like SVG.
- **A:** An arc of ellipse: `rx ry rotation large-arc sweep x y`, like SVG.
- **Z:** Closes the path.
- **polygon():** On a prism or a lathe: one point per comma, x and y separated by a space, y going down, like CSS `clip-path`. It closes itself.

Capitals are absolute, lowercase letters relative. A path copied from an SVG keeps its way up: y goes down in SVG and up in the scene, and GSS flips it. One path unit is one scene unit, so an icon drawn in a box of 24 or 32 usually needs a `scale`. On a prism or a lathe, each subpath of a `path()` is a closed contour, filled with the even-odd rule: a contour inside another one is a hole, like the inside of an o. A lathe turns its contour around x = 0, so its x are never negative.

### a curve

One cubic curve, `C`.

```css
@scene {
  path;
}

path {
  translate: 0 1 0;
  d: path("M-1 0.5 C-1 -1 1 -1 1 0.5");
  stroke-width: 0.25;
  color: #ff5a36;
}
```

### a zigzag, scaled down

Lines drawn 4 units wide, shown at half size by `scale`.

```css
@scene {
  path;
}

path {
  translate: 0 1.2 0;
  d: path("M0 0 L1 1.5 L2 0 L3 1.5 L4 0");
  stroke-width: 0.3;
  scale: 0.5;
  material: gold;
}
```

### a smiley

Two arcs draw the face, a third one the smile.

```css
@scene {
  path;
}

path {
  translate: 0 1 0;
  d: path("M-1 0 A1 1 0 1 1 1 0 A1 1 0 1 1 -1 0 M-0.4 -0.3 A0.5 0.5 0 0 0 0.4 -0.3");
  stroke-width: 0.15;
  color: #ff5a36;
}
```

### a thick line

One straight line, with a wide `stroke-width`.

```css
@scene {
  path;
}

path {
  translate: 0 1 0;
  d: path("M-1 0 L1 0");
  stroke-width: 0.6;
  color: #3a7bff;
}
```

<a name="depth"></a>

## `depth`

The full thickness of a prism along the z axis, centered on its origin: `depth: 1` goes from z = -0.5 to z = 0.5.

- **Syntax:** `<number>`
- **Initial value:** `0.2`
- **Applies to:** prism
- **Animatable:** no

### a triangle, 1 deep

```css
@scene {
  prism;
}

prism {
  translate: 0 1 0;
  d: polygon(0 -1, 1 1, -1 1);
  depth: 1;
  color: #ff5a36;
}
```

<a name="height"></a>

## `height`

Sets the full height of a cylinder, a cone or a capsule, along the y axis. The shape is centered on its origin: to stand it on the floor, set its y to half its height.

- **Syntax:** `<number>`
- **Initial value:** `1`
- **Applies to:** cylinder, cone, capsule, tube
- **Animatable:** no

The height of a capsule counts its round ends, so it is at least twice its radius.

### a tall cylinder

```css
@scene {
  cylinder;
}

cylinder {
  translate: 0 1 0;
  radius: 0.4;
  height: 2;
}
```

### a cone

```css
@scene {
  cone;
}

cone {
  translate: 0 0.75 0;
  radius: 0.5 0.2;
  height: 1.5;
}
```

### a capsule

1.5 high, round ends included.

```css
@scene {
  capsule;
}

capsule {
  translate: 0 0.75 0;
  radius: 0.25;
  height: 1.5;
}
```

<a name="radius"></a>

## `radius`

Sets the radius of a sphere, a cylinder or a capsule, or that of a torus ring, measured to the center of its tube. On an octahedron, from its center to each tip; on a tube, its outer radius.

- **Syntax:** `<number> | <number> <number> (cone: bottom top)`
- **Initial value:** `0.5 (sphere), 1 (torus), 0.5 (cylinder), 0.5 0 (cone), 0.25 (capsule), 0.5 (octahedron), 0.5 (tube)`
- **Applies to:** sphere, torus, cylinder, cone, capsule, octahedron, tube
- **Animatable:** no

A cone takes a bottom and a top radius, like `border-radius` takes several values: the top one is 0 by default, a point, and a positive one cuts the top.

### a big sphere

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 1;
}
```

### a cut cone

`radius: 0.5 0.2`: a wide base, a narrow top.

```css
@scene {
  cone;
}

cone {
  translate: 0 0.75 0;
  radius: 0.5 0.2;
  height: 1.5;
}
```

<a name="size"></a>

## `size`

Sets the size of a cube along the x, y and z axes: one value makes a cube, three make a box. On a pyramid, the width and the depth of its base, and its height in the middle. On a plane, it sets the width and the depth: one value makes a square.

- **Syntax:** `<number>{1,3} (cube, pyramid) | <number>{1,2} (plane: width depth)`
- **Initial value:** `1 (cube), 1 (plane), 1 (pyramid)`
- **Applies to:** cube, plane, pyramid
- **Animatable:** no

### a box

Twice as wide as it is high.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  size: 2 1 1;
}
```

### a plane, stood up

A width and a depth, on a plane turned like a wall.

```css
@scene {
  plane;
}

plane {
  translate: 0 1 0;
  rotate-x: 90deg;
  size: 2 1.5;
  color: #ff5a36;
}
```

<a name="stroke-width"></a>

## `stroke-width`

The thickness of the tube along the path, in path units, like the `stroke-width` of SVG. Its ends are round.

- **Syntax:** `<number>`
- **Initial value:** `1`
- **Applies to:** path
- **Animatable:** no

### a thick line

```css
@scene {
  path;
}

path {
  translate: 0 1 0;
  d: path("M-1 0 L1 0");
  stroke-width: 0.6;
  color: #3a7bff;
}
```

<a name="thickness"></a>

## `thickness`

Sets the radius of the tube of a torus, or the thickness of the wall of a tube, inside its radius.

- **Syntax:** `<number>`
- **Initial value:** `0.28 (torus), 0.1 (tube)`
- **Applies to:** torus, tube
- **Animatable:** no

### a thick ring

```css
@scene {
  torus;
}

torus {
  translate: 0 0.5 0;
  thickness: 0.5;
}
```

<a name="view-box"></a>

## `view-box`

The drawing area of a path: x, y, width and height, like the `viewBox` of SVG. Its center becomes the origin of the object.

- **Syntax:** `<number>{4}`
- **Initial value:** `the box of the path itself`
- **Applies to:** path, prism, lathe
- **Animatable:** no

Without it, each path is centered on itself; with the same `view-box`, the paths copied from one SVG keep their places relative to each other. On a lathe, only its y and its height count: the height is centered on them, and x = 0 stays the axis.

### two braces of one icon

Both paths share the 32 × 32 box of their icon, and keep their places.

```css
@scene {
  path#left;
  path#right;
}

path {
  translate: 0 1.6 0;
  view-box: 0 0 32 32;
  stroke-width: 2.4;
  scale: 0.1;
  color: #e6e6e6;
}

#left {
  d: path("M12.5 4.5C9.5 4.5 9 6 9 8.5v4c0 2-1 3.5-3.5 3.5C8 16 9 17.5 9 19.5v4c0 2.5.5 4 3.5 4");
}

#right {
  d: path("M19.5 4.5C22.5 4.5 23 6 23 8.5v4c0 2 1 3.5 3.5 3.5C24 16 23 17.5 23 19.5v4c0 2.5-.5 4-3.5 4");
}
```

---

Next: [Combinations](combinations.md)
