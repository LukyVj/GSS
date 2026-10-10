<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Scene

# Camera

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#camera).

<a name="camera-angle"></a>

## `camera-angle`

Sets where the camera starts around its target: first the angle around the vertical axis (`0deg` in front, on +z; `90deg` on the right, on +x), then the height above the horizon, from `0deg` to `80deg`. Dragging with the mouse changes it.

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

---

Next: [Lighting and fog](scene-properties.md)
