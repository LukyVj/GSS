<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Scene

# Lighting and fog

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#scene-properties).

<a name="light"></a>

## `light` (sun)

Sets the sun of the scene: its direction, then if needed its color and its intensity, in any order. The default lights the scene from the upper left, in front.

- **Syntax:** `none | <angle> <angle> [ <color> || <number> ]?`
- **Initial value:** `-45deg 54.7deg`
- **Applies to:** the scene
- **Animatable:** yes

### Values

- **<angle> <angle>:** The direction: the azimuth around the vertical axis (`0deg` points to +z, `90deg` to +x), then the elevation above the horizon (`90deg` is straight overhead).
- **<color>:** The color of the sun, white by default.
- **<number>:** Its intensity, 1 by default.
- **none:** No sun: the scene is lit by its point lights and its `ambient` light.

With `animation` on the scene, the sun can turn, change color, or rise from `none`.

### a low sun from behind

`-120deg 30deg`: from behind, on the left, low over the horizon.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  light: -120deg 30deg;
}
```

### a warm sun

An orange sun, low, with bluish shadows from `ambient`.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 0.6 0;
  radius: 0.6;
}

scene {
  light: -60deg 25deg #ffb36b 1.2;
  ambient: 0.2 #6b8cff;
}
```

### no sun

`none`, and a point light instead.

```css
@scene {
  sphere;
  light#lamp;
}

sphere {
  translate: 0 0.6 0;
  radius: 0.6;
}

#lamp {
  translate: 1 1.5 1;
  intensity: 2.5;
}

scene {
  light: none;
  ambient: 0.05;
}
```

### a day

`@keyframes` on the scene move the sun from dawn to noon.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  animation: day 6s ease-in-out infinite alternate;
}

@keyframes day {
  from {
    light: -80deg 5deg #ff8a5c 0.6;
  }
  to {
    light: 60deg 70deg #ffffff 1;
  }
}
```

<a name="shape-light"></a>

## `light` (point)

Not a shape: a point of light, which draws nothing. Its `color` is the color of its light (white by default), and `intensity` how much light it gives, on top of the sun and the `ambient` light of the scene.

- **Takes:** [`display`](masks.md#display), [`color`](colors.md#color), [`intensity`](#intensity), [`translate`](transforms.md#translate), [`rotate-x`](transforms.md#rotate-x), [`rotate-y`](transforms.md#rotate-y), [`rotate-z`](transforms.md#rotate-z), [`transform-origin`](transforms.md#transform-origin), [`transition`](animations.md#transition), [`transition-property`](animations.md#transition-property), [`transition-duration`](animations.md#transition-duration), [`transition-timing-function`](animations.md#transition-timing-function), [`transition-delay`](animations.md#transition-delay), [`animation`](animations.md#animation), [`animation-duration`](animations.md#animation-duration), [`animation-delay`](animations.md#animation-delay), [`animation-iteration-count`](animations.md#animation-iteration-count), [`animation-direction`](animations.md#animation-direction), [`animation-fill-mode`](animations.md#animation-fill-mode), [`animation-timing-function`](animations.md#animation-timing-function), [`animation-timeline`](animations.md#animation-timeline), [`animation-range`](animations.md#animation-range), [`animation-range-start`](animations.md#animation-range-start), [`animation-range-end`](animations.md#animation-range-end), [`offset-path`](transforms.md#offset-path), [`offset-distance`](transforms.md#offset-distance), [`offset-rotate`](transforms.md#offset-rotate)

A light moves like an object, and is never drawn: to see the bulb, put a shape at its place. A scene takes 8 lights at most.

What moves a light: `translate`, the groups it is in, animations, `:hover` through its group, a motion path, and rotations around a `transform-origin`, in numbers, since a light has no size. Lights add up. A light cannot be hovered or pressed: hover the shape at its place, like `#lamp:hover light`. Without `shadows`, the light goes through the objects.

### a lamp

A warm bulb, with a faint ambient light and no sun.

```css
@scene {
  light#bulb;
  sphere;
}

scene {
  light: none;
  ambient: 0.05;
}

#bulb {
  translate: 0.9 1.6 0.9;
  color: #ffd27a;
  intensity: 2;
}

sphere {
  translate: 0 0.6 0;
  radius: 0.6;
}
```

### colored lights

A red and a blue light, one on each side of a white cube.

```css
@scene {
  light#warm;
  light#cold;
  cube;
}

scene {
  light: none;
  ambient: 0.05;
}

#warm {
  translate: -1.4 1.4 1;
  color: #ff5a36;
  intensity: 3;
}

#cold {
  translate: 1.4 1.4 1;
  color: #3a7bff;
  intensity: 3;
}

cube {
  translate: 0 0.5 0;
  color: #ffffff;
}
```

### a light that moves

A firefly that circles the sphere, around its `transform-origin`.

```css
@scene {
  light#firefly;
  sphere;
}

scene {
  light: none;
  ambient: 0.05;
}

#firefly {
  translate: 1.2 0.8 0;
  transform-origin: -1.2 0 0;
  color: #b6ff6b;
  intensity: 1.5;
  animation: circle 4s linear;
}

sphere {
  translate: 0 0.6 0;
  radius: 0.5;
}

@keyframes circle {
  to {
    rotate-y: 1turn;
  }
}
```

### a lamp to hover

Hovering the lamp turns its light up.

```css
@scene {
  light#bulb;
  group#lamp {
    sphere#shade;
    cube#stand;
  }
}

scene {
  light: none;
  ambient: 0.15;
}

#shade {
  translate: 0 1.5 0;
  radius: 0.3;
  color: #ffd27a;
}

#stand {
  translate: 0 0.6 0;
  size: 0.1 1.2 0.1;
}

#bulb {
  translate: 0 1.1 0.5;
  intensity: 0.2;
  transition: 0.4s;
}

#bulb:has(+ #lamp:hover) {
  intensity: 3;
}
```

<a name="intensity"></a>

## `intensity`

How much light a point `light` gives: what a surface facing it receives at 1 unit, then less with the square of the distance, a quarter at 2 units and a ninth at 3. 0 turns it off.

**What the property changes in the scene:** `intensity: 0.5;`, `intensity: 1;`, `intensity: 4;`

- **Syntax:** `<number>`
- **Initial value:** `1`
- **Applies to:** light
- **Animatable:** yes

### a strong lamp

An intensity of 4, two units above the sphere.

```css
@scene {
  light;
  sphere;
}

scene {
  light: none;
  ambient: 0.05;
}

light {
  translate: 0 2 1;
  intensity: 4;
}

sphere {
  translate: 0 0.6 0;
  radius: 0.6;
}
```

<a name="ambient"></a>

## `ambient`

Sets the light received by the surfaces the sun does not reach, from 0 (black shadows) to 1 (no shadows). A color can follow, for the light of the sky in the shadows: `ambient: 0.2 #9db4ff` gives bluish shadows under a warm sun.

- **Syntax:** `<number> <color>?`
- **Initial value:** `0.1`
- **Applies to:** the scene
- **Animatable:** no

### lighter shadows

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  ambient: 0.4;
}
```

<a name="shadows"></a>

## `shadows`

Lets the objects cast shadows, on the floor and on each other: a point in the shadow of an object keeps only the `ambient` light.

**What the property changes in the scene:** `shadows: none;`, `shadows: hard;`, `shadows: soft;`

- **Syntax:** `none | hard | soft`
- **Initial value:** `none`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **none:** No shadow: the default.
- **soft:** A penumbra that grows with the distance to the object that casts it, like the shadow of the sun.
- **hard:** A sharp edge.

The sun and every point `light` cast shadows, and the holes of `mask-image` let the light through. Each light costs one more ray per pixel. The reflections and the refractions show the objects without shadows.

### soft shadows

The shadows of the sun blur as they get farther from the objects.

```css
@scene {
  sphere;
  cube;
}

scene {
  shadows: soft;
  light: -30deg 50deg;
}

sphere {
  translate: -0.6 0.9 0;
  radius: 0.5;
  color: #ff5a36;
}

cube {
  translate: 0.7 0.4 0.3;
  size: 0.8;
  color: #3a7bff;
}
```

### hard shadows from a lamp

A lamp and no sun: sharp shadows.

```css
@scene {
  light;
  sphere;
}

scene {
  shadows: hard;
  light: none;
  ambient: 0.15;
}

light {
  translate: 0.8 2.4 0.6;
  intensity: 4;
  color: #ffd27a;
}

sphere {
  translate: 0 0.7 0;
  radius: 0.6;
}
```

### light through holes

The holes of a mask let the sun through.

```css
@scene {
  sphere;
}

scene {
  shadows: soft;
  light: 20deg 70deg;
}

sphere {
  translate: 0 1.2 0;
  radius: 0.9;
  mask-image: noise(4 3, black 48%, transparent 52%);
}
```

<a name="fog"></a>

## `fog`

Fills the scene with fog, measured from the camera: none before the first distance, only fog after the second one, and more and more of it between. Without a color, each object fades into the background behind it.

- **Syntax:** `none | [ <color> ]? <number> <number> [ <color> ]?`
- **Initial value:** `none`
- **Applies to:** the scene
- **Animatable:** yes

### Values

- **<number> <number>:** Where the fog starts, and where it hides everything.
- **<color>:** Its color, before or after the distances. The background takes it too: past the fog, only the fog is seen.
- **none:** No fog: the default.

The scene draws nothing farther than 20 units from the camera: a fog that ends before that hides the far edge of the floor. The scene can animate its fog, from `none` too.

The reflections and the refractions show the objects without fog.

### into the background

The cubes melt into the background as they go away.

```css
@scene {
  cube * 7;
}

cube {
  size: 0.6;
  translate: calc((sibling-index() - 4) * -1.1) 0.3 calc(sibling-index() * -1.6);
  color: #ff5a36;
}

scene {
  background: #c9d6e3;
  fog: 3 13;
}
```

### a colored fog

A warm fog, whose color the background takes.

```css
@scene {
  sphere * 5;
}

sphere {
  radius: 0.4;
  translate: 0 0.4 calc(sibling-index() * -2);
  color: #3a7bff;
}

scene {
  fog: #e8e0d4 2 11;
  camera-angle: 20deg 12deg;
}
```

### the fog rolls in

The fog rolls in, from `none`.

```css
@scene {
  cylinder * 9;
}

cylinder {
  radius: 0.15;
  height: 1.6;
  translate: calc((sibling-index() - 5) * -0.9) 0.8 calc(sibling-index() * -1.2);
  color: #e6e6e6;
}

scene {
  background: #1a1d2b;
  floor: #2a2e40;
  fog: none;
  animation: roll 6s ease-in-out infinite alternate;
}

@keyframes roll {
  to {
    fog: 1 7;
  }
}
```

<a name="ambient-occlusion"></a>

## `ambient-occlusion`

Darkens the `ambient` light where the objects close in: the corners, the floor under an object, the gap between two close ones. A strength from 0 to 2, then a radius and a number of samples if needed.

**What the property changes in the scene:** `ambient-occlusion: none;`, `ambient-occlusion: 1;`

- **Syntax:** `none | <number> <number>? <integer>?`
- **Initial value:** `none`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **none:** No occlusion: the default.
- **<number>:** The strength, from 0 to 2: 1 is the usual look.
- **<number> <number>:** The strength, then the radius, from 0.05 to 5 units: how far around a point the objects count. 0.5 by default.
- **<number> <number> <integer>:** The strength, the radius, then the samples, from 2 to 16: more are smoother and cost more. 5 by default.

Objects stop looking pasted on the floor, and a brighter `ambient` keeps its depth. Only the ambient light is darkened: the sun and the lights keep their shadows.

Each sample measures the scene once more, on every pixel: 5 samples cost about as much as 5 steps of a ray. The reflections and the refractions are lit without it. The values are written in the shader: a variable set from JS cannot change them, and a `@media` can.

### objects that sit on the floor

```css
@scene {
  cube * 3;
  sphere;
}

scene {
  ambient-occlusion: 1;
  ambient: 0.5;
}

cube {
  size: 0.7;
  translate: calc(sibling-index() * 0.72 - 1.44) 0.35 0;
  color: #e8e6e1;
}

sphere {
  radius: 0.45;
  translate: 0 0.45 0.9;
  color: #ff5a36;
}
```

### a wider, softer occlusion

```css
@scene {
  cube * 2;
}

scene {
  ambient-occlusion: 0.8 1.5 8;
  ambient: 0.6;
}

cube {
  size: 1 2 1;
  translate: calc(sibling-index() * 1.3 - 1.95) 1 0;
  color: #3a7bff;
}
```

<a name="shadow-softness"></a>

## `shadow-softness`

Sets how wide the penumbra of `shadows: soft` grows, from 0.1 to 10: 2 makes it twice as wide, 0.5 half as wide.

**What the property changes in the scene:** `shadow-softness: 0.5;`, `shadow-softness: 3;`

- **Syntax:** `<number>`
- **Initial value:** `1`
- **Applies to:** the scene
- **Animatable:** no

A low sun and tall objects cast long shadows: a wider penumbra keeps them soft far from the objects; a narrower one keeps them crisp near them. `shadows: hard` has no penumbra, and ignores it.

The value is written in the shader: a variable set from JS cannot change it, and a `@media` can.

### a wide penumbra

```css
@scene {
  cube * 3;
}

scene {
  shadows: soft;
  shadow-softness: 3;
  light: -40deg 30deg;
}

cube {
  size: 0.4 1.6 0.4;
  translate: calc(sibling-index() * 1.2 - 2.4) 0.8 0;
  color: #ff5a36;
}
```

<a name="shadow-steps"></a>

## `shadow-steps`

Sets how many steps the ray toward a light takes, at most, to find what is in the way, from 16 to 512.

**What the property changes in the scene:** `shadow-steps: 16;`, `shadow-steps: 160;`

- **Syntax:** `auto | <integer>`
- **Initial value:** `auto`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **auto:** 64 steps, or 100 when the light goes through holes or transparent objects: the default.
- **<integer>:** That many steps, for every shadow.

A shadow that is too short, banded far from its object, or that misses a thin object in the way, needs more steps.

Each step costs as much as one step of the march of a pixel, on every pixel the light reaches. The value is written in the shader: a variable set from JS cannot change it, and a `@media` can.

### long shadows of a low sun

```css
@scene {
  cube * 5;
}

scene {
  shadows: soft;
  shadow-steps: 160;
  light: -70deg 12deg;
  camera-distance: 10;
}

cube {
  size: 0.3 1.2 0.3;
  translate: calc(sibling-index() * 0.9 - 2.7) 0.6 0;
  color: #3a7bff;
}
```

---

Next: [Rendering](rendering.md)
