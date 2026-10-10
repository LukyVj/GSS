<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Motion

# Transforms

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#transforms).

<a name="offset-distance"></a>

## `offset-distance`

How far along its `offset-path` the object is, like CSS: a number, in the units of the path, or a percentage of its length. Animate it with `@keyframes`, a `transition` on `:hover`, or the scroll.

- **Syntax:** `<number> | <percentage>`
- **Initial value:** `0`
- **Applies to:** objects
- **Animatable:** yes

On an open path, the object stops at its ends; on a closed one (with `Z`), it goes round, so 150% is halfway through the second lap. A `ray()` has no length: give it a number.

### three places on one path

Three spheres at 0%, 50% and 100% of one path.

```css
@scene {
  sphere * 3;
}

sphere {
  translate: 0 1 0;
  radius: 0.25;
  color: #e6e6e6;
  offset-path: path("M-2 0 Q0 2 2 0");
  offset-distance: calc((sibling-index() - 1) * 50%);
}

sphere:nth-child(2) {
  color: #ff5a36;
}
```

### on :hover, along a ray

Under the mouse, the cube slides 1.5 along a ray.

```css
@scene {
  cube;
}

cube {
  translate: 1 0.4 0;
  size: 0.5;
  color: #ff5a36;
  offset-path: ray(45deg);
  offset-rotate: 0deg;
  transition: 0.5s ease-out;
}

cube:hover {
  offset-distance: 1.5;
}
```

<a name="offset-path"></a>

## `offset-path`

A motion path, like CSS: the line the object travels along, placed by `offset-distance` and turned by `offset-rotate`. It works on groups too.

- **Syntax:** `none | path(<string>) | ray(<angle>)`
- **Initial value:** `none`
- **Applies to:** objects
- **Animatable:** no

### Values

- **path(<string>):** The `d` of an SVG path, in the object's own xy plane, facing the camera like the `path` shape: centered on itself, y up, one path unit per scene unit. A path shape with the same `d` draws the track; a path that ends with `Z` is closed, and the object goes round it.
- **ray(<angle>):** A straight line from the place of the object, at an angle: `0deg` up, `90deg` right, like CSS.
- **none:** No motion path: the default.

Like CSS, the motion path comes after `translate`, the rotations and `scale`: `translate` moves the whole path, `scale` scales it. For a path on the floor, turn a group with `rotate-x: 90deg`.

### along a track

A ball that follows the curve of a `path` drawn under it.

```css
@scene {
  path#track;
  sphere#ball;
}

#track {
  translate: 0 1.2 0;
  d: path("M-2 0 C-1 2 1 -2 2 0");
  stroke-width: 0.04;
  color: #555555;
}

#ball {
  translate: 0 1.2 0;
  radius: 0.2;
  color: #ff5a36;
  offset-path: path("M-2 0 C-1 2 1 -2 2 0");
  animation: go 3s ease-in-out alternate;
}

@keyframes go {
  to {
    offset-distance: 100%;
  }
}
```

### round a closed path, turned along it

A cube that laps a closed ellipse, turned along it.

```css
@scene {
  cube;
}

cube {
  translate: 0 1.2 0;
  size: 0.6 0.25 0.25;
  color: #3a7bff;
  offset-path: path("M-1.5 0 A1.5 1 0 1 1 1.5 0 A1.5 1 0 1 1 -1.5 0 Z");
  animation: lap 4s linear;
}

@keyframes lap {
  to {
    offset-distance: 100%;
  }
}
```

<a name="offset-rotate"></a>

## `offset-rotate`

How the object turns along its `offset-path`, like CSS.

- **Syntax:** `[auto | reverse] || <angle>`
- **Initial value:** `auto`
- **Applies to:** objects
- **Animatable:** no

### Values

- **auto:** The default: its x axis follows the path, like a car on a road.
- **reverse:** The same, turned the other way.
- **<angle>:** A fixed turn, like `rotate-z`: `0deg` keeps the object upright.
- **auto 90deg:** With `auto` or `reverse`, the angle is added to the turn along the path.

### along the path, or upright

The upper cube turns along the path; the lower one stays upright.

```css
@scene {
  cube#along;
  cube#upright;
}

cube {
  size: 0.5 0.2 0.2;
  color: #ff5a36;
  offset-path: path("M-2 0 C-1 2 1 -2 2 0");
  animation: go 3s ease-in-out alternate;
}

#along {
  translate: 0 1.6 0;
}

#upright {
  translate: 0 0.6 0;
  color: #3a7bff;
  offset-rotate: 0deg;
}

@keyframes go {
  to {
    offset-distance: 100%;
  }
}
```

<a name="rotate-x"></a>

## `rotate-x`

Rotates the object around the x axis. Like CSS `rotateX()`, a positive angle turns its top away from the viewer. On a group, it turns everything inside it around the origin of the group.

- **Syntax:** `<angle>`
- **Initial value:** `0deg`
- **Applies to:** objects
- **Animatable:** yes

### 45 degrees

```css
@scene {
  cube;
}

cube {
  rotate-x: 45deg;
}
```

<a name="rotate-y"></a>

## `rotate-y`

Rotates the object around the y axis. Like CSS `rotateY()`, a positive angle turns its right side away from the viewer. On a group, it turns everything inside it around the origin of the group.

- **Syntax:** `<angle>`
- **Initial value:** `0deg`
- **Applies to:** objects
- **Animatable:** yes

### -45 degrees

```css
@scene {
  cube;
}

cube {
  rotate-y: -45deg;
}
```

<a name="rotate-z"></a>

## `rotate-z`

Rotates the object around the z axis. Like CSS `rotate()`, a positive angle turns it clockwise. On a group, it turns everything inside it around the origin of the group.

- **Syntax:** `<angle>`
- **Initial value:** `0deg`
- **Applies to:** objects
- **Animatable:** yes

### -45 degrees

```css
@scene {
  cube;
}

cube {
  rotate-z: -45deg;
}
```

<a name="scale"></a>

## `scale`

Scales the object by one number, on its three axes. On a group, it scales everything inside it, the positions of its children included.

- **Syntax:** `<number>`
- **Initial value:** `1.0`
- **Applies to:** objects
- **Animatable:** yes

### twice as big

```css
@scene {
  cube;
}

cube {
  scale: 2.0;
}
```

<a name="transform-origin"></a>

## `transform-origin`

The point the object turns and scales around, like CSS: `rotate-x`, `rotate-y`, `rotate-z` and `scale` keep it in place, and a motion path carries it along the path.

- **Syntax:** `[ left | center | right | top | bottom | <percentage> | <number> ]{1,2} <number>?`
- **Initial value:** `center`
- **Applies to:** objects
- **Animatable:** yes

### Values

- **left, right, top, bottom, center:** The sides of the box of the object, like CSS. Two keywords go in any order: `top left`.
- **<percentage>:** Also on the box: `0%` is the left or the top side, `100%` the right or the bottom one.
- **<number>:** A point of the object's own space, from its center, y up, like `translate`: `0 0.5 0` is 0.5 above the center. The third value, z, is always a number.

Unlike CSS, where a length is measured from the top left corner, a number is measured from the center, like everything in GSS. A group has no box: it takes numbers and `center`.

### a door on its hinge

A door that turns on its left side.

```css
@scene {
  cube#door;
  cube#frame;
}

#frame {
  size: 0.1 1.6 0.1;
  translate: -0.6 0.8 0;
  color: #3a7bff;
}

#door {
  size: 1.1 1.5 0.08;
  translate: 0 0.8 0;
  transform-origin: left;
  animation: open 3s ease-in-out infinite alternate;
  color: #ff5a36;
}

@keyframes open {
  to {
    rotate-y: -80deg;
  }
}
```

### grow from the floor

Columns that grow from their base.

```css
@scene {
  cylinder * 5;
}

cylinder {
  radius: 0.18;
  height: 1.2;
  translate: calc((sibling-index() - 3) * -0.5) 0 0;
  transform-origin: bottom;
  animation: grow 1.5s calc(sibling-index() * 0.15s) ease-out infinite alternate;
  color: #ff5a36;
}

@keyframes grow {
  from {
    scale: 0.2;
  }
}
```

<a name="translate"></a>

## `translate`

Moves the object along the x, y and z axes. Like CSS, x points right and z toward the viewer; y points up, and the floor is at y = 0. On a group, it moves everything inside it, and the positions of its children become relative to the group.

- **Syntax:** `<number>{3}`
- **Initial value:** `0 0 0`
- **Applies to:** objects
- **Animatable:** yes

### on the floor

A cube of 1, half a unit up: it sits on the floor.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}
```

---

Next: [Animation and transitions](animations.md)
