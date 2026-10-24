<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Text

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#text).

<a name="content"></a>

## `content`

Writes a text on the surface of the object, the way `content` gives a text to a `::before` in CSS. The text is painted over the color, the gradient or the `texture` of the object: it moves, turns and takes the light with it, and goes behind what stands in front of it.

**What covers the surface, flat, then on an object:** `"GSS"`, `content`

- **Syntax:** `[ <string> | <number> ]+ | none`
- **Initial value:** `none`
- **Applies to:** objects
- **Animatable:** yes

### Values

- **<string>:** The text, between quotes. Several strings side by side are joined: `"3D" " text"`. `\A` starts a new line, like CSS: `"one\A two"`.
- **<number>:** A number, joined to the strings around it: `"item " sibling-index()` writes `item 1`, `item 2`… Unlike CSS, where `content` takes no number. One number per text, on one line, written like CSS writes it: `0.5`, `-2`, six decimals at most.
- **var(--name):** A variable that holds a string or a number.
- **none:** No text: the default. `normal` is the same.

The text is as large as each face lets it be, or as `font-size` says. Unlike CSS, `content` goes on the object itself, not on a `::before`, and it takes a number.

The text sits in the middle of each face, and keeps its proportions. Without `::face()`, every face of the object shows it, read from left to right on each; `::face()` gives a face a text of its own, or `none`, by its name or its number (`::face(3)`, `::face(odd)`). A cube and a plane write on their flat faces. A round shape (a sphere, a cylinder, a tube, a cone, a capsule, a torus) wraps the text around itself like a label on a can, on four sides around its axis, and lays it flat on its top and its bottom. A pyramid writes on its four slopes and its base, an octahedron on its eight triangles, upright. Any other shape takes the text of each side like a sticker, fading where its surface turns away. The font comes from `font-family`, `font-weight` and `font-style`, the size from `font-size`, the color from `text-color`, the side its lines lean to from `text-align`. An emoji keeps its own colors. On `:hover` and in `@keyframes` the text changes halfway, like a value of CSS that does not interpolate.

### a sign

The word fits the front of the board, and each of its other faces.

```css
@scene {
  cube;
}

scene {
  camera-angle: -20deg 12deg;
}

cube {
  translate: 0 0.8 0;
  size: 2.4 1 0.2;
  color: #1a1d2b;
  content: "hello";
  font-weight: bold;
}
```

### a text per face

Each face of the die takes its own `content`.

```css
@scene {
  cube;
}

scene {
  camera-angle: 35deg 30deg;
}

cube {
  translate: 0 0.6 0;
  color: #f4f1ea;
  corner-radius: 0.08;
  font-weight: bold;
}

cube::face(top) {
  content: "1";
}

cube::face(front) {
  content: "2";
}

cube::face(right) {
  content: "3";
}

cube::face(left) {
  content: "4";
}

cube::face(back) {
  content: "5";
}

cube::face(bottom) {
  content: "6";
}
```

### around a can

On a cylinder, the text wraps around the side like a label.

```css
@scene {
  cylinder;
}

scene {
  camera-angle: 25deg 15deg;
}

cylinder {
  translate: 0 0.9 0;
  radius: 0.6;
  height: 1.6;
  color: #e8443a;
  content: "SODA";
  font-weight: bold;
  animation: turn 6s linear infinite;
}

@keyframes turn {
  to {
    rotate-y: 360deg;
  }
}
```

### numbered copies

Each copy writes its own number, from `sibling-index()`. The digits are drawn once, so a scene can number many copies.

```css
@scene {
  cube * 8;
}

scene {
  camera-angle: 0deg 10deg;
  camera-distance: 6;
}

cube {
  size: 0.7 0.7 0.1;
  translate: calc(mod(sibling-index() - 1, 4) * 0.85 - 1.275) calc(1.4 - round(down, (sibling-index() - 1) / 4) * 0.85) 0;
  color: #1a1d2b;
  content: "n° " sibling-index();
  font-size: 0.2;
  text-align: center;
}
```

### a variable

The text is a variable of the scene, read with `var()`.

```css
@scene {
  sphere;
}

scene {
  --word: "GSS";
}

sphere {
  translate: 0 0.8 0;
  radius: 0.8;
  color: #3a7bff;
  content: var(--word);
  font-family: Georgia, serif;
  font-style: italic;
}
```

<a name="font-family"></a>

## `font-family`

The font of the text of `content`, like CSS: a list of fonts, and the first one the browser has draws the text.

**What covers the surface, flat, then on an object:** `font-family: sans-serif;`, `font-family: serif;`, `font-family: monospace;`

- **Syntax:** `[<family-name> | <generic-family>]#`
- **Initial value:** `sans-serif`
- **Applies to:** objects
- **Animatable:** yes

A font the page loads, with `@font-face` or a stylesheet of fonts, can be named: the text is drawn again when it arrives. Unlike CSS, the font is not inherited: set it on the object that has the text.

### a serif and a monospace

```css
@scene {
  cube#a;
  cube#b;
}

scene {
  camera-distance: 5;
}

cube {
  size: 1.8 0.9 0.2;
  color: #f4f1ea;
  content: "Hello";
}

#a {
  translate: -1 0.8 0;
  font-family: Georgia, "Times New Roman", serif;
}

#b {
  translate: 1 0.8 0;
  font-family: monospace;
}
```

<a name="font-size"></a>

## `font-size`

The height of the letters of `content`, in the units of the scene, like the other sizes of GSS. A line is as wide as the face: a longer text goes on to the next line, between its words.

**What covers the surface, flat, then on an object:** `font-size: auto;`, `font-size: 0.2;`

- **Syntax:** `auto | <number>`
- **Initial value:** `auto`
- **Applies to:** objects
- **Animatable:** yes

### Values

- **auto:** The text is as large as each face lets it be, its lines broken only where it says `\A`: the default.
- **<number>:** The height of the letters: `0.3` on a cube of 1 gives about three lines.

Unlike CSS, the size is in the units of the scene, and `auto` fits the text to the face. A taller text is cut at the edges of the face; its lines are centered on its height.

### a paragraph on a board

```css
@scene {
  cube;
}

scene {
  camera-angle: -15deg 10deg;
}

cube {
  translate: 0 0.9 0;
  size: 2.4 1.4 0.1;
  color: #f4f1ea;
  content: "Selectors, the cascade and keyframes, compiled into one shader.";
  font-size: 0.2;
}
```

<a name="font-style"></a>

## `font-style`

Slants the letters of `content`, like CSS.

**What covers the surface, flat, then on an object:** `font-style: normal;`, `font-style: italic;`

- **Syntax:** `normal | italic | oblique`
- **Initial value:** `normal`
- **Applies to:** objects
- **Animatable:** yes

### italic

```css
@scene {
  cube;
}

cube {
  translate: 0 0.8 0;
  size: 2.4 1 0.2;
  color: #f4f1ea;
  content: "Hello";
  font-family: Georgia, serif;
  font-style: italic;
}
```

<a name="font-weight"></a>

## `font-weight`

How thick the letters of `content` are, like CSS: `normal` is 400, `bold` is 700, and a number goes from 1 to 1000 when the font has that weight.

**What covers the surface, flat, then on an object:** `font-weight: 300;`, `font-weight: normal;`, `font-weight: bold;`

- **Syntax:** `normal | bold | <number>`
- **Initial value:** `normal`
- **Applies to:** objects
- **Animatable:** yes

### normal and bold

```css
@scene {
  cube#a;
  cube#b;
}

scene {
  camera-distance: 5;
}

cube {
  size: 1.8 0.9 0.2;
  color: #1a1d2b;
  content: "Hello";
}

#a {
  translate: -1 0.8 0;
}

#b {
  translate: 1 0.8 0;
  font-weight: bold;
}
```

<a name="text-align"></a>

## `text-align`

The side the lines of `content` lean to, like CSS. `start` is the left and `end` the right: GSS reads from left to right.

**What covers the surface, flat, then on an object:** `text-align: start;`, `text-align: center;`, `text-align: end;`

- **Syntax:** `left | center | right | start | end`
- **Initial value:** `start`
- **Applies to:** objects
- **Animatable:** yes

### centered lines

```css
@scene {
  cube;
}

cube {
  translate: 0 0.9 0;
  size: 2.4 1.2 0.1;
  color: #1a1d2b;
  content: "GPU\A Style Sheets";
  text-align: center;
  font-weight: bold;
}
```

<a name="text-color"></a>

## `text-color`

The color of the text of `content`. Without one, the text is black on a light object and white on a dark one, so it stays readable when the color of the object changes.

**What covers the surface, flat, then on an object:** `black or white`, `text-color: #ff5a36;`

- **Syntax:** `<color>`
- **Initial value:** `black or white`
- **Applies to:** objects
- **Animatable:** yes

In CSS, `color` colors the text. In GSS, `color` is the color of the object, so its text has a property of its own.

### orange on white

```css
@scene {
  cube;
}

cube {
  translate: 0 0.8 0;
  size: 2.4 1 0.2;
  color: #f4f1ea;
  content: "hello";
  font-weight: bold;
  text-color: #ff5a36;
}
```

---

Next: [Filters](filters.md)
