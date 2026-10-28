<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Scene

# Rendering

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#rendering).

<a name="dpr"></a>

## `dpr`

Sets the pixel density of the render, like the device pixel ratio of the screen.

> [!NOTE]
> **The density follows the computer.** A scene starts at a density of 0.5, then climbs to its `dpr` while the frames keep up, and lowers it while they are slow: a weak graphics card never draws a heavy scene at full density at once. When it is still far too slow at 0.5, the scene stops and offers to draw it anyway. In the playground and in the examples of these docs, the dpr menu at the top right of the render picks the density for you: `auto` follows the frame rate, a number replaces the `dpr`, never above the screen's. Your choice is kept in this browser.

**What the property changes in the scene:** `dpr: 1;`, `dpr: 2;`

- **Syntax:** `auto | max | <number>`
- **Initial value:** `auto`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **auto:** The density of the screen, up to 2: the default.
- **max:** The density of the screen, however high: the sharpest render, and the slowest.
- **<number>:** From 0.25 to 4, never above the screen's. Below 1, the render is coarser and faster.

### as sharp as the screen

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  dpr: max;
}
```

### half the density

Coarser, and faster to draw.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  dpr: 0.5;
}
```

<a name="hit-precision"></a>

## `hit-precision`

Sets how close to a surface a ray must come to count as a hit, from 0.0001 to 0.01 units.

**What the property changes in the scene:** `hit-precision: 0.01;`, `hit-precision: 0.0002;`

- **Syntax:** `<number>`
- **Initial value:** `0.001`
- **Applies to:** the scene
- **Animatable:** no

A smaller value finds the surfaces more exactly: a large, smooth object seen close up, at a high `dpr`, loses its faint bands. A larger one stops the rays sooner, in fewer steps.

The normals, which light the surfaces, are measured over the same distance. With `shape-rendering: geometricPrecision`, a hit is measured in pixels instead: only the normals follow `hit-precision`. The value is written in the shader: a variable set from JS cannot change it, and a `@media` can.

### a big sphere close up

```css
@scene {
  sphere;
}

scene {
  hit-precision: 0.0002;
  camera-distance: 4;
  floor: none;
}

sphere {
  radius: 1.6;
  material: metal(#d4af37, 0.1);
}
```

<a name="max-distance"></a>

## `max-distance`

Sets how far from the camera the scene is drawn, from 10 to 500 units: past it, a ray sees the background.

**What the property changes in the scene:** `max-distance: 20;`, `max-distance: 60;`

- **Syntax:** `<number>`
- **Initial value:** `20`
- **Applies to:** the scene
- **Animatable:** no

A long floor, a horizon or objects far behind the target need more than 20. The camera can go back to 5 units short of it: up to 15 with the initial value, 55 with `max-distance: 60`.

The fog of `none` sits at this distance too. A ray that hits nothing goes all the way to `max-distance` before it gives up: a bigger value costs those rays more steps, and may need more `raymarch-steps`. The value is written in the shader: a variable set from JS cannot change it, and a `@media` can.

### a row that goes far

The cubes go back 40 units; with 20, the last ones would be cut off.

```css
@scene {
  cube * 9;
}

scene {
  max-distance: 60;
  camera-angle: 20deg 12deg;
  camera-distance: 10;
  fog: 20 60;
}

cube {
  size: 1;
  translate: 0 0.5 calc(sibling-index() * -5 + 4);
  color: #ff5a36;
}
```

<a name="raymarch-steps"></a>

## `raymarch-steps`

Sets how many steps the ray of each pixel takes, at most, to find a surface, from 16 to 1024.

**What the property changes in the scene:** `raymarch-steps: 12;`, `raymarch-steps: 100;`

- **Syntax:** `<integer>`
- **Initial value:** `100`
- **Applies to:** the scene
- **Animatable:** no

A ray that grazes a long floor, or runs along close objects, can run out of steps: a halo or a missing edge. More steps fix that, at a cost only on the rays that need them.

Each step measures the distance to the scene and moves the ray that far: most rays find their surface in a few dozen steps. With holes (`mask-image`) or transparent objects, the ray takes twice as many steps, to go through them. With `shape-rendering: geometricPrecision`, it takes 200 more along the silhouettes. The shadows keep their own steps. The value is written in the shader: a variable set from JS cannot change it, and a `@media` can.

### a long grazing floor

The ray along the floor, far away, needs more than 100 steps.

```css
@scene {
  cube * 9;
}

scene {
  raymarch-steps: 300;
  max-distance: 60;
  camera-angle: 0deg 6deg;
  camera-distance: 12;
  floor: repeating-linear-gradient(90deg, #e8e6e1 0% 5%, #1a1d2b 5% 10%);
}

cube {
  size: 0.6;
  translate: 0 0.3 calc(sibling-index() * -5 + 4);
  color: #ff5a36;
}
```

### fewer steps on a phone

```css
@scene {
  sphere;
}

sphere {
  translate: 0 0.8 0;
}

@media (max-width: 600px) {
  scene {
    raymarch-steps: 64;
  }
}
```

<a name="shape-rendering"></a>

## `shape-rendering`

Smooths the silhouettes of the objects, without raising the pixel density of the render.

> [!NOTE]
> **Heavier to draw, for now.** With `geometricPrecision`, the graphics card does about 15 % more work for the same scene, more on some heavy scenes. On a weak computer, the scene lowers its density sooner, and a scene already at the limit may stop and offer to draw it anyway. Keep `auto` on a heavy scene.

**What the property changes in the scene:** `shape-rendering: auto;`, `shape-rendering: geometricPrecision;`

- **Syntax:** `auto | geometricPrecision`
- **Initial value:** `auto`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **auto:** The default: each pixel shows one surface, and silhouettes keep their steps.
- **geometricPrecision:** A pixel that the edge of an object only partly covers blends the object with what is behind it: the silhouettes come out smooth.

Like `shape-rendering` in SVG, but on the scene only, with two values. Only silhouettes are smoothed: the edges of a texture, of a shadow or of the floor keep their steps.

`auto` keeps the sharp edges GSS has always drawn. The smoothing comes from the ray each pixel already casts, not from more rays or a bigger render.

### smooth silhouettes

The sphere keeps one ray per pixel; only its grazing edge gets partial coverage.

```css
@scene {
  sphere;
}

scene {
  shape-rendering: geometricPrecision;
  floor: none;
}

sphere {
  radius: 1;
}
```

<a name="view"></a>

## `view`

Shows the scene as it is lit, with the isolines of its distance field over it, or with each pixel colored by the work it costs: the distance to the nearest object is what the shader measures at every step of every ray.

> [!NOTE]
> **Three chips switch it here.** In the playground and in the examples of these docs, the chips `view: shaded`, `view: distance` and `view: steps` at the top left of the render switch the view, without touching the code; when the code changes its `view`, the code wins again. On your own site, the `view` of the scene applies.

**What the property changes in the scene:** `view: shaded;`, `view: distance;`, `view: steps;`

- **Syntax:** `shaded | distance | steps`
- **Initial value:** `shaded`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **shaded:** The scene, lit: the default.
- **distance:** The same scene, with a line every 0.25 units from the objects, fainter as it goes away. The lines lie on the plane that faces the camera through `camera-target`, and show where that plane is in front of the objects.
- **steps:** Each pixel colored by how many times its rays measured the distance: dark blue for a few, then green, yellow, and red at 150 and over. The red parts are the ones that slow a scene down.

The floor is left out of the distance: the lines go around the objects only.

Far from a `path`, a `prism` or a `lathe`, the distance is the one to its box, which the shader uses to skip it quickly, and the lines show that box. The lines are light on a dark scene and dark on a light one. `steps` counts every measure of a pixel: the march of its ray, its normal, its shadows, its reflections and what shows through a transparent object. The rays that graze an object take the most steps, along its edges.

### the distance around a sphere

Rings around the sphere, one every 0.25.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 0.5 0;
}

scene {
  view: distance;
}
```

### on a dark scene

Without a floor, on a dark background: the lines of the field around two objects meet halfway.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: -0.8 0.5 0;
  color: #ff5a36;
}

cube {
  translate: 0.8 0.5 0;
  color: #e8e6e1;
}

scene {
  view: distance;
  floor: none;
  background: #0a0a0c;
}
```

### what a scene costs

The edges of the torus and the ground near it take the most steps.

```css
@scene {
  torus;
}

torus {
  translate: 0 0.6 0;
  rotate-x: 60deg;
}

scene {
  view: steps;
}
```

---

Back to the [documentation](README.md).
