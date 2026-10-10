<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Structure

# Shapes and groups

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#shapes).

<a name="shape-capsule"></a>

## `capsule`

A cylinder with round ends, standing on the y axis and centered on its origin: a `radius` of 0.25 and a `height` of 1 by default, round ends included.

- **Own properties:** [`radius`](object-properties.md#radius), [`height`](object-properties.md#height)
- **Also:** [geometry properties](object-properties.md)

### a capsule on the floor

```css
@scene {
  capsule;
}

capsule {
  translate: 0 0.5 0;
}
```

<a name="shape-cone"></a>

## `cone`

A cone standing on the y axis, centered on its origin, pointing up: a `radius` of 0.5 and a `height` of 1 by default. A second radius cuts its top.

- **Own properties:** [`radius`](object-properties.md#radius), [`height`](object-properties.md#height)
- **Also:** [geometry properties](object-properties.md)

### a cone on the floor

```css
@scene {
  cone;
}

cone {
  translate: 0 0.5 0;
}
```

<a name="shape-cube"></a>

## `cube`

A box with slightly rounded edges, centered on its origin: 1 × 1 × 1 by default. `size` stretches it into any box, and `corner-radius` rounds its edges.

- **Own properties:** [`size`](object-properties.md#size), [`corner-radius`](object-properties.md#corner-radius)
- **Also:** [geometry properties](object-properties.md)

### a cube on the floor

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}
```

<a name="shape-cylinder"></a>

## `cylinder`

A cylinder standing on the y axis, centered on its origin: a `radius` of 0.5 and a `height` of 1 by default.

- **Own properties:** [`radius`](object-properties.md#radius), [`height`](object-properties.md#height)
- **Also:** [geometry properties](object-properties.md)

### a cylinder on the floor

```css
@scene {
  cylinder;
}

cylinder {
  translate: 0 0.5 0;
}
```

<a name="shape-group"></a>

## `group`

Not a shape: it holds objects and other groups, like `<g>` in SVG, and draws nothing itself. Its `translate`, rotations and `scale` apply to everything inside it, and the positions of its children become relative to it.

- **Takes:** [`display`](masks.md#display), [`visibility`](masks.md#visibility), [`cursor`](pseudo-classes.md#cursor), [`filter`](filters.md#filter), [`translate`](transforms.md#translate), [`rotate-x`](transforms.md#rotate-x), [`rotate-y`](transforms.md#rotate-y), [`rotate-z`](transforms.md#rotate-z), [`scale`](transforms.md#scale), [`transform-origin`](transforms.md#transform-origin), [`animation`](animations.md#animation), [`animation-duration`](animations.md#animation-duration), [`animation-delay`](animations.md#animation-delay), [`animation-iteration-count`](animations.md#animation-iteration-count), [`animation-direction`](animations.md#animation-direction), [`animation-fill-mode`](animations.md#animation-fill-mode), [`animation-timing-function`](animations.md#animation-timing-function), [`animation-timeline`](animations.md#animation-timeline), [`animation-range`](animations.md#animation-range), [`animation-range-start`](animations.md#animation-range-start), [`animation-range-end`](animations.md#animation-range-end), [`offset-path`](transforms.md#offset-path), [`offset-distance`](transforms.md#offset-distance), [`offset-rotate`](transforms.md#offset-rotate)

Its other properties (`color`, `material`, `size`…) are not passed down to its children: to style them, use a descendant selector, like `#letters cube`.

### letters moved as one

The group places and turns its three cubes together.

```css
@scene {
  group#letters {
    cube#l;
    cube#u;
    cube#c;
  }
}

#letters {
  translate: 1 0.5 0;
  rotate-y: -20deg;
}

#letters cube {
  size: 0.3 1 0.3;
  color: #ff5a36;
}

#u {
  translate: -1 0 0;
}

#c {
  translate: -2 0 0;
}
```

### a group that turns

An animation on the group turns both spheres around its center.

```css
@scene {
  group#spin {
    sphere#a;
    sphere#b;
  }
}

#spin {
  translate: 0 0.6 0;
  animation: turn 4s linear;
}

#a {
  translate: 0.8 0 0;
  radius: 0.4;
}

#b {
  translate: -0.8 0 0;
  radius: 0.4;
}

@keyframes turn {
  to {
    rotate-y: -1turn;
  }
}
```

<a name="shape-lathe"></a>

## `lathe`

A contour, filled, then turned around the vertical axis, like clay on a potter's wheel: a vase, a bowl, a bottle, a chess piece. A `prism` pushes its contour straight back into a flat plate; a lathe turns it into an object that is round from every side. The contour is a `polygon()` or a `path()` (see `d`), drawn right of the axis x = 0.

- **Own properties:** [`d`](object-properties.md#d), [`view-box`](object-properties.md#view-box)
- **Also:** [geometry properties](object-properties.md)

Draw half the outline: x is the distance from the axis, and y goes down, like SVG. A contour that does not touch the axis turns into a ring, and a contour inside another one is a hole. The height is centered on the contours (or on the `view-box`), and y goes up in the scene, like a path. Seen from the front, a prism and a lathe of the same contour can look alike; turned, the prism is a cut-out as thick as its `depth`, and the lathe stays round.

### a lathe and a prism of the same contour

Both turned by 60deg: the lathe, on the left, is a vase from every side; the prism is a flat plate.

```css
@scene {
  lathe;
  prism;
}

lathe,
prism {
  d: path("M0 -1 H0.35 C0.35 -0.7 0.2 -0.6 0.2 -0.4 C0.2 0 0.75 0.3 0.6 0.7 C0.55 0.9 0.45 1 0 1 Z");
  rotate-y: 60deg;
  color: #c8643c;
}

lathe {
  translate: -0.9 1 0;
}

prism {
  translate: 0.9 1 0;
  depth: 0.3;
}
```

### a vase

A `path()` of three curves, from the neck to the foot, closed along the axis.

```css
@scene {
  lathe;
}

lathe {
  translate: 0 1 0;
  d: path("M0 -1 H0.35 C0.35 -0.7 0.2 -0.6 0.2 -0.4 C0.2 0 0.75 0.3 0.6 0.7 C0.55 0.9 0.45 1 0 1 Z");
  color: #c8643c;
}
```

### a bowl

The contour goes up the outer wall and comes down the inner one: the bowl is hollow.

```css
@scene {
  lathe;
}

lathe {
  translate: 0 0.4 0;
  d: path("M0 0.4 H0.35 C0.9 0.4 1 0 1 -0.4 H0.92 C0.92 0.05 0.75 0.3 0.3 0.3 H0 Z");
  color: #f2efe8;
}
```

### a ring

A square away from the axis: once turned, a ring with a hole in its middle.

```css
@scene {
  lathe;
}

lathe {
  translate: 0 0.15 0;
  d: polygon(0.6 -0.15, 1 -0.15, 1 0.15, 0.6 0.15);
  material: gold;
}
```

<a name="shape-octahedron"></a>

## `octahedron`

Eight triangles, two pyramids joined by their bases, like a die with eight faces: a `radius` of 0.5 by default, from its center to each tip.

- **Own properties:** [`radius`](object-properties.md#radius)
- **Also:** [geometry properties](object-properties.md)

### a turning crystal

```css
@scene {
  octahedron;
}

octahedron {
  translate: 0 1 0;
  radius: 0.7;
  material: glass(#bfe8ff, 1.5);
  animation: turn 8s linear infinite;
}

@keyframes turn {
  to {
    rotate-y: 360deg;
  }
}
```

<a name="shape-path"></a>

## `path`

A tube with round ends that follows an SVG path, given by `d`. `stroke-width` and `view-box` work like in SVG.

- **Own properties:** [`d`](object-properties.md#d), [`stroke-width`](object-properties.md#stroke-width), [`view-box`](object-properties.md#view-box)
- **Also:** [geometry properties](object-properties.md)

### a curve

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

<a name="shape-plane"></a>

## `plane`

A thin, flat rectangle lying in the xz plane, centered on its origin: 1 × 1 by default. `size` sets its width and its depth, and `rotate-x: 90deg` stands it up, like a wall.

- **Own properties:** [`size`](object-properties.md#size)
- **Also:** [geometry properties](object-properties.md)

### a mat on the floor

```css
@scene {
  plane;
}

plane {
  translate: 0 0.01 0;
  size: 3 2;
  color: #3ad16b;
}
```

<a name="shape-prism"></a>

## `prism`

A contour, filled, then given a `depth`: a flat object, like a star, a letter, an arrow, a logo. The contour is a `polygon()` or a `path()` (see `d`), and a contour inside another one is a hole.

- **Own properties:** [`d`](object-properties.md#d), [`depth`](object-properties.md#depth), [`view-box`](object-properties.md#view-box)
- **Also:** [geometry properties](object-properties.md)

It stands in the xy plane, facing the camera, centered on its contours (or on its `view-box`), like a path. To make a round object of a contour, like a vase or a bowl, turn it with a `lathe` instead.

### a gold star

A star, from a `polygon()` of ten points.

```css
@scene {
  prism;
}

prism {
  translate: 0 1 0;
  d: polygon(0 -1, -0.25 -0.34, -0.95 -0.31, -0.4 0.13, -0.59 0.81, 0 0.42, 0.59 0.81, 0.4 0.13, 0.95 -0.31, 0.25 -0.34);
  depth: 0.3;
  material: gold;
}
```

### a square with a round hole

A `path()` with two contours: the circle inside the square is a hole.

```css
@scene {
  prism;
}

prism {
  translate: 0 1 0;
  d: path("M-1 -1 H1 V1 H-1 Z M0 -0.6 A0.6 0.6 0 1 1 0 0.6 A0.6 0.6 0 1 1 0 -0.6 Z");
  depth: 0.4;
  color: #ff5a36;
}
```

<a name="shape-pyramid"></a>

## `pyramid`

A pyramid on a square base, pointing up, centered on its origin: a base of 1 by 1 and a height of 1 by default. `size` sets the width and the depth of its base, and its height, like the box of a cube.

- **Own properties:** [`size`](object-properties.md#size)
- **Also:** [geometry properties](object-properties.md)

### a pyramid on the floor

```css
@scene {
  pyramid;
}

pyramid {
  translate: 0 0.5 0;
  rotate-y: 30deg;
  color: #e8c06a;
}
```

### a tall pyramid

`size: 1 2 1`: the same base, twice as high.

```css
@scene {
  pyramid;
}

pyramid {
  translate: 0 1 0;
  size: 1 2 1;
  rotate-y: 20deg;
}
```

<a name="shape-sphere"></a>

## `sphere`

A ball centered on its origin, with a `radius` of 0.5 by default.

- **Own properties:** [`radius`](object-properties.md#radius)
- **Also:** [geometry properties](object-properties.md)

### a sphere on the floor

```css
@scene {
  sphere;
}

sphere {
  translate: 0 0.5 0;
}
```

<a name="shape-torus"></a>

## `torus`

A ring lying flat around the y axis: a `radius` of 1 to the center of its tube, and a tube of 0.28 by default, set by `thickness`.

- **Own properties:** [`radius`](object-properties.md#radius), [`thickness`](object-properties.md#thickness)
- **Also:** [geometry properties](object-properties.md)

### a torus on the floor

```css
@scene {
  torus;
}

torus {
  translate: 0 0.28 0;
}
```

<a name="shape-tube"></a>

## `tube`

A hollow cylinder, a pipe, standing on the y axis and centered on its origin: an outer `radius` of 0.5, a `height` of 1 and a wall 0.1 `thickness` thick by default.

- **Own properties:** [`radius`](object-properties.md#radius), [`thickness`](object-properties.md#thickness), [`height`](object-properties.md#height)
- **Also:** [geometry properties](object-properties.md)

Not a `path`: a `path` draws a tube along any line, while `tube` is a straight pipe, open at both ends, whose wall has a thickness. The wall goes inside the radius, so the tube keeps its outer size when the wall gets thicker.

### a pipe

```css
@scene {
  tube;
}

tube {
  translate: 0 0.5 0;
  rotate-x: 70deg;
  material: copper;
}
```

### a ring, from a short tube

`height: 0.2` and a thick wall make a flat ring.

```css
@scene {
  tube;
}

tube {
  translate: 0 0.6 0;
  rotate-x: 80deg;
  radius: 0.6;
  height: 0.2;
  thickness: 0.25;
  color: #ff5a36;
}
```

---

Next: [Geometry](object-properties.md)
