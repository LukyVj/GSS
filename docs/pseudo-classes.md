<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Language

# Pseudo-classes and cursor

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#pseudo-classes).

<a name="selector-hover"></a>

## `:hover`

A pseudo-class, like CSS: the rule applies while the mouse is over the object. With `transition`, the change glides instead of jumping.

- **Specificity:** 100, like a class, added to the rest

### Where it goes

- **cube:hover.big:** Anywhere after the shape name.
- **sphere:hover + cube:** On an earlier sibling: the cube reacts to the sphere.
- **#letters:hover cube:** On a group: every cube of `#letters` reacts as soon as the mouse is over any object of the group, like hovering a child hovers its parent in CSS.
- **#g:has(sphere:hover):** Inside `:has()`: hovering one object changes another.

The `:hover` rules join the cascade like any other: `#a { color: blue; }` beats `cube:hover { color: red; }`, and a normal `!important` beats them all. A `:hover` rule changes animatable properties only (the transforms, `color`, `opacity`, `mask-image`, `offset-distance` and variables), never a face, and it styles objects, not groups: write `#g:hover cube`, not `#g:hover { … }`. It can also start an `animation`: it begins when the pointer arrives and plays to its end, pointer gone or not (see `:active`).

### lift on hover

Each cube rises, rotates and turns red under the mouse.

```css
@scene {
  cube#a;
  cube#b;
}

cube {
  translate: 0.8 0.5 0;
  color: #e6e6e6;
}

#b {
  translate: -0.8 0.5 0;
}

cube:hover {
  translate: 0.8 1 0;
  color: #ff5a36;
  rotate-y: -45deg;
}

#b:hover {
  translate: -0.8 1 0;
}
```

### hover a group

The mouse over any letter lights up every letter of `#letters`.

```css
@scene {
  group#letters {
    cube#l1;
    cube#l2;
    cube#l3;
  }
  sphere;
}

#letters {
  translate: 1.6 0.5 0;
}

#letters cube {
  size: 0.4 1 0.4;
  color: #e6e6e6;
}

#l2 {
  translate: -0.7 0 0;
}

#l3 {
  translate: -1.4 0 0;
}

#letters:hover cube {
  color: #ff5a36;
  scale: 1.15;
}

sphere {
  translate: -1.4 0.5 0;
  radius: 0.5;
}
```

<a name="selector-active"></a>

## `:active`

A pseudo-class, like CSS: the rule applies while the object is pressed, with the mouse button or a finger. Like CSS, it stays pressed until the button goes up, even if the pointer leaves it.

- **Specificity:** 100, like a class, added to the rest

### Where it goes

- **#button:active:** On the object pressed.
- **sphere:active + cube:** On an earlier sibling.
- **#g:active cube:** On a group: every cube of `#g` is pressed when any of its objects is.
- **#lamp:has(#switch:active) #bulb:** Inside `:has()`: press one object, change another.

A pressed object is under the pointer, so its `:hover` rules still apply, and `:active` wins over them at equal specificity when written after them: `cube:hover { scale: 1.1; } cube:active { scale: 0.95; }` grows under the mouse and sinks when clicked. Like `:hover`, it changes animatable properties only, and styles objects, not groups. With `transition`, pressing takes the transition of the `:active` rule, and releasing the one of the hovered state. An `animation` in a `:active` rule starts at the press and plays to its end, released or not, like a button that fires: once, unless it says how many times; the pressed state stays on until the animation ends, or for good with `forwards`, and the next press plays it again.

### a button that sinks when pressed

It rises under the mouse, and sinks quickly while pressed.

```css
@scene {
  cube#button;
}

#button {
  size: 1.2 0.3 1.2;
  corner-radius: 0.1;
  translate: 0 0.15 0;
  color: #e6e6e6;
  transition: 0.25s ease-out;
}

#button:hover {
  color: #ff5a36;
  translate: 0 0.25 0;
}

#button:active {
  translate: 0 0.05 0;
  color: #c2401f;
  transition: 0.06s;
}
```

### a click starts an animation

The press starts the fall, which plays to its end even once the button is up; `forwards` keeps the cube down, and the next click plays it again.

```css
@scene {
  cube;
}

cube {
  size: 0.6 1.6 0.6;
  translate: 0 0.8 0;
  color: #ff5a36;
}

cube:active {
  animation: topple 0.8s ease-in forwards;
}

@keyframes topple {
  to {
    rotate-z: -90deg;
    translate: -0.8 0.3 0;
  }
}
```

### press one, move another

Pressing the switch lights the bulb, through `:has()`.

```css
@scene {
  group#lamp {
    cylinder#switch;
    sphere#bulb;
  }
}

#switch {
  radius: 0.3;
  height: 0.2;
  translate: 0.8 0.1 0;
  color: #888888;
}

#switch:active {
  scale: 0.9;
}

#bulb {
  radius: 0.45;
  translate: -0.6 0.6 0;
  color: #555555;
  transition: 0.4s ease-out;
}

#lamp:has(#switch:active) #bulb {
  color: #ffd27a;
  scale: 1.15;
}
```

<a name="selector-has"></a>

## `:has()`

A pseudo-class, like CSS: a group matches when something inside it, at any depth, matches the selector in the parentheses. With `:hover` inside, hovering one object can change another.

- **Specificity:** the most specific selector inside, added to the rest, like CSS

### Forms

- **#g:has(sphere):** The groups that hold a sphere, read once, when the scene compiles.
- **#g:has(sphere:hover):** While a sphere of `#g` is under the mouse.
- **#g:has(#inner sphere):** A descendant selector, read from the group down.
- **#g:has(sphere, cube):** A list: one match is enough.
- **group:has(> sphere):** A leading combinator, relative to the subject: here, direct children.
- **cube:has(+ sphere):** The next sibling, or any later one with `~`. Chains work too: `cube:has(+ group > sphere)`.

Without a leading sibling combinator, `:has()` goes on a group: an object holds nothing, so `cube:has(sphere)` is an error. Empty groups can match, and a `:has()` cannot hold another one. Unlike CSS, a list that mixes a static selector with `:hover` matches only during a hover.

### the groups that hold a sphere

Only the cube of `#a`, the group with a sphere, turns blue.

```css
@scene {
  group#a {
    sphere#sa;
    cube#ca;
  }
  group#b {
    cube#cb;
  }
}

#a {
  translate: 1 0 0;
}

#b {
  translate: -1 0 0;
}

sphere {
  translate: 0 1.4 0;
  radius: 0.3;
}

cube {
  translate: 0 0.5 0;
  color: #e6e6e6;
}

group:has(sphere) cube {
  color: #3a7bff;
}
```

### the next sibling, under the mouse

The cube reacts when the sphere right after it is hovered.

```css
@scene {
  cube;
  sphere;
}

cube {
  translate: 0.8 0.5 0;
  transition: 0.3s ease-out;
}

sphere {
  translate: -0.8 0.5 0;
  radius: 0.4;
}

cube:has(+ sphere:hover) {
  color: #ff5a36;
  scale: 1.2;
}
```

### hover one object, change another

Hovering the bulb changes the stand of the same lamp.

```css
@scene {
  group#lamp {
    sphere#bulb;
    cylinder#stand;
  }
}

#bulb {
  translate: 0 1.6 0;
  radius: 0.35;
  color: #e6e6e6;
}

#stand {
  translate: 0 0.6 0;
  radius: 0.08;
  height: 1.2;
  color: #888888;
  transition: 0.3s ease-out;
}

#lamp:has(#bulb:hover) #stand {
  color: #ff5a36;
  scale: 1.2;
}
```

<a name="selector-not"></a>

## `:not()`

A pseudo-class, like CSS: the object matches when none of the selectors in the parentheses does. `cube:not(.red)` is every cube without the class `red`.

- **Specificity:** its most specific selector, added to the rest, like CSS

### Forms

- **:not(.red, torus):** A list: leaves out both.
- **cube:not(#g cube):** Any selector, read from the object outwards: every cube outside `#g`.
- **cube:not(:first-child, :last-child):** The cubes in the middle.
- **group:not(:has(sphere)):** The groups without a sphere.
- **:not(.a):not(.b):** Several in a row.

It weighs like the most specific selector of its list, like CSS: `cube:not(#hero)` beats `#hero` alone. It is read once, when the scene compiles: it cannot hold `:hover` or a face.

### every cube but the red ones

Every cube rises, except the two `.red` ones.

```css
@scene {
  cube.red;
  cube * 3;
  cube.red;
}

cube {
  size: 0.6;
  translate: calc((sibling-index() - 3) * -0.9) 0.3 0;
}

.red {
  color: #ff5a36;
}

cube:not(.red) {
  color: #e6e6e6;
  translate: calc((sibling-index() - 3) * -0.9) 0.8 0;
}
```

### the ones in the middle

The spheres between the first and the last turn blue.

```css
@scene {
  sphere * 6;
}

sphere {
  radius: 0.3;
  translate: calc((sibling-index() - 3.5) * -0.75) 0.4 0;
  color: #e6e6e6;
}

sphere:not(:first-child,
:last-child) {
  color: #3a7bff;
}
```

<a name="selector-nth-child"></a>

## `:nth-child(), :nth-last-child()`

A pseudo-class, like CSS: the position of the object among its siblings, the objects of the same `@scene` block or group, counted from 1. `:nth-last-child()` counts from the end.

- **Specificity:** 100, like a class, plus the most specific selector after of

### Arguments

- **3:** The third sibling.
- **odd, even:** Every other one: 1, 3, 5… or 2, 4, 6…
- **An+B:** A formula where `n` runs from 0 up: `2n+1` is 1, 3, 5…, `3n` every third, `-n+3` the first three.
- **An+B of <selector>:** Counts only the siblings that match the list, and the object must match it too: `:nth-child(2 of .red)` is the second `.red`.

Each copy of `* n` is a sibling of its own: in `@scene { cube * 4; sphere; }`, `cube:nth-child(odd)` is cubes 1 and 3, and the sphere is child 5, as `sibling-index()` counts. Groups count as siblings, and the count starts again inside each group. The position is read once, when the scene compiles: `of` cannot hold `:hover`.

### odd, and every third

The odd cubes turn red, and every third one rises.

```css
@scene {
  cube * 7;
}

cube {
  size: 0.6;
  translate: calc((sibling-index() - 4) * -0.8) 0.3 0;
  color: #e6e6e6;
}

cube:nth-child(odd) {
  color: #ff5a36;
}

cube:nth-child(3n) {
  translate: calc((sibling-index() - 4) * -0.8) 1 0;
}
```

### even of .lit, and the last child

The even ones among the `.lit` spheres turn blue, and the last child grows.

```css
@scene {
  sphere.lit * 3;
  sphere * 2;
  sphere.lit * 3;
}

sphere {
  radius: 0.3;
  translate: calc((sibling-index() - 4.5) * -0.75) 0.4 0;
  color: #555555;
}

.lit {
  color: #e6e6e6;
}

:nth-child(even of .lit) {
  color: #3a7bff;
}

:nth-last-child(1) {
  scale: 1.3;
}
```

<a name="selector-nth-of-type"></a>

## `:nth-of-type(), :nth-last-of-type()`

Like `:nth-child()`, counting only the siblings of the same shape: in `@scene { cube * 2; sphere; cube; }`, `cube:nth-of-type(3)` is the last cube, though it is the fourth child.

- **Specificity:** 100, like a class

The type is the shape name (`cube`, `sphere`, `group`…), like the tag of an HTML element. It takes the same `An+B` as `:nth-child()`, without `of`.

### even cubes, last sphere

Counted among their own shape, the even cubes turn red and the last sphere blue.

```css
@scene {
  cube * 2;
  sphere;
  cube * 2;
  sphere;
}

* {
  translate: calc((sibling-index() - 3.5) * -0.9) 0.4 0;
  color: #e6e6e6;
}

cube {
  size: 0.6;
}

sphere {
  radius: 0.35;
}

cube:nth-of-type(even) {
  color: #ff5a36;
}

sphere:nth-last-of-type(1) {
  color: #3a7bff;
}
```

<a name="selector-first-child"></a>

## `:first-child, :last-child, :only-child`

Shortcuts, like CSS: `:first-child` is `:nth-child(1)` and `:last-child` is `:nth-last-child(1)`. Each has an `-of-type` form that counts only the siblings of the same shape. They take no argument.

- **Specificity:** 100, like a class

### Forms

- **:first-child:** The first sibling.
- **:last-child:** The last sibling.
- **:only-child:** An object without siblings.
- **:first-of-type:** The first of its shape: `cube:first-of-type` is the first cube of its block, even after a sphere.
- **:last-of-type:** The last of its shape.
- **:only-of-type:** The only one of its shape among its siblings.

They read the order of `@scene`, not the position in 3D.

### first and last child

The first cube turns red, the last one blue.

```css
@scene {
  cube * 5;
}

cube {
  size: 0.6;
  translate: calc((sibling-index() - 3) * -0.9) 0.3 0;
  color: #e6e6e6;
}

cube:first-child {
  color: #ff5a36;
}

cube:last-child {
  color: #3a7bff;
}
```

### first of type, only child

In `#a`, the first cube follows a sphere and is still `:first-of-type`; the lone cube of `#b` is an only child.

```css
@scene {
  group#a {
    sphere;
    cube * 2;
  }
  group#b {
    cube;
  }
}

#a {
  translate: 1 0 0;
}

#b {
  translate: -1.4 0 0;
}

* {
  color: #e6e6e6;
}

sphere {
  translate: 0 1.2 0;
  radius: 0.3;
}

cube {
  size: 0.5;
  translate: calc(0.9 - sibling-index() * 0.6) 0.25 0;
}

cube:first-of-type {
  color: #ff5a36;
}

cube:only-child {
  color: #3a7bff;
}
```

<a name="selector-face"></a>

## `::face(), ::top, ::bottom`

A pseudo-element, like `::part()` in CSS: the rule styles one face of the object, not the object. A face takes `texture` only.

- **Specificity:** 1, like a tag, added to the rest

### Faces

- **top, bottom:** Up (+y) and down, in the object's own space: the faces turn with it.
- **front, back:** Toward +z and toward −z.
- **right, left:** Toward +x and toward −x.
- **::top, ::bottom:** Shortcuts for `::face(top)` and `::face(bottom)`.

A face without a rule of its own shows the texture of the object. On a round shape, a face is the part that looks that way the most: a sphere is cut like the cube around it. Like CSS, the pseudo-element ends the selector: `cube.grass::top`, never `#g::top cube`.

### ::face()

One face gets its own texture; the other five keep the object's.

```css
@scene {
  cube.furnace;
}

.furnace {
  translate: 0 0.5 0;
  rotate-y: -30deg;
  texture: url("/textures/dirt.png");
  image-rendering: pixelated;
}

.furnace::face(front) {
  texture: url("/textures/grass-top.png");
}
```

### ::top

A grass block: the top has its own texture.

```css
@scene {
  cube.grass;
}

.grass {
  translate: 0 0.5 0;
  texture: url("/textures/grass-side.png");
  image-rendering: pixelated;
}

.grass::top {
  texture: url("/textures/grass-top.png");
}
```

### ::bottom

The block is turned over: its bottom face, now on top, shows dirt.

```css
@scene {
  cube.flip;
}

.flip {
  translate: 0 0.6 0;
  rotate-x: 150deg;
  texture: url("/textures/grass-side.png");
  image-rendering: pixelated;
}

.flip::bottom {
  texture: url("/textures/dirt.png");
}
```

### ::face(), ::top and ::bottom together

Two grass blocks, the second turned over: each face keeps its texture as the block turns.

```css
@scene {
  cube.grass * 2;
}

.grass {
  translate: calc(2.1 - sibling-index() * 1.4) 0.5 0;
  rotate-y: -30deg;
  rotate-x: calc(sibling-index() * 150deg - 150deg);
  texture: url("/textures/grass-side.png");
  image-rendering: pixelated;
}

.grass::top {
  texture: url("/textures/grass-top.png");
}

.grass::bottom {
  texture: url("/textures/dirt.png");
}

.grass::face(front) {
  texture: url("/textures/dirt.png");
}
```

<a name="cursor"></a>

## `cursor`

The mouse pointer over the object, like CSS: `pointer` says it can be clicked, `grab` that it can be held. It takes the keywords of CSS `cursor`.

- **Syntax:** `auto | default | pointer | grab | grabbing | help | crosshair | move | not-allowed | zoom-in | zoom-out | …`
- **Initial value:** `auto`
- **Applies to:** objects
- **Animatable:** no

Like CSS, it is inherited: a group gives its cursor to its objects. A `:hover` or `:active` rule can change it, like `cube:active { cursor: grabbing; }`, at once: a cursor does not glide. Over the background and the floor, the page keeps its own cursor. A hidden object has none, since the mouse goes through it.

### a button

The cube shows the hand of a link.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  color: #ff5a36;
  cursor: pointer;
  transition: 0.2s;
}

cube:active {
  scale: 0.9;
}
```

### grab and grabbing

An open hand over the sphere, closed while it is pressed.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.7;
  color: #3a7bff;
  cursor: grab;
}

sphere:active {
  cursor: grabbing;
}
```

### a cursor each

Hover each cube: pointer, help, crosshair, move, zoom-in and not-allowed.

```css
@scene {
  cube * 6;
}

scene {
  camera-distance: 7;
}

cube {
  size: 0.7;
  translate: calc(sibling-index() * 1 - 3.5) 0.4 0;
  color: #3a7bff;
}

cube:nth-child(1) {
  cursor: pointer;
}

cube:nth-child(2) {
  cursor: help;
}

cube:nth-child(3) {
  cursor: crosshair;
}

cube:nth-child(4) {
  cursor: move;
}

cube:nth-child(5) {
  cursor: zoom-in;
}

cube:nth-child(6) {
  cursor: not-allowed;
  color: #6b6b78;
}
```

### a disabled button

The grey button says it cannot be pressed: `not-allowed`, and nothing happens; the orange one sinks.

```css
@scene {
  cube#on;
  cube#off;
}

cube {
  size: 1 0.3 1;
  transition: 0.15s;
}

#on {
  translate: -0.8 0.15 0;
  color: #ff5a36;
  cursor: pointer;
}

#on:active {
  translate: -0.8 0.05 0;
}

#off {
  translate: 0.8 0.15 0;
  color: #6b6b78;
  cursor: not-allowed;
}
```

### from a group

The group gives `pointer` to its three spheres; the cone, outside it, keeps the page's cursor.

```css
@scene {
  group#buttons {
    sphere * 3;
  }
  cone;
}

#buttons {
  cursor: pointer;
}

#buttons sphere {
  radius: 0.3;
  translate: calc(sibling-index() * 0.8 - 1.6) 0.3 0;
  color: #3ad16b;
}

cone {
  translate: 1.6 0.5 0;
  color: #6b6b78;
}
```

---

Next: [Variables and conditions](variables-conditions.md)
