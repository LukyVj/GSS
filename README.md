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
`@scene`, style them with selectors, and the compiler turns the whole thing into GLSL and WGSL
fragment shaders: signed distance fields, raymarched in WebGL2 or WebGPU. No Three.js, no meshes, no UVs.

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

Three ways to put a scene on a page, using `gss-lang@0.0.3`.

The [installation guide](https://www.gss-lang.dev/docs#installation) covers npm, Vite and CDN setup.

**A tag, no build step.** Load `embed.js` once, then point a `<gss-scene>` at a `.gss` file, or
write the scene inside it:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/gss-lang@0.0.3/lib/embed.js"></script>

<gss-scene src="logo.gss"></gss-scene>
<gss-scene controls="none">
  <script type="text/gss"> @scene { sphere; } </script>
</gss-scene>
```

**A function, with any bundler.** The compiler runs in the page:

```sh
npm install gss-lang@0.0.3
```

```js
import { mount } from "gss-lang";

const scene = mount(canvas, "@scene { sphere; }");
scene.update(otherSource);
scene.destroy();
```

**Compiled at build time, with Vite.** The plugin is included in `gss-lang@0.0.3`; no separate plugin package is needed. The page ships a small runtime and the shader, not the
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

**WebGPU, with a WebGL2 fallback.** Use the asynchronous API to select a rendering backend:

```js
import { mountAsync } from "gss-lang";

const scene = await mountAsync(canvas, "@scene { sphere; }", { backend: "auto" });
console.log(scene.backend); // "webgpu" or "webgl"
await scene.update(otherSource);
scene.destroy();
```

`mountAsync` is also available from `gss-lang/runtime` for Vite-compiled scenes.
`auto` (the default for this API) tries WebGPU, then uses WebGL2 if adapter or device acquisition
fails. Use `backend: "webgpu"` or `"webgl"` to force a backend. WebGPU requires HTTPS or localhost.
The synchronous `mount()` API keeps using WebGL2. A tag can opt in with
`<gss-scene backend="auto" src="logo.gss"></gss-scene>`; its `scene.update()` then returns a promise.

`compile(source)` includes both targets: `scene.shader` is GLSL, `scene.wgsl` is WGSL, including
filter passes and media variants. `compile(source, { target: "glsl" })` omits WGSL when only WebGL2
is needed. Older precompiled scenes without WGSL work with WebGL2; recompile them to use WebGPU.
Shader errors reject an asynchronous update while keeping the previous scene visible. Runtime
device loss is reported through a `gss-error` event on the canvas; recreate the scene with a new
canvas to recover. Automatic fallback is an initialization feature, not device-loss recovery.

## Why

Front-end developers already know how to describe what things look like. The moment they want to
go 3D, they hit GLSL: distance functions, vectors and math, written in a way that has little to do
with how they think about design. GSS is a way in: a familiar syntax to start creating in 3D today,
and a readable path toward the shader underneath. It is not meant to replace GLSL.

## What it can do

- **Structure**: `@scene { cube.corner * 4; torus#hero; }`, multiplication with auto-numbered ids,
  `group#g { … }` to move several shapes together.
- **Selectors and the cascade**: `shape`, `.class`, `#id`, `*`, lists, descendant (`a b`), child (`a > b`) and sibling (`a + b`, `a ~ b`) combinators,
  specificity, `!important`, `::face(front)` / `::top` / `::bottom` to style one face, `:hover`
  (`#letters:hover cube` lights up a whole group, `sphere:hover + cube` reacts to its neighbour)
  and `:active` (pressed, with the mouse or a finger).
  `:has()` checks descendants or relative selectors: `group:has(> cube)`, `cube:has(+ sphere:hover)`.
  `:nth-child(odd)`, `:nth-of-type()`, `:first-child`… count the copies of `* n` one by one, and
  `:not()` leaves some out: `cube:not(:first-child, :last-child)`. Rules nest like CSS:
  `#g { cube { &:hover { color: white; } } }`.
- **Shapes**: `cube`, `sphere`, `torus`, `cylinder`, `cone`, `capsule`, `plane`, `path` (a tube
  along an SVG path) and `prism` (a `polygon()` or `path()` contour, extruded).
- **Materials**: `matte()`, `metal()`, `jelly()`, `glass()` with refraction and frost, and the
  shortcuts `gold`, `chrome`, `ice`.
- **Textures**: `texture: url("dirt.png")` projected on each face, a different image per face
  (the Minecraft grass block), `image-rendering: pixelated` and `texture-size` to repeat it.
- **Motion**: `@keyframes`, animation controls and easings (including `steps()`), computed on the GPU; `transition` for hover changes;
  scroll-driven animations with `animation-timeline: scroll()` and `view()`; a motion path with `offset-path`,
  and `transform-origin` to turn and scale around any point (a door on its hinge).
- **Math**: `calc()`, `min()`, `max()`, `clamp()`, trigonometry, and `sibling-index()` /
  `sibling-count()` for CSS-style loops.
- **Variables**: `--size: 2` and `var(--size, 1)`, inherited from the scene to groups to objects,
  and animatable in `@keyframes`. A variable registered with `@property` is set from the page at any
  moment, without compiling again: `scene.setProperty("--lift", "2")`
  ([set variables from JavaScript](https://www.gss-lang.dev/docs#set-variables)).
- **Colors**: hex, `rgb()`, `hsl()`, `oklch()`, `color-mix()` and the other CSS color functions, the
  CSS named colors (`tomato`) and `currentColor`, with math and `var()` inside:
  `hsl(calc(sibling-index() * 45) 90% 60%)`.
- **Gradients, noise and filters**: linear, radial and conic gradients on backgrounds and objects, animated with `@keyframes` and `:hover` (the scene animates its background); `noise()`, colors placed by a 3D noise (clouds, stone, marble); layers of background, with transparent colors and the blend modes of CSS (`background-blend-mode`); holes cut in objects by `mask-image`; images moved by a map with `displace()`, like SVG `feDisplacementMap`; color filters, blur, bloom and grain on scenes, objects and groups.
- **Responsive scenes**: `@media`, `light-dark()` and conditional `if()` values.
- **Generative values**: deterministic `random()`, inverse trigonometry, rounding, logarithms and `progress()`.
- **The scene**: `floor`, `background`, a sun with its color (`light`), a colored `ambient` light, `fog`, soft or
  hard `shadows` and an orbit camera. Lights are elements of the scene too: `@scene { light#bulb; }`, placed, animated and hovered like
  an object, with `color` and `intensity`.

Every property, shape, selector and function has its page in the
[reference](https://www.gss-lang.dev/docs), with a live example to edit.

## How it works

```
GSS text → tokenizer → parser → scene expansion → cascade → validation → shader generation
                                                                       ├─ GLSL → WebGL2
                                                                       └─ WGSL → WebGPU
```

Everything that can be decided at compile time is: the cascade, the selectors, the units,
`var()`, the math and the colors, in that order. The shader receives final values. The runtime
only holds what changes every frame (time, camera, the hovered and pressed objects, the scroll, the
variables the page sets) and sends it as uniforms.

## Tools

- **Playground**: [gss-lang.dev/playground](https://www.gss-lang.dev/playground). Every error
  of a scene at once, each under its line; examples, generated GLSL and WGSL, backend selection,
  share by URL, export to Shadertoy, a formatter (`Shift+Alt+F`) and a performance panel (`Alt+P`)
  for WebGL2 and WebGPU. It shows FPS, frame and CPU times, resolution, shader preparation time,
  and GPU time when the backend exposes timer queries. WebGPU uses optional `timestamp-query`;
  without it, GPU time is marked unavailable while the other measurements remain available.
- **Reference**: [gss-lang.dev/docs](https://www.gss-lang.dev/docs), searchable, one live example
  per entry.
- **Showcase**: [gss-lang.dev/showcase](https://www.gss-lang.dev/showcase), what you can make, for
  designers, creative coders and developers.

## Status

Version 0.0.3: early, and moving fast. The syntax may still change between versions.

See the [changelog](https://github.com/LukyVj/GSS/blob/main/CHANGELOG.md) for release history and unreleased changes.

## License

[Apache 2.0](LICENSE).

## Brand

The mark, the wordmark, the icon and the social cards are on
[gss-lang.dev/brand](https://www.gss-lang.dev/brand).
