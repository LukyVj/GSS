<p align="center">
  <a href="https://www.gss-lang.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://www.gss-lang.dev/marks/lockup-dark.svg" />
      <img src="https://www.gss-lang.dev/marks/lockup-light.svg" alt="GSS" height="56" />
    </picture>
  </a>
</p>

<p align="center"><strong>Style sheets for the GPU.</strong><br />
Selectors, the cascade and <code>@keyframes</code>, compiled into a single raymarching shader.</p>

<p align="center">
  <a href="https://www.gss-lang.dev">Website</a> ·
  <a href="https://www.gss-lang.dev/playground">Playground</a> ·
  <a href="https://www.gss-lang.dev/docs">Reference</a>
</p>

<p align="center">
  <a href="https://www.gss-lang.dev/playground"><img src="https://www.gss-lang.dev/marks/social-playground.png" alt="A GSS scene next to its render" width="720" /></a>
</p>

---

GSS (GPU Style Sheets) is a 3D language for people who already speak CSS. You declare shapes in a
`@scene`, style them with selectors, and the compiler turns the whole thing into one GLSL
fragment shader: signed distance fields, raymarched in WebGL2. No Three.js, no meshes, no UVs.

```css
@scene {
  torus#ring;
  sphere#ball;
}

#ring {
  translate: 0 1.2 0;
  rotate-x: 70deg;
  radius: 1.1;
  thickness: 0.14;
  color: #e8e6e1;
}

#ball {
  translate: 0 1.2 0;
  radius: 0.55;
  color: #ff5a36;
  material: jelly(0.6);
  animation: float 2s ease-in-out alternate;
}

@keyframes float {
  from { translate: 0 1.2 0; }
  to   { translate: 0 1.5 0; }
}
```

## Install

Three ways to put a scene on a page.

**A tag, no build step.** Load `embed.js` once, then point a `<gss-scene>` at a `.gss` file, or
write the scene inside it:

```html
<script type="module" src="https://www.gss-lang.dev/embed.js"></script>

<gss-scene src="logo.gss"></gss-scene>
<gss-scene controls="none">
  <script type="text/gss"> @scene { sphere; } </script>
</gss-scene>
```

**A function, with any bundler.** The compiler runs in the page:

```sh
npm install gss-lang
```

```js
import { mount } from "gss-lang";

const scene = mount(canvas, "@scene { sphere; }");
scene.update(otherSource);
scene.destroy();
```

**Compiled at build time, with Vite.** The page ships a small runtime and the shader, not the
compiler:

```js
// vite.config.ts
import gss from "gss-lang/vite";
export default { plugins: [gss()] };

// main.ts
import { mount } from "gss-lang/runtime";
import logo from "./logo.gss";
mount(canvas, logo);
```

With TypeScript, add `"types": ["gss-lang/client"]` to `tsconfig.json` so `.gss` imports are typed.

An embedded scene behaves like the playground: drag turns the camera, the wheel zooms, `:hover`
works (`controls="none"` keeps only `:hover`). It starts when it comes into view, sleeps when it
leaves it, and stands still under `prefers-reduced-motion`. Images are read next to the `.gss`
file, like `url()` in a stylesheet.

## Why

Front-end developers already know how to describe what things look like. The moment they want to
go 3D, they hit GLSL: distance functions, vectors and math, written in a way that has little to do
with how they think about design. GSS is a way in: a familiar syntax to start creating in 3D today,
and a readable path toward the shader underneath. It is not meant to replace GLSL.

## What it can do

- **Structure**: `@scene { cube.corner * 4; torus#hero; }`, multiplication with auto-numbered ids,
  `group#g { … }` to move several shapes together.
- **Selectors and the cascade**: `shape`, `.class`, `#id`, `*`, lists, descendant (`a b`), child (`a > b`) and sibling (`a + b`, `a ~ b`) combinators,
  specificity, `!important`, `::face(front)` / `::top` / `::bottom` to style one face, and `:hover`
  (`#letters:hover cube` lights up a whole group, `sphere:hover + cube` reacts to its neighbour).
  `:has()` checks descendants or relative selectors: `group:has(> cube)`, `cube:has(+ sphere:hover)`.
- **Shapes**: `cube`, `sphere`, `torus`, `cylinder`, `cone`, `capsule`, `plane`, `path` (a tube
  along an SVG path) and `prism` (a `polygon()` or `path()` contour, extruded).
- **Materials**: `matte()`, `metal()`, `jelly()`, `glass()` with refraction and frost, and the
  shortcuts `gold`, `chrome`, `ice`.
- **Textures**: `texture: url("dirt.png")` projected on each face, a different image per face
  (the Minecraft grass block), `image-rendering: pixelated` and `texture-size` to repeat it.
- **Motion**: `@keyframes` and `animation`, computed on the GPU.
- **Math**: `calc()`, `min()`, `max()`, `clamp()`, trigonometry, and `sibling-index()` /
  `sibling-count()` for CSS-style loops.
- **Variables**: `--size: 2` and `var(--size, 1)`, inherited from the scene to groups to objects,
  and animatable in `@keyframes`.
- **Colors**: hex, `rgb()`, `hsl()` and the CSS named colors (`tomato`), with math and `var()`
  inside: `hsl(calc(sibling-index() * 45) 90% 60%)`.
- **The scene**: `floor`, `background`, `light`, `ambient` and an orbit camera.

Every property, shape, selector and function has its page in the
[reference](https://www.gss-lang.dev/docs), with a live example to edit.

## How it works

```
GSS text → tokenizer → parser → scene expansion → cascade → validation → GLSL codegen → WebGL2
```

Everything that can be decided at compile time is: the cascade, the selectors, the units,
`var()`, the math and the colors, in that order. The shader receives final values. The runtime
only holds what changes every frame (time, camera, the hovered object) and sends it as uniforms.

## Tools

- **Playground**: [gss-lang.dev/playground](https://www.gss-lang.dev/playground). Located errors,
  examples, the generated GLSL, share by URL, export to Shadertoy, and a formatter
  (`Shift+Alt+F`).
- **Reference**: [gss-lang.dev/docs](https://www.gss-lang.dev/docs), searchable, one live example
  per entry.
- **Showcase**: [gss-lang.dev/showcase](https://www.gss-lang.dev/showcase), what you can make, for
  designers, creative coders and developers.

## Status

Version 0.0.1: early, and moving fast. The syntax may still change between versions.

## License

[Apache 2.0](LICENSE).

## Brand

The mark, the wordmark, the icon and the social cards are on
[gss-lang.dev/brand](https://www.gss-lang.dev/brand).
