<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Start here

# Installation

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#installation).

<a name="embedding"></a>

## Embedding a scene

A GSS scene runs on any web page, in three ways. All three use the package `gss-lang@0.0.6`.

GSS is open source, under the Apache-2.0 license: its code is on [GitHub](https://github.com/LukyVj/GSS), where you can [report a bug](https://github.com/LukyVj/GSS/issues). Questions, ideas, a scene to show: say hi on X, [@GSS_lang](https://x.com/GSS_lang).

- **A tag:** No build step: load `embed.js` once, then write `<gss-scene>`.
- **A function:** `mount(canvas, source)` from `gss-lang` compiles the scene in the page.
- **A build step:** The Vite plugin compiles `.gss` files at build time; `mount()` from `gss-lang/runtime` draws them without the compiler.

### A tag

CDN · v0.0.6 · no build step

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/gss-lang@0.0.6/lib/embed.js"></script>

<gss-scene src="logo.gss"></gss-scene>
<gss-scene controls="none">
  <script type="text/gss"> @scene { sphere; } </script>
</gss-scene>
```

### A function

npm install gss-lang@0.0.6

```js
import { mount } from "gss-lang";

const scene = mount(canvas, "@scene { sphere; }");
scene.update(otherSource);
scene.destroy();
```

### A build step

gss-lang@0.0.6 · compiled with Vite

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

An embedded scene behaves like the playground: a drag turns the camera, the wheel zooms, `:hover` works. With `controls="none"` (or `controls: false`), only `:hover` stays, and the page scrolls over the scene. The scene starts when it comes into view, sleeps when it leaves it, and stands still under `prefers-reduced-motion`. A scene that does not move draws nothing between two changes (the mouse, a variable, an image that arrives): the GPU rests.

Images are read next to the `.gss` file, like `url()` in a stylesheet. The canvas is opaque: give the scene the `background` of your page. The [showcase](https://www.gss-lang.dev/showcase.html) shows them all live.

### From a script

Once `<gss-scene>` fires `load`, its `scene` property gives the scene, to `pause()` it, `play()` it or [set its variables](#set-variables).

<a name="install-package"></a>

## Package (npm)

Install `gss-lang@0.0.6` in your application. The package holds the compiler, the renderer and the TypeScript declarations.

```sh
npm install gss-lang@0.0.6
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

```sh
npm install gss-lang@0.0.6
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

Load the browser module of `v0.0.6` from jsDelivr: no install, no bundler. The version is pinned, so an update never changes your scene unexpectedly.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/gss-lang@0.0.6/lib/embed.js"></script>

<gss-scene src="logo.gss"></gss-scene>
<gss-scene controls="none">
  <script type="text/gss"> @scene { sphere; } </script>
</gss-scene>
```

The script defines `<gss-scene>`. Point its `src` to a `.gss` file, or write the GSS inline, as above. Serve the page over HTTP(S). The module: [https://cdn.jsdelivr.net/npm/gss-lang@0.0.6/lib/embed.js](https://cdn.jsdelivr.net/npm/gss-lang@0.0.6/lib/embed.js).

To drive the scene from a script, see [Set variables from JavaScript](#set-variables).

`poster="cover.jpg"` shows an image until the scene draws, like the poster of a `<video>`. On a computer without a graphics card, the processor would draw the scene, slowly enough to freeze the page: `<gss-scene>` then shows its poster and a button, and draws the scene only when the reader asks. With `mount()`, `softwareRendering()`, from `gss-lang` or `gss-lang/runtime`, returns `true` on such a computer, to do the same.

A scene starts at a density of 0.5, then climbs to its `dpr` while the frames keep up: a weak graphics card never draws a heavy scene at full density at once. When the scene is still far too slow at 0.5, it stops: `<gss-scene>` shows a button that draws it anyway, and `mount()` fires a `gss-too-heavy` event on the canvas, where `scene.play()` draws it anyway. `mount(canvas, scene, { adaptDpr: false })` keeps the `dpr` as written and never stops, for a capture or a benchmark.

<a name="set-variables"></a>

## Set variables from JavaScript

A variable the scene registers with [`@property`](at-rules.md#at-property) can be set by the page at any moment, without compiling the scene again, the way `element.style.setProperty()` sets a CSS custom property. Drive a scene from a slider, the scroll position or your data. Move the slider:

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

Its `scene` property gives the scene, with the same methods. It is `null` until the element fires `"load"`, since the scene only starts when it comes near the screen. Set your values on `"load"`, as the demo does: it fires again each time the element starts a new scene (a new `src`, `controls` or `backend`, or the element moved in the page), and a new scene starts from its start values.

<a name="editor-support"></a>

## Editor support

The GSS extension colors and formats `.gss` files in VS Code and in the editors built on it, like Cursor, VSCodium and Windsurf. It is not needed to run a scene.

- **Highlighting:** Selectors, properties, values, colors, numbers and units, the at-rules, nested rules and `&`.
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
