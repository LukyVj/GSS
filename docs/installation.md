<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Start here

# Installation

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#installation).

<a name="embedding"></a>

## Embedding a scene

A GSS scene runs on any web page, in three ways. All three use the package `gss-lang@0.0.8`.

GSS is open source, under the Apache-2.0 license: its code is on [GitHub](https://github.com/LukyVj/GSS), where you can [report a bug](https://github.com/LukyVj/GSS/issues). Questions, ideas, a scene to show: say hi on X, [@GSS_lang](https://x.com/GSS_lang).

- **A tag:** No build step: load `embed.js` once, then write `<gss-scene>`.
- **A function:** `mount(canvas, source)` from `gss-lang` compiles the scene in the page.
- **A build step:** The Vite plugin compiles `.gss` files at build time; `mount()` from `gss-lang/runtime` draws them without the compiler.

### A tag

CDN · v0.0.8 · no build step

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/gss-lang@0.0.8/lib/embed.js"></script>

<gss-scene src="logo.gss"></gss-scene>
<gss-scene controls="none">
  <script type="text/gss"> @scene { sphere; } </script>
</gss-scene>
```

### A function

npm install gss-lang@0.0.8

```js
import { mount } from "gss-lang";

const scene = mount(canvas, "@scene { sphere; }");
scene.update(otherSource);
scene.destroy();
```

### A build step

gss-lang@0.0.8 · compiled with Vite

```js
// vite.config.ts
import gss from "gss-lang/vite";
export default { plugins: [gss()] };

// main.ts: the compiler stays out of the page
import { mount } from "gss-lang/runtime";
import logo from "./logo.gss";
mount(canvas, logo);
```

### In the page

- **Camera:** A drag turns it, the wheel zooms, `:hover` works. `controls="none"` (or `controls: false`) keeps only `:hover`, and the page scrolls over the scene. The GSS can choose too: see [`controls`](camera.md#controls).
- **Off screen:** The scene starts when it comes into view, and sleeps when it leaves it.
- **Reduced motion:** The scene stands still under `prefers-reduced-motion`.
- **A still scene:** It draws nothing between two changes (the mouse, a variable, an image that arrives): the GPU rests.
- **Images:** A path starts from the `.gss` file, like `url()` in a stylesheet.
- **Background:** The canvas is not transparent: give the scene the `background` of your page.

See embedded scenes live in the [showcase](https://www.gss-lang.dev/showcase.html).

### From a script

Once `<gss-scene>` fires `load`, its `scene` property gives the scene, to `pause()` it, `play()` it or [set its variables](#set-variables).

<a name="install-package"></a>

## Package (npm)

Install `gss-lang@0.0.8` in your application. The package holds the compiler, the renderer and the TypeScript declarations.

**How it goes, from where it is written to what the scene shows:** `npm install gss-lang`, `mount(canvas, source)`, `a canvas of the page`

```sh
npm install gss-lang@0.0.8
```

```js
import { mount } from "gss-lang";

const scene = mount(canvas, "@scene { sphere; }");
scene.update(otherSource);
scene.destroy();
```

`mount()` takes a canvas that is already in the page, and returns the scene: `scene.update(source)` replaces it, `scene.destroy()` removes it.

A variable the scene registers with `@property` can be set from the page without compiling again, like a CSS custom property: `scene.setProperty("--lift", "2")`. See [Set variables from JavaScript](#set-variables).

<a name="install-vite"></a>

## Vite plugin

The Vite plugin comes with the package. It compiles the `.gss` imports at build time, so the browser loads only the renderer and the compiled scene.

**How it goes, from where it is written to what the scene shows:** `scene.gss`, `vite build`, `the scene, compiled`

```sh
npm install gss-lang@0.0.8
npm install --save-dev vite
```

```js
// vite.config.ts
import gss from "gss-lang/vite";
export default { plugins: [gss()] };

// main.ts: the compiler stays out of the page
import { mount } from "gss-lang/runtime";
import logo from "./logo.gss";
mount(canvas, logo);
```

With TypeScript, add `"gss-lang/client"` to `compilerOptions.types` in `tsconfig.json`: a `.gss` import then has a type. Draw the compiled scene with `mount()` from `gss-lang/runtime`.

<a name="install-cdn"></a>

## CDN (no build step)

Load the browser module of `v0.0.8` from jsDelivr: no install, no bundler. The version is pinned, so an update never changes your scene unexpectedly.

**How it goes, from where it is written to what the scene shows:** `<script src="embed.js">`, `<gss-scene>`, `the scene`

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/gss-lang@0.0.8/lib/embed.js"></script>

<gss-scene src="logo.gss"></gss-scene>
<gss-scene controls="none">
  <script type="text/gss"> @scene { sphere; } </script>
</gss-scene>
```

The script defines `<gss-scene>`. Point its `src` to a `.gss` file, or write the GSS inline, as above. Serve the page over HTTP(S). The module: [https://cdn.jsdelivr.net/npm/gss-lang@0.0.8/lib/embed.js](https://cdn.jsdelivr.net/npm/gss-lang@0.0.8/lib/embed.js).

To drive the scene from a script, see [Set variables from JavaScript](#set-variables).

### Slow computers

- **poster:** `poster="cover.jpg"` shows an image until the scene draws, like the poster of a `<video>`.
- **No graphics card:** `<gss-scene>` shows its poster and a button, and draws the scene only when the reader asks. With `mount()`, `softwareRendering()`, from `gss-lang` or `gss-lang/runtime`, returns `true` on such a computer, to do the same.
- **A weak graphics card:** The scene starts at a density of 0.5, then climbs to its `dpr` while the frames keep up.
- **Still too slow:** The scene stops: `<gss-scene>` shows a button that draws it anyway, and `mount()` fires a `gss-too-heavy` event on the canvas, where `scene.play()` draws it anyway.
- **adaptDpr: false:** `mount(canvas, scene, { adaptDpr: false })` keeps the `dpr` as written and never stops, for a capture or a benchmark.

<a name="set-variables"></a>

## Set variables from JavaScript

A variable the scene registers with [`@property`](at-rules.md#at-property) can be set by the page at any moment, without compiling the scene again, the way `element.style.setProperty()` sets a CSS custom property. Drive a scene from a slider, the scroll position or your data. Move the slider:

**How it goes, from where it is written to what the scene shows:** `--lift`

The scene registers `--lift` and reads it in `translate` and in its color; the page sets it when the slider moves:

```html
<gss-scene id="ball" controls="none">
  <script type="text/gss">
    @property --lift { syntax: "<number>"; inherits: false; initial-value: 1; }
    @scene { sphere; }
    sphere {
      translate: 0 var(--lift) 0;
      radius: 0.5;
      color: oklch(70% 0.17 calc(var(--lift) * 80));
    }
  </script>
</gss-scene>
<input id="lift" type="range" min="0.5" max="1.6" step="0.01" value="1">
```

```js
const ball = document.querySelector("#ball");
const lift = document.querySelector("#lift");

// ball.scene is null until the element fires "load"
const apply = () => ball.scene?.setProperty("--lift", lift.value);
ball.addEventListener("load", apply);
lift.addEventListener("input", apply);
```

### Three methods

Named like those of `element.style`:

- **setProperty():** Sets the variable: `scene.setProperty("--lift", "1.5")`. The value is a string written like CSS (below); a `"<number>"` also takes a number.
- **getPropertyValue():** Reads it back, written like a computed CSS value: `"90deg"`, `"#ff5a36"`. `""` for a variable the scene does not register.
- **removeProperty():** Returns to the start value: the one `scene { --lift: 2; }` gives, or else `initial-value`.

Unlike CSS, which ignores a value it cannot read, `setProperty()` throws an error for a value that does not match the syntax of the variable, and for a variable the scene does not register. Only a registered variable changes while the scene runs: an unregistered one (`--size: 2`) is computed once, when the scene compiles.

### Values

The value is written by the syntax of the variable:

- **"<number>":** `"2"`, `"-0.5"`, or the number `2`
- **"<angle>":** `"90deg"`, `"1.57rad"`, `"100grad"`, `"0.25turn"`
- **"<percentage>":** `"50%"`
- **"<color>":** any CSS color: `"#ff5a36"`, `"tomato"`, `"hsl(10 100% 60%)"`, `"oklch(70% 0.15 40)"`, `"color-mix(in oklab, red, blue)"`
- **"<length>":** `"4px"`, in px only: the radius of `blur()` and `bloom()`

The new value is drawn at the next frame, wherever the variable goes: transforms, colors, sizes, materials, lights, fog, filters, alone or inside `calc()` and the color functions. A value out of its range is kept in it: a size never goes below 0. [`@property`](at-rules.md#at-property) lists what a variable can change, and what it cannot: what the scene builds when it compiles, like the copies of `* n`.

### From `mount()`

`mount()` returns the scene at once, `mountAsync()` a promise of it. `mount()` from `gss-lang/runtime`, for a scene compiled by the Vite plugin, has the same methods.

```js
import { mount, mountAsync } from "gss-lang";

const scene = mount(canvas, source);
scene.setProperty("--lift", "1.5");
scene.getPropertyValue("--lift"); // "1.5"
scene.removeProperty("--lift"); // back to its start value

// mountAsync() gives the same scene, once its backend is ready
const other = await mountAsync(canvas2, source, { backend: "webgpu" });
other.setProperty("--lift", 2);
```

A value set this way stays when `scene.update(source)` gives another scene, as long as the new scene registers the variable with the same syntax.

### In the playground

With `@property-panel { display: open; }` in the scene, the playground, and Try it under the examples of these docs, show a panel over the render with a control for each registered variable: a slider and its number, or a color picker for a `"<color>"`. It calls `setProperty()` as it moves, and its reset button calls `removeProperty()`. A page that embeds the scene shows no panel. See [`@property-panel`](at-rules.md#at-property-panel).

### From `<gss-scene>`

The `scene` property of the element is the scene, with the same methods. It is `null` until the element fires `"load"`: set your values in a `"load"` listener, as the demo does.

The element fires `"load"` again each time it starts a new scene: a new `src`, `controls` or `backend`, or the element moved in the page. A new scene starts from its start values, so the listener sets yours again.

<a name="follow-the-page"></a>

## Follow the page as it scrolls

A scene can follow a part of the page: a section, a card, a list that scrolls. The page gives the part a name in its own CSS, as it would for a CSS scroll-driven animation, and the scene plays an animation along it with [`animation-timeline`](animations.md#animation-timeline). Scroll the box: the ring turns while the section *Three* crosses it.

**A page that scrolls, and the animation where the scroll is:** `0%`, `100%`

`--feature`

@scene { torus; }
scene { camera-spin: none; floor: none; }
torus {
  translate: 0 0.9 0;
  radius: 0.6;
  thickness: 0.18;
  color: #3a7bff;
  animation: turn 1s ease-in-out;
  animation-timeline: --feature;
}
@keyframes turn {
  from { rotate-x: 90deg; }
  to { rotate-y: 360deg; color: #ff5a36; }
}

The CSS of the page names the section; the GSS of the scene writes that name instead of `view()`:

```html
<style>
  #feature { view-timeline-name: --feature; }
</style>

<section id="feature">…</section>

<gss-scene>
  <script type="text/gss">
    @scene { torus; }
    scene { camera-spin: none; floor: none; }
    torus {
      translate: 0 0.9 0;
      radius: 0.6;
      thickness: 0.18;
      color: #3a7bff;
      animation: turn 1s ease-in-out;
      animation-timeline: --feature;
    }
    @keyframes turn {
      from { rotate-x: 90deg; }
      to { rotate-y: 360deg; color: #ff5a36; }
    }
  </script>
</gss-scene>
```

### What the scene follows

- **view-timeline-name:** The section crossing its scroll container, the box around it or the window: the animation starts when its top edge comes in at the bottom, and ends when its bottom edge has left at the top. Like `view()`, but for the section instead of the scene.
- **scroll-timeline-name:** The scroll of the element itself, from its top to its bottom: a list, a panel, a carousel. Like `scroll()`, for that element.
- **view-timeline-axis, scroll-timeline-axis:** `block` (the default) for the vertical scroll, `inline` for the horizontal one, written in the CSS of the page beside the name.
- **view-timeline-inset:** Takes pixels or a percentage off the top and the bottom of the scroll container: `view-timeline-inset: 20%` starts the animation when the section is a fifth of the way in.

The animation plays like on `view()`: its duration and its delay do not count, its number of iterations and its direction do, and [`animation-range`](animations.md#animation-range) plays it on a part of the way, `animation-range: contain` while the section is all in view.

### Several sections

Each section takes a name of its own, `--intro`, `--pricing`, and each object of the scene follows the one its rule names. One object can follow several sections, with a list of animations, one timeline each: `animation: intro 1s, pricing 1s; animation-timeline: --intro, --pricing;`. A scene follows up to 16 timelines, the ones of `scroll()` and `view()` included.

### Unlike CSS

CSS only lets an element follow a timeline named by itself or one of its ancestors, and asks for `timeline-scope` otherwise. The scene is drawn apart from the page, never inside the section: it looks for the name in the whole page, and takes the first element that has it. Give each section its own name.

While no element of the page has the name, the animation shows its first frame, where CSS would not play it at all. A page that adds its sections later is followed once they are there. In the playground and under the examples of these docs, where there is no such section, the slider over the render stands in for the scroll.

<a name="editor-support"></a>

## Editor support

The GSS extension colors and formats `.gss` files in VS Code and in the editors built on it, like Cursor, VSCodium and Windsurf. It is not needed to run a scene.

**How it goes, from where it is written to what the scene shows:** `1`, `2`, `3`, `4`, `5`, `6`, `7`

- **Highlighting:** Selectors, properties, values, colors, numbers and units, the at-rules, nested rules and `&`.
- **Autocompletion:** While you type a property name, the properties the rule can take, with their syntax and description; after `@apply`, the mixins of the file.
- **GSS in HTML:** The GSS of a `<script type="text/gss">` is colored and completed like a `.gss` file.
- **Formatting:** *Format Document*, or saving the file, writes the code in the style of these docs: one shape per line in `@scene`, one declaration per line, two-space indentation, comments kept.
- **File icon:** `.gss` files get the GSS icon in the explorer.

### Install

In VS Code, open the Extensions view (`Ctrl+Shift+X`, or `Cmd+Shift+X` on a Mac), search for *GSS* and install *GSS — GPU Style Sheets*. Or install it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=lukyvj.gss-language), or from the command line:

```sh
code --install-extension lukyvj.gss-language
```

Cursor, VSCodium and Windsurf install their extensions from [Open VSX](https://open-vsx.org/extension/lukyvj/gss-language): search for *GSS* in their Extensions view.

### Format on save

Formatting on save is on by default for `.gss` files. To turn it off, add this to your `settings.json`:

```js
"[gss]": { "editor.formatOnSave": false }
```

---

Next: [At-rules](at-rules.md)
