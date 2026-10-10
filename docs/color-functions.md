<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Color functions

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#color-functions).

<a name="fn-rgb"></a>

## `rgb()`

A color from its red, green and blue channels, like CSS: numbers from 0 to 255, or percentages (100% is 255). Spaces or commas both work, and `rgba()` is the same function.

- **Syntax:** `rgb(<red> <green> <blue>) | rgb(<red>, <green>, <blue>)`
- **Computed:** at compile time, once per object

Values outside the range are clamped. An alpha (`rgb(255 0 0 / 50%)`) makes the color transparent, which only `color`, `background` and `mask-image` take: anywhere else, it is an error. The math works inside, so one rule can give each copy its own color.

### red, green and blue

```css
@scene {
  sphere;
}

sphere {
  color: rgb(255 90 54);
}
```

### more red for each copy

`calc()` and `sibling-index()` raise the red of each cube.

```css
@scene {
  cube.step * 5;
}

.step {
  size: 0.4;
  translate: calc(1.8 - sibling-index() * 0.6) 0.3 0;
  color: rgb(calc(sibling-index() * 50) 90 200);
}
```

<a name="fn-hsl"></a>

## `hsl()`

A color from its hue, saturation and lightness, like CSS. The hue is an angle on the color wheel (0 red, 120 green, 240 blue), in degrees or in `deg`, `rad` or `turn`, and it goes round: -120 is 240.

- **Syntax:** `hsl(<hue> <saturation> <lightness>)`
- **Computed:** at compile time, once per object

Saturation and lightness are percentages, or numbers where 100 is 100%; a lightness of 50% gives the pure color. Commas, `hsla()` and the alpha work as in `rgb()`. With `sibling-index()` on the hue, the copies of an object spread a rainbow.

### an orange

```css
@scene {
  sphere;
}

sphere {
  color: hsl(20 100% 60%);
}
```

### a rainbow

Each dot turns the hue 45° further.

```css
@scene {
  sphere.dot * 8;
}

.dot {
  radius: 0.25;
  translate: calc(2.7 - sibling-index() * 0.6) 0.5 0;
  color: hsl(calc(sibling-index() * 45) 90% 60%);
}
```

<a name="fn-hwb"></a>

## `hwb()`

A color from a hue, and how much white and black are mixed into it, like CSS: `hwb(0 0% 0%)` is pure red; more whiteness makes it paler, more blackness darker. When whiteness and blackness add up to 100% or more, the color is a gray. The hue works as in `hsl()`.

- **Syntax:** `hwb(<hue> <whiteness> <blackness>)`
- **Computed:** at compile time, once per object

### paler and paler

Each cube adds 15% of white.

```css
@scene {
  cube.tint * 5;
}

.tint {
  size: 0.6;
  translate: calc(2.4 - sibling-index() * 0.8) 0.3 0;
  color: hwb(200 calc(sibling-index() * 15%) 10%);
}
```

<a name="fn-lab-lch"></a>

## `lab(), lch()`

The CIE Lab color space of CSS, built on how the eye sees: the lightness goes from 0 (black) to 100 (white), `a` from green to red, `b` from blue to yellow. `lch()` is the same space, written with a chroma (how colorful) and a hue.

- **Syntax:** `lab(<lightness> <a> <b>) | lch(<lightness> <chroma> <hue>)`
- **Computed:** at compile time, once per object

Percentages work as in CSS: 100% is 100 for the lightness, 125 for `a` and `b`, 150 for the chroma. A color the screen cannot show is clipped to it.

### lab()

An orange, in Lab.

```css
@scene {
  sphere;
}

sphere {
  color: lab(62 52 48);
}
```

### lch()

Six hues of the same lightness and chroma.

```css
@scene {
  sphere.dot * 6;
}

.dot {
  radius: 0.3;
  translate: calc(2.6 - sibling-index() * 0.75) 0.5 0;
  color: lch(65 60 calc(sibling-index() * 60));
}
```

### lab() and lch() together

A green in `lab()`, and one in `lch()`.

```css
@scene {
  cube#a;
  cube#b;
}

#a {
  translate: 0.7 0.5 0;
  color: lab(55 -40 30);
}

#b {
  translate: -0.7 0.5 0;
  color: lch(55 50 140);
}
```

<a name="fn-oklab-oklch"></a>

## `oklab(), oklch()`

The OKLab color space of CSS: its lightness matches the eye much better than `hsl()`, so colors of the same lightness look equally light, whatever their hue. With `sibling-index()` on its hue, `oklch()` gives a rainbow whose colors all look as light.

- **Syntax:** `oklab(<lightness> <a> <b>) | oklch(<lightness> <chroma> <hue>)`
- **Computed:** at compile time, once per object

The lightness goes from 0 to 1, or 0% to 100%. `oklch()` adds a chroma, from about 0 to 0.4 (100% is 0.4), and a hue. A color the screen cannot show is clipped to it.

### oklab()

A warm color, in OKLab.

```css
@scene {
  sphere;
}

sphere {
  color: oklab(0.72 0.12 0.1);
}
```

### oklch()

A rainbow whose colors look equally light.

```css
@scene {
  sphere.dot * 8;
}

.dot {
  radius: 0.25;
  translate: calc(2.7 - sibling-index() * 0.6) 0.5 0;
  color: oklch(72% 0.15 calc(sibling-index() * 45));
}
```

### oklab() and oklch() together

A blue in `oklab()`, and a red in `oklch()`.

```css
@scene {
  cube#a;
  cube#b;
}

#a {
  translate: 0.7 0.5 0;
  color: oklab(60% -0.1 -0.1);
}

#b {
  translate: -0.7 0.5 0;
  color: oklch(60% 0.14 30deg);
}
```

<a name="fn-color"></a>

## `color()`

A color in a named color space, like CSS, with three channels from 0 to 1, or percentages.

- **Syntax:** `color(<space> <r> <g> <b>)`
- **Computed:** at compile time, once per object

### Color spaces

- **srgb:** The space of hex colors.
- **srgb-linear:** The same colors, without the gamma curve: the channels are amounts of light.
- **display-p3:** A wider gamut. What the sRGB render cannot show is clipped.
- **xyz, xyz-d65, xyz-d50:** The CIE XYZ space, with a D65 white (`xyz` is `xyz-d65`) or a D50 white.

### display-p3 and srgb-linear

```css
@scene {
  sphere#a;
  sphere#b;
}

#a {
  translate: 0.8 0.6 0;
  color: color(display-p3 0.95 0.35 0.2);
}

#b {
  translate: -0.8 0.6 0;
  color: color(srgb-linear 0.1 0.3 0.8);
}
```

<a name="fn-color-mix"></a>

## `color-mix()`

Mixes two colors in a color space, like CSS. Without percentages, half of each; with one, the other color takes the rest; with both, they are scaled to add up to 100%.

- **Syntax:** `color-mix(in <space> [shorter | longer hue]?, <color> <percentage>?, <color> <percentage>?)`
- **Computed:** at compile time, once per object

### Color spaces

- **oklab:** The most even mixes.
- **srgb:** The mix of hex colors: duller middle colors.
- **srgb-linear:** A mix of the light itself: brighter middle colors.
- **lab:** Like `oklab`, in CIE Lab.
- **oklch, lch, hsl, hwb:** Spaces with a hue: it goes the shorter way round the wheel, or the longer one with `longer hue`. A gray takes the hue of the other color.

Like CSS, when the percentages add up to less than 100%, the color becomes transparent, which only `color`, `background` and `mask-image` take: anywhere else, it is an error. A percentage set from JavaScript is kept between 0% and 100%, and percentages that add up to less are scaled up to 100%.

### from orange to blue

Each cube takes 20% more blue, mixed in `oklab`.

```css
@scene {
  cube.step * 6;
}

.step {
  size: 0.6;
  translate: calc(2.6 - sibling-index() * 0.75) 0.3 0;
  color: color-mix(in oklab, #ff5a36, #3a7bff calc(sibling-index() * 20% - 20%));
}
```

<a name="fn-light-dark"></a>

## `light-dark()`

The first color in light mode, the second in dark mode, like CSS. The scene follows the system as it changes: it works like `@media (prefers-color-scheme: dark)`, and counts as one of the queries of the scene.

- **Syntax:** `light-dark(<light color>, <dark color>)`
- **Computed:** at compile time, once per object

### light and dark mode

```css
@scene {
  sphere;
}

scene {
  background: light-dark(#f4f1ea, #0b0b10);
  floor: light-dark(#e8e3db, #16161d);
}

sphere {
  color: light-dark(#ff5a36, #7cb4ff);
}
```

<a name="fn-contrast-color"></a>

## `contrast-color()`

White or black, whichever contrasts most with the color, like CSS: the way to keep an object readable against a background held in a variable.

- **Syntax:** `contrast-color(<color>)`
- **Computed:** at compile time, once per object

### readable on any background

The sphere is white or black, whatever `--bg` holds.

```css
@scene {
  cube;
  sphere;
}

scene {
  --bg: #3a7bff;
  background: var(--bg);
}

cube {
  translate: 0 0.5 0;
  color: var(--bg);
}

sphere {
  radius: 0.3;
  translate: 0 1.3 0;
  color: contrast-color(var(--bg));
}
```

<a name="fn-currentcolor"></a>

## `currentColor`

A keyword, like CSS: the object's own `color`, wherever a color is expected. `color-mix(in oklab, currentColor 60%, white)` is a lighter version of whatever color the object has, so one rule can tint many objects.

- **Syntax:** `currentColor`
- **Computed:** at compile time, once per object

As the color of a material, `metal(currentColor, 0.2)` is `metal(0.2)`: the material follows the color, animated, on `:hover`, or a gradient. It also works in the stops of a gradient, in `light-dark()` and in a variable, read with the color of the object that uses the variable. An object without color uses the initial `#e6e6e6`. It can be written `currentcolor` too. `color: currentColor` is an error: a group passes no color down, and the scene has none.

### a lighter shell for every color

Three spheres, each in a jelly lighter than its own color.

```css
@scene {
  sphere * 3;
}

sphere {
  radius: 0.4;
  translate: calc((sibling-index() - 2) * -1.1) 0.5 0;
  material: jelly(color-mix(in oklab, currentColor 55%, white), 0.4);
}

sphere:nth-child(1) {
  color: #ff5a36;
}

sphere:nth-child(2) {
  color: #3ad16b;
}

sphere:nth-child(3) {
  color: #3a7bff;
}
```

### in a variable

One gradient in a variable, read with the color of each cube.

```css
@scene {
  cube#a;
  cube#b;
}

scene {
  --shade: linear-gradient(currentColor, color-mix(in srgb, currentColor, black 60%));
}

cube {
  size: 0.8;
  material: metal(var(--shade), 0.3);
}

#a {
  translate: 0.7 0.4 0;
  color: #ff5a36;
}

#b {
  translate: -0.7 0.4 0;
  color: #3a7bff;
}
```

---

Next: [Gradients and noise](gradients.md)
