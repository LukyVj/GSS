<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Filters

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#filters).

<a name="filter"></a>

## `filter`

Post-processing, like CSS `filter`: a list of functions applied in order, on the whole image (`scene { filter }`), on an object, or on a group and everything in it.

- **Syntax:** `none | <filter-function>+`
- **Initial value:** `none`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Functions

- **brightness(), contrast(), saturate():** A number or a percentage: 1 or 100% changes nothing.
- **grayscale(), sepia(), invert():** From 0 to 1: how far it goes.
- **hue-rotate():** An angle around the color wheel.
- **grain():** A film grain that moves at every frame (0.1 by default).
- **vignette():** Darker towards the corners, like an old lens: from 0 to 1 (0.5 by default). On the scene only.
- **chromatic-aberration():** Red and blue pulled apart towards the corners, like a cheap lens: a length in px at the corners (2px by default). On the scene only.
- **blur():** A blur, by a length in px, like CSS.
- **bloom():** Makes the bright parts glow: an amount (0.6 by default) and a radius in px (16px by default).
- **opacity():** Makes an object or a group transparent, multiplied with `opacity`. On the scene, it is an error: the scene stays opaque.

On an object or a group, the filters change only its own pixels, and the reflections see them too: a `blur()` spreads it over what is around it. Like CSS, an object's filter comes before its group's, and the scene's comes last; on an object, the filters that read one pixel come before `blur()` and `bloom()`, and an object and its group cannot both have one of them. `blur()` and `bloom()` read the pixels around each pixel, so they cost more as the radius grows; the other filters cost almost nothing.

### brightness()

The whole image, 1.4 times brighter.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
}

scene {
  filter: brightness(1.4);
}
```

### contrast()

Darker darks, lighter lights.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0.8 0.6 0;
  color: #ff5a36;
}

cube {
  translate: -0.8 0.5 0;
  color: #3a7bff;
}

scene {
  filter: contrast(1.6);
}
```

### saturate()

Twice the saturation.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0.8 0.6 0;
  color: #ff5a36;
}

cube {
  translate: -0.8 0.5 0;
  color: #3a7bff;
}

scene {
  filter: saturate(2);
}
```

### grayscale()

No color left.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0.8 0.6 0;
  color: #ff5a36;
}

cube {
  translate: -0.8 0.5 0;
  color: #3a7bff;
}

scene {
  filter: grayscale(1);
}
```

### sepia()

The tones of an old photograph.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0.8 0.6 0;
  color: #ff5a36;
}

cube {
  translate: -0.8 0.5 0;
  color: #3a7bff;
}

scene {
  filter: sepia(0.8);
}
```

### hue-rotate()

Every hue turned by 120°.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0.8 0.6 0;
  color: #ff5a36;
}

cube {
  translate: -0.8 0.5 0;
  color: #3a7bff;
}

scene {
  filter: hue-rotate(120deg);
}
```

### invert()

The negative of the image.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
}

scene {
  filter: invert(1);
}
```

### grain()

A film grain over the image.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
}

scene {
  background: #1a1a22;
  filter: grain(0.15);
}
```

### blur()

The whole image, blurred by 3px.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0.8 0.6 0;
  color: #ff5a36;
}

cube {
  translate: -0.8 0.5 0;
  color: #3a7bff;
}

scene {
  filter: blur(3px);
}
```

### vignette() and chromatic-aberration()

The effects of a lens, on the whole image: darker corners, colors that split at the edges.

```css
@scene {
  torus;
  sphere;
}

scene {
  filter: vignette(0.6) chromatic-aberration(4px);
}

torus {
  translate: 0 0.8 0;
  radius: 0.8;
  thickness: 0.25;
  rotate-x: 60deg;
  color: #f4f1ea;
}

sphere {
  translate: 0 0.8 0;
  radius: 0.3;
  color: #ff5a36;
}
```

### bloom()

Bright spheres that glow in the dark.

```css
@scene {
  sphere.light * 5;
}

.light {
  radius: 0.25;
  translate: calc(2.4 - sibling-index() * 0.8) 0.8 0;
  color: hsl(calc(sibling-index() * 40) 100% 70%);
}

scene {
  floor: none;
  background: #07070a;
  ambient: 1;
  filter: bloom(0.9, 20px);
}
```

### filter on objects

Each sphere has a filter of its own.

```css
@scene {
  sphere#a;
  sphere#b;
  sphere#c;
}

sphere {
  radius: 0.5;
  color: #ff5a36;
}

#a {
  translate: 1.3 0.6 0;
  filter: grayscale(1);
}

#b {
  translate: 0 0.6 0;
  filter: blur(4px);
}

#c {
  translate: -1.3 0.6 0;
  filter: hue-rotate(180deg) brightness(1.3);
}
```

### filter on a group

Only the spheres of the group glow.

```css
@scene {
  group#lights {
    sphere * 4
  }
  cube;
}

#lights {
  filter: bloom(0.9, 18px);
}

#lights sphere {
  radius: 0.2;
  translate: calc(1.75 - sibling-index() * 0.7) 1.4 0;
  color: #ffd27a;
}

cube {
  translate: 0 0.5 0;
  color: #3a7bff;
}

scene {
  floor: none;
  background: #07070a;
}
```

### opacity() on a group

The group fades: its objects show through each other.

```css
@scene {
  group#g {
    cube;
    sphere;
  }
}

#g {
  filter: opacity(0.5);
}

cube {
  translate: -0.6 0.5 0;
  color: #3a7bff;
}

sphere {
  translate: 0.6 0.5 0;
  radius: 0.5;
  color: #ff5a36;
}
```

### filters together

Four filters, applied in the order written.

```css
@scene {
  torus;
  sphere;
}

torus {
  translate: 0 1 0;
  rotate-x: 70deg;
  color: #ffd27a;
  material: gold;
}

sphere {
  radius: 0.3;
  translate: 0 1 0;
  color: #ff5a36;
}

scene {
  floor: none;
  background: radial-gradient(#2a2a3a, #07070a);
  filter: contrast(1.1) saturate(1.3) bloom(0.7, 18px) grain(0.06);
}
```

---

Next: [Visibility, opacity, outlines and masks](masks.md)
