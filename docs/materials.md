<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Materials

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#materials).

<a name="material"></a>

## `material`

Sets how the surface of the object reacts to light. Without a color, a material uses the `color` property, like `currentColor` in CSS, so the color stays animatable; with its own, like `brass` or `metal(#3a7bff)`, it keeps it, even when `color` is a gradient. The color can also be a gradient: `metal(linear-gradient(#ffd27a, #ff5a36), 0.2)`.

- **Syntax:** `matte([<color>]) | metal([<color>,] [<roughness>]) | jelly([<color>,] [<density>]) | emissive([<color>,] [<strength>]) | iridescent([<color>,] [<strength>]) | gold | chrome | copper | silver | brass | aluminum | jelly | glass([<color>,] [<refraction-index>] [, [frosted | wavy | hammered | blurred] <frost>]) | glass | ice | emissive | iridescent`
- **Initial value:** `matte()`
- **Applies to:** objects
- **Animatable:** no

### Values

- **matte():** Scatters the light only, like chalk: the default.
- **metal():** Reflects the scene. Its roughness goes from 0, a mirror, to 1, brushed metal (0.2 by default).
- **jelly():** Lets the light through its thin parts, like a gummy candy. Its density goes from 0, clear, to 1, deep (0.5 by default).
- **glass():** See-through, bent by its refraction index, from 1 to 3 (1.5 by default: water is 1.33, diamond 2.4), then a frost from 0 to 1.
- **emissive():** Gives its own light: a lamp, a screen, a neon. It is never darker than its color times its strength, from 0, none, to 4 (1 by default: its full color, even in the shade). It does not light the objects around it; with `bloom()` in the `filter` of the scene, it glows.
- **iridescent():** A thin film, like a soap bubble or the back of a CD: its colors turn with the angle you see it at, most at the edges. Its strength goes from 0, none, to 1 (0.7 by default).
- **frosted, wavy, hammered, blurred:** The style of the frost: white patches (the default), big waves, small bumps, a soft blur.
- **gold, chrome:** `metal(#d4af37, 0.2)` and `metal(#ffffff, 0.05)`.
- **copper, silver, brass, aluminum:** `metal(#c8784a, 0.25)`, `metal(#e3e4e6, 0.1)`, `metal(#c9a24d, 0.2)` and `metal(#c4c8cc, 0.35)`: the metals of everyday objects.
- **jelly, glass, ice:** `jelly()`, `glass()`, and `glass(#cfeaff, 1.31, frosted 0.25)`.
- **emissive, iridescent:** `emissive()` and `iridescent()`, with the color of `color`.

### matte()

The default: a soft, even surface.

```css
@scene {
  sphere;
}

sphere {
  color: #ff5a36;
  material: matte();
}
```

### metal()

`gold`, `chrome`, and a rougher `metal(0.7)` that takes the `color`.

```css
@scene {
  sphere#a;
  sphere#b;
  sphere#c;
}

#a {
  translate: 1.3 0.6 0;
  radius: 0.6;
  material: gold;
}

#b {
  translate: 0 0.6 0;
  radius: 0.6;
  material: chrome;
}

#c {
  translate: -1.3 0.6 0;
  radius: 0.6;
  color: #d4af37;
  material: metal(0.7);
}
```

### everyday metals

`copper`, `silver`, `brass` and `aluminum`, from left to right.

```css
@scene {
  sphere#a;
  sphere#b;
  sphere#c;
  sphere#d;
}

sphere {
  radius: 0.45;
}

#a {
  translate: -1.5 0.5 0;
  material: copper;
}

#b {
  translate: -0.5 0.5 0;
  material: silver;
}

#c {
  translate: 0.5 0.5 0;
  material: brass;
}

#d {
  translate: 1.5 0.5 0;
  material: aluminum;
}
```

### its own color

`brass` keeps its color over the stripes of `color`; `metal(0.2)`, without a color of its own, takes them.

```css
@scene {
  sphere#a;
  sphere#b;
}

sphere {
  radius: 0.6;
  color: stripes(3, #ff5a36, #f4f1ea);
}

#a {
  translate: -0.8 0.6 0;
  material: brass;
}

#b {
  translate: 0.8 0.6 0;
  material: metal(0.2);
}
```

### jelly()

`jelly`, and a clearer `jelly(0.3)`.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0.8 0.6 0;
  radius: 0.6;
  color: #ff5a36;
  material: jelly;
}

cube {
  translate: -0.8 0.5 0;
  rotate-y: -30deg;
  color: #3ad16b;
  material: jelly(0.3);
}
```

### emissive()

A glowing sphere and a dim one, with `bloom()` on the scene.

```css
@scene {
  sphere#lamp;
  sphere#dim;
}

scene {
  background: #07080c;
  ambient: 0.25;
  filter: bloom(0.7, 10px);
}

#lamp {
  translate: -0.8 0.6 0;
  radius: 0.55;
  material: emissive(#ff5a36, 2);
}

#dim {
  translate: 0.8 0.6 0;
  radius: 0.55;
  material: emissive(#3a7bff, 0.5);
}
```

### iridescent()

A dark sphere and a pale torus: their colors turn as they spin.

```css
@scene {
  sphere;
  torus;
}

sphere {
  translate: -0.8 0.7 0;
  radius: 0.6;
  color: #15161c;
  material: iridescent(0.9);
}

torus {
  translate: 0.9 0.7 0;
  radius: 0.45;
  thickness: 0.18;
  rotate-x: 70deg;
  color: #f4f1ea;
  material: iridescent;
  animation: spin 6s linear infinite;
}

@keyframes spin {
  to {
    rotate-y: 360deg;
  }
}
```

### glass()

Clear glass.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.6;
  material: glass;
}
```

### glass(), with its arguments

A white glass, of index 1.5 and frost 0.3.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.6;
  material: glass(#ffffff, 1.5, 0.3);
}
```

### ice

`glass(#cfeaff, 1.31, frosted 0.25)`.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  radius: 0.6;
  material: ice;
}
```

### glass, with a cube behind

The sphere bends the view of the cube behind it.

```css
@scene {
  sphere;
  cube;
}

sphere {
  translate: 0 0.7 0;
  radius: 0.6;
  material: glass;
}

cube {
  translate: -0.3 0.5 -1.5;
  color: #ff5a36;
}
```

### glass() with frost and style

A `wavy` and a `blurred` frost, side by side.

```css
@scene {
  sphere#a;
  sphere#b;
  cube;
}

#a {
  translate: 0.7 0.7 0;
  radius: 0.6;
  material: glass(1.5, wavy 0.6);
}

#b {
  translate: -0.7 0.7 0;
  radius: 0.6;
  material: glass(1.5, blurred 0.6);
}

cube {
  translate: 0 0.5 -1.8;
  color: #ff5a36;
}
```

---

Next: [Textures](textures.md)
