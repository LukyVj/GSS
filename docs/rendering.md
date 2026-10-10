<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Scene

# Rendering

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#rendering).

<a name="dpr"></a>

## `dpr`

Sets the pixel density of the render, like the device pixel ratio of the screen.

> [!NOTE]
> **The density follows the computer.** A scene starts at a density of 0.5, then climbs to its `dpr` while the frames keep up, and lowers it while they are slow: a weak graphics card never draws a heavy scene at full density at once. When it is still far too slow at 0.5, the scene stops and offers to draw it anyway. In the playground and in the examples of these docs, the dpr menu at the top right of the render picks the density for you: `auto` follows the frame rate, a number replaces the `dpr`, never above the screen's. Your choice is kept in this browser.

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

<a name="shape-rendering"></a>

## `shape-rendering`

Smooths the silhouettes of the objects, without raising the pixel density of the render.

> [!NOTE]
> **Heavier to draw, for now.** With `geometricPrecision`, the graphics card does about 15 % more work for the same scene, more on some heavy scenes. On a weak computer, the scene lowers its density sooner, and a scene already at the limit may stop and offer to draw it anyway. Keep `auto` on a heavy scene.

- **Syntax:** `auto | geometricPrecision`
- **Initial value:** `auto`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **auto:** The default: each pixel shows one surface, and silhouettes keep their steps.
- **geometricPrecision:** A pixel that the edge of an object only partly covers blends the object with what is behind it: the silhouettes come out smooth.

Like `shape-rendering` in SVG, but on the scene only, with two values: `auto` keeps the sharp edges GSS has always drawn. The smoothing comes from the ray each pixel already casts, not from more rays or a bigger render. Only silhouettes are smoothed: the edges of a texture, of a shadow or of the floor keep their steps.

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

Shows the scene as it is lit, or with the isolines of its distance field over it: the distance to the nearest object, which the shader measures at every step of every ray.

> [!NOTE]
> **Two chips switch it here.** In the playground and in the examples of these docs, the chips `view: shaded` and `view: distance` at the top left of the render switch the view, without touching the code; when the code changes its `view`, the code wins again. On your own site, the `view` of the scene applies.

- **Syntax:** `shaded | distance`
- **Initial value:** `shaded`
- **Applies to:** the scene
- **Animatable:** no

### Values

- **shaded:** The scene, lit: the default.
- **distance:** The same scene, with a line every 0.25 units from the objects, fainter as it goes away. The lines lie on the plane that faces the camera through `camera-target`, and show where that plane is in front of the objects.

The floor is left out of the distance: the lines go around the objects only. Far from a `path`, a `prism` or a `lathe`, the distance is the one to its box, which the shader uses to skip it quickly, and the lines show that box. The lines are light on a dark scene and dark on a light one.

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

---

Back to the [documentation](README.md).
