<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Scene

# Camera

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#camera).

<a name="camera-angle"></a>

## `camera-angle`

Sets where the camera starts around its target: first the angle around the vertical axis (`0deg` in front, on +z; `90deg` on the right, on +x), then the height above the horizon, from `0deg` to `80deg`. Dragging with the mouse changes it.

**What the property changes in the scene:** `40deg`, `25deg`

- **Syntax:** `<angle> <angle>`
- **Initial value:** `0deg 22.9deg`
- **Applies to:** the scene
- **Animatable:** no

### from the front left, high above

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  camera-angle: -45deg 60deg;
}
```

<a name="camera-distance"></a>

## `camera-distance`

Sets the distance between the camera and its target at the start, from 3 to 15. The mouse wheel changes it.

- **Syntax:** `<number>`
- **Initial value:** `8`
- **Applies to:** the scene
- **Animatable:** no

### closer

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  camera-distance: 5;
}
```

<a name="camera-spin"></a>

## `camera-spin`

Sets how long the camera takes to turn once around its target, in `s` or `ms`. `none`, the default, keeps it still.

- **Syntax:** `<time> | none`
- **Initial value:** `none`
- **Applies to:** the scene
- **Animatable:** no

### one turn in 40 s

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
}

scene {
  camera-spin: 40s;
}
```

<a name="camera-target"></a>

## `camera-target`

Sets the point the camera looks at and turns around.

- **Syntax:** `<number>{3}`
- **Initial value:** `0 0.5 0`
- **Applies to:** the scene
- **Animatable:** no

### looking higher

The cube is 2 units up, and so is the target.

```css
@scene {
  cube;
}

cube {
  translate: 0 2 0;
}

scene {
  camera-target: 0 2 0;
}
```

<a name="controls"></a>

## `controls`

The gestures that move the camera: `orbit`, a drag turns it around its target, and `zoom`, the wheel brings it closer. `none` keeps the camera where the GSS puts it, and the page scrolls over the scene. On an object, the gestures that cannot start over it.

**What the property changes in the scene:** `controls: orbit;`, `controls: zoom;`

- **Syntax:** `auto | none | [ orbit || zoom ]`
- **Initial value:** `auto`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Values

- **auto:** Both gestures, the default: a drag turns the camera, the wheel zooms.
- **none:** Neither: the camera stays where the GSS puts it, and the wheel scrolls the page.
- **orbit:** A drag turns the camera around its target.
- **zoom:** The wheel brings the camera closer or takes it farther, from 3 to 15.

On `scene`, it says which gestures move the camera. On an object or a group, it says which gestures can start over it: a button with `controls: none` is pressed without turning the camera.

CSS has no camera, so GSS has a property of its own for it. Around a button with `controls: none`, a drag from the floor still turns the camera. A gesture moves the camera when the scene and the object under the pointer both take it. Like `cursor`, it is inherited from the groups; it follows `@media`, not `:hover`. On a page, `<gss-scene controls="none">` and `mount(canvas, scene, { controls: false })` turn every gesture off, whatever the GSS says. `camera-spin` still turns the camera.

### a still camera

The camera stays where the GSS puts it: a drag does nothing, and the wheel scrolls the page.

```css
@scene {
  torus;
}

scene {
  controls: none;
  camera-angle: 30deg 30deg;
}

torus {
  translate: 0 0.8 0;
  rotate-x: 60deg;
  radius: 0.6;
  thickness: 0.2;
  color: #ff5a36;
}
```

### turn, but no zoom

A drag turns the camera; the wheel scrolls the page.

```css
@scene {
  cube;
}

scene {
  controls: orbit;
}

cube {
  translate: 0 0.5 0;
  rotate-y: 30deg;
  color: #3a7bff;
}
```

### a button that holds still

Press the orange button and drag: it sinks, and the camera stays. From the floor, a drag still turns it.

```css
@scene {
  cube#base;
  cube#button;
}

#base {
  size: 1.6 0.2 1.6;
  translate: 0 0.1 0;
  color: #2a2a33;
}

#button {
  size: 1 0.3 1;
  translate: 0 0.35 0;
  color: #ff5a36;
  cursor: pointer;
  controls: none;
  transition: 0.15s;
}

#button:active {
  translate: 0 0.25 0;
}
```

---

Next: [Lighting and fog](scene-properties.md)
