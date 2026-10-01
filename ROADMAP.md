# ROADMAP — GSS

A living list of the next features. Tick an item or move it to **Done recently** once it ships.

**Rule:** every new feature or entry goes into the **registry** (in the right place) **and** into the **docs** (syntax, example, etc.).

## Already in GSS (Oct. 1, 2026)

What the language and the tools can do today. Each feature is detailed in the registry (so in the docs), and the "why" is in `DECISIONS.md` (column _Dec._).

### Language

| Feature              | Syntax                                                                                                                                                                                      | Dec.                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Scene structure      | `@scene { cube.corner * 4; torus#hero; }`, `;` optional between elements                                                                                                                    | 2, 11, 46             |
| Multiplication       | `cube * 12`; numbered ids: `cube#petal * 12` → `#petal-1` … `#petal-12`                                                                                                                     | 3                     |
| Groups               | `group#g { … }`: transforms and animation apply to the children, positions are relative                                                                                                     | 45, 48                |
| Scene styling        | `scene { floor; background; light; ambient; camera-* }`                                                                                                                                     | 11, 15, 16            |
| Selectors            | `<shape>`, `.class`, `#id`, `*`, lists `a, b`, descendant `a b`, child `a > b`, siblings `a + b` / `a ~ b`, faces `::face(front)`, `::top`, `::bottom`, `:hover` (on objects and their groups), `:has()` (`#g:has(sphere:hover) cube`) | 4, 37, 47, 59, 62, 69, 73 |
| Cascade              | specificity (id 10,000, class 100, tag 1), last one wins, `!important` in 2 passes                                                                                                          | 4, 38                 |
| Animation            | `@keyframes` (`from`, `to`, `%`), `animation: name duration [easing] [delay] [count \| infinite] [direction] [fill-mode]` and the six longhands, computed in the shader                     | 21, 22, 23, 24, 70    |
| Easings              | `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end`, `cubic-bezier()`, `linear()`, `steps()`, in `@keyframes` and `transition` | 68, 80                |
| Media queries        | `@media (…) { … }`: any query the browser knows (width, orientation, `prefers-color-scheme`, `prefers-reduced-motion`…), up to 4 per scene, switched live                                   | 71                    |
| Math                 | `calc()`, `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()`, trigonometry and its inverses (`asin()` … `atan2()`), `sign()`, `round()`, `mod()`, `rem()`, `hypot()`, `log()`, `exp()`, `progress()`, `pi`, `e` | 52, 78                |
| Variables            | `--size: 2`, `var(--size, 1)`; inherited scene → group → object, a variable can use another, animatable in `@keyframes`                                                                     | 55                    |
| Colors               | `#ff5a36`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`, `color-mix()`, `light-dark()`, `contrast-color()`, the 148 CSS names (`tomato`) where a color is expected; math and `var()` inside | 58, 79                |
| CSS-style loops      | `sibling-index()`, `sibling-count()`: each copy of a `* n` gets its own value                                                                                                               | 52                    |
| Units                | angles `deg` `rad` `turn` (always with a unit), durations `s` `ms`, `%`                                                                                                                     | 9, 17, 20             |
| Modern CSS functions | commas or spaces: `metal(#d4af37, 0.2)`, `polygon(0 1, 1 0, -1 0)`                                                                                                                          | 28                    |

### Shapes (10)

| Shape                 | Own properties                                                                                        | Dec.   |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| `cube`                | `size` (1 or 3 values), `corner-radius`                                                               | 14, 36 |
| `sphere`              | `radius`                                                                                              | 14     |
| `torus`               | `radius`, `thickness`                                                                                 | 14     |
| `cylinder`, `capsule` | `radius`, `height`                                                                                    | 36     |
| `cone`                | `radius` (bottom, top), `height`                                                                      | 36     |
| `plane`               | `size` (1 or 2 values)                                                                                | 40     |
| `path`                | a tube along an SVG path: `d: path("M… C… A…")`, `stroke-width`, `view-box`                           | 35, 49 |
| `prism`               | a filled contour given a depth: `d: polygon(…)` or `d: path(…)` (even-odd holes), `depth`, `view-box` | 41, 50 |
| `group`               | draws nothing, holds the others                                                                       | 45     |

All centered on their origin, dimensions as full sizes (dec. 36).

### Object properties

| Family       | Properties                                                                                         | Dec.   |
| ------------ | -------------------------------------------------------------------------------------------------- | ------ |
| Transforms   | `translate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale` (uniform)                                 | 13     |
| Look         | `color`, `material`                                                                                | 26     |
| Textures     | `texture: url("…")`, `image-rendering: pixelated`, `texture-size`                                  | 59     |
| Combinations | `operation: union \| subtract \| intersect`, `blend` (smooth union)                                | 18, 19 |
| Animation    | `animation`; animatable: `translate`, `rotate-*`, `scale`, `color` (also what `:hover` can change) | 24, 62 |
| Transition   | `transition: 0.3s ease-out`, one per object; easings: keywords, `cubic-bezier()`, `linear()`       | 68     |

### Materials

| Material | Syntax                                                                                              | Dec.       |
| -------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Matte    | `matte([color])` (default)                                                                          | 27         |
| Metal    | `metal([color,] [roughness])`; shortcuts `gold`, `chrome`                                           | 27, 29     |
| Jelly    | `jelly([color,] [density])`; shortcut `jelly`                                                       | 27         |
| Glass    | `glass([tint,] [index] [, frosted \| wavy \| hammered \| blurred frost])`; shortcuts `glass`, `ice` | 27, 31, 32 |

### Scene

| Property                                                          | Role                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `floor`                                                           | floor color, or `none`                                                               |
| `background`                                                      | background color                                                                     |
| `light`, `ambient`                                                | direction of the sun, ambient light                                                  |
| `dpr`                                                             | pixel density of the render: `auto` (the screen, up to 2), `max`, a number (dec. 67) |
| `camera-target`, `camera-distance`, `camera-angle`, `camera-spin` | camera (mouse orbit; automatic turn as a duration, `none` by default, dec. 54)       |

### Rendering

| Feature                                                                                                                                                  | Dec.     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Everything compiled into **a single GLSL fragment shader**, SDF raymarching, WebGL2, no Three.js                                                         | 1, 5, 30 |
| One reflection (1 bounce), glass refraction (in + out), procedural frost                                                                                 | 29, 31   |
| Everything is computed, except the images of `texture`: projected on each face (triplanar), at most 16 per scene                                         | 1, 59    |
| Minimal shader: only the GLSL the scene uses goes in (an empty scene: 104 lines)                                                                         | 53       |
| `:hover`: a 1-pixel picking pass under the mouse, `uHover[]` mixed into every hovered property                                                           | 62       |
| `:hover` read without waiting for the GPU: a pixel buffer and a fence (`runtime/picker.ts`)                                                              | 65       |
| `map()` skips a `path` or a `prism` whose bounding sphere is further than the nearest object: same image, macropad −37 %, logo −50 % on the GPU at dpr 2 | 66       |
| Animations and `:hover` computed once per pixel, in `animate()`                                                                                          | 75       |
| A sphere around the whole scene: a ray that passes by it only meets the floor                                                                            | 76       |
| One bounding test per group of 3 objects or more                                                                                                         | 77       |

### Tools

| Tool                       | Where                                                                                                                                                                        | Dec.       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Home page                  | `/` (`index.html`), live demo, numbers read from the registry                                                                                                                | 51         |
| Playground                 | `playground.html`: CodeMirror, code in the URL (sharing), examples, GLSL tab                                                                                                 | 34         |
| Status bar                 | `ok · 0 objects · glsl 104 lines · compiled in 4 ms · 60 fps`                                                                                                                | 42         |
| Located errors             | underlined, and written under their line (`15:3 …`)                                                                                                                          | 43         |
| Generated docs             | `docs.html`, one page per entry, from the registry, live "Try it" everywhere                                                                                                 | 12, 39, 44 |
| Site                       | [gss-lang.dev](https://gss-lang.dev) on Vercel, clean URLs (`/playground`, `/docs`, `/brand`), Open Graph and X cards                                                        | 56         |
| Brand page                 | `/brand` (`brand.html`): marks, wordmark, lockup, icons, social cards                                                                                                        | 57         |
| Shadertoy export           | `→ shadertoy` button in the playground, images in `iChannel0`…`3` (at most 4)                                                                                                | 60         |
| Analytics                  | DocSearch Insights (Algolia) + Umami, events through `track()`                                                                                                               | 61         |
| Formatter                  | `formatGss`, `Shift+Alt+F` in the playground                                                                                                                                 | 33         |
| VS Code / Cursor extension | highlighting, formatter, icon for `.gss` files                                                                                                                               | 33         |
| Design                     | `DESIGN.md` "Distance field", tokens in `src/styles/tokens.css`, what every page shares in `src/styles/site.css` (`@layer site`: a page's own `<style>` always wins)         | –          |
| npm package                | [`gss-lang`](https://www.npmjs.com/package/gss-lang) 0.0.1 (tag `v0.0.1`), Apache-2.0: `gss-lang` (compiler + `mount`), `gss-lang/runtime`, `gss-lang/vite`                  | 63         |
| Scenes                     | every demo `.gss` in `src/scenes/` (playground examples, showcase, bench), all compiled by `gpu.test.ts`                                                                     | 63         |
| Tests                      | Vitest (CPU) + GPU compilation of every registry example (Chromium)                                                                                                          | 12, 25     |
| Profiler (dev only)        | a panel over the playground scene, `perf` button or Alt+P: fps, frame, GPU and CPU time, real pixels, shader build time; over budget in signal                               | 64         |
| Bench                      | `npm run bench:compare -- main --dpr 2`: another commit against the working tree, 3 alternating rounds, images compared pixel by pixel, report in `bench-results/compare.md` | 64         |

## Priorities

1. [x] Loops: **option B chosen** (decision 52): `* n` + `calc(sibling-index())`, as in CSS. `@for` / `@each` later, only to change the shape at each step or to walk through a list
2. [x] `var()` ✅ decision 55, inherited and animatable (+ `calc()` ✅ decision 52, with `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()`, `sin()`, `cos()`, `tan()`; every other CSS math function ✅ decision 78)
3. [x] Functional colors: `rgb()`, `hsl()` and the named colors ✅ decision 58; `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`, `color-mix()`, `light-dark()`, `contrast-color()` ✅ decision 79
4. [x] Textures: `texture: url("…")`, one image per face, `::face()` (decision 59)
5. [x] Animation controls ✅ decision 70: delay, iteration count, direction, fill mode, and the six longhands
6. [x] `@media` ✅ decision 71: any media query the browser knows (width, orientation, `prefers-color-scheme`, `prefers-reduced-motion`…), up to 4 per scene
7. [ ] Selectors / nesting: combinators `>` `+` `~` ✅ decision 73 (including relative selectors in `:has()`); nested style rules with `&` still to do
8. [x] `:hover` ✅ decision 62 (picking pass → `uHover[]`), `transition` ✅ decision 68 (one per object; per-property lists later), `:has()` ✅ decision 69 (`#g:has(sphere:hover) cube`, any selector inside)
9. [ ] `transform-origin`
10. [ ] Fog
11. [x] `sibling-index()` + `sibling-count()` (decision 52)
12. [ ] Motion path

## Embedding and showcase (decision 63)

A page of real use cases, for designers, creative coders and developers, needs scenes that live outside gss-lang.dev. Three ways to embed a scene, all in v1, then the page that uses them.

1. [x] **Split the compiler from the runtime**: `runtime/view.ts` draws a `CompiledScene` and never imports the compiler; `createRenderer` (`load(source)`) becomes a thin layer on top of it. Without this, every page that draws also ships the compiler.
2. [x] **`mount(canvas, scene, options)`** (`src/embed/`): the scene sleeps when it leaves the screen, `prefers-reduced-motion` freezes the time, images are resolved against the `.gss` file (`base`), mouse controls like the playground (`controls: false` → hover only).
3. [x] **`<gss-scene>`**: `src="logo.gss"` or the code inline in a `<script type="text/gss">`, `controls="none"`; the WebGL context is only created when the element comes into view. Built as `embed.js` (a second Vite build) and served by gss-lang.dev: no npm, no build step for designers.
4. [x] **The Vite plugin** (`gss-lang/vite`): `import scene from "./logo.gss"` compiles at build time; the page only ships the runtime and the shader. GSS errors show in Vite's terminal; relative images become Vite assets.
5. [x] **The npm package** ✅ `gss-lang` 0.0.1 published on npm (Apache-2.0 license, public README, `CONTRIBUTING.md`), tagged `v0.0.1`: `gss-lang` (compiler + mount), `gss-lang/runtime` (mount only) and `gss-lang/vite`, with types.
6. [x] **`showcase.html`**: use cases by audience at the top (designers: an SVG logo in 3D, a themable icon set; creative coders: generative loops, the Shadertoy export; developers: a hero with `:hover`, a scene written by an LLM), an inspiration grid below (captures that open the playground with `#code=`). Built with `<gss-scene>`: the site uses its own embed. The demos are written by Lucas; every demo is a `.gss` file that `gpu.test.ts` compiles.
7. [x] **An "Embedding" entry in the docs**, with the three snippets.

Next, on this page:

- [ ] **Lucas's demos** replace the six starter use-case scenes (now in `src/scenes/`, with the LLM one coming from a real, unedited run), then `npm run captures`. Started: L'Orrery, the macro pad and Tidal are in the inspiration grid, with their captures
- [x] Home page: the logo reveal (the SVG mark in front, the same logo live in GSS behind, a slider between the two)
- [ ] Captures of the registry examples show the light default floor: to revisit with the floor decision
- [x] A license, then `npm publish` (and the `npm i gss-lang` / GitHub links on the home page)
- [ ] Ctrl/Cmd + wheel to zoom an embedded scene, if the wheel that stops the page scroll gets in the way
- [ ] `<gss-scene>` in the VS Code extension's HTML snippets

## Later

### Product / surface

- [x] Landing page (`/`, decision 51)
- [x] Root README
- [ ] Rename the folder / GitHub repo `csl` → `gss` (the npm package is already `gss-lang`)
- [x] npm publishing: `gss-lang` 0.0.1

### Playground

- [ ] `view: distance` / `view: shaded` (promised in the design, missing)

### Performance

Measured with the bench at dpr 2 (M4 Pro, Oct. 1), GPU median, after decisions 75–77: orrery 7.5 ms (was 20.3), todal 3.9 ms (24.3), macropad 4.0 ms (17.4), test scene 5.2 ms, spiral 3.7 ms, logo 2.8 ms: every scene under the 8.3 ms of 120 Hz. Every item below must keep the image (the bench compares it pixel by pixel; stray pixels from GPU rounding are accepted, decision 74).

- [x] **Animations once per pixel**, in `animate()` (decision 75): L'Orrery 20.3 → 9.2 ms
- [x] **A sphere around the whole scene** (decision 76): a ray that passes by it only meets the floor; todal −18 %, spiral −15 %
- [x] **Bounds on whole groups**, one test per group of 3 objects or more (decision 77): macropad 16.6 → 4.0 ms, todal 19.4 → 3.9 ms
- Set aside: animations computed on the CPU and sent as uniforms (decision 75: after `animate()`, it would only save one evaluation per pixel, and the image would change)
- [x] `scene { dpr: auto | max | <number>; }`: the pixel density of the render, chosen by the author (decision 67). With `@media` (decision 71): `@media (max-width: 600px) { scene { dpr: 1; } }`

### Shapes / rendering

- [x] Solid fill of a path: `prism` with `d: path(…)`, holes included (decision 50)
- [ ] `lathe` (mentioned as a future shape)
- [ ] Lost ray: when `march` runs out of its 100 steps without hitting anything or passing `MAX_DIST`, `main()` treats it as a hit (fixed for rays that pass by the sphere of the scene, decision 76; still there in scenes without one)
- [ ] Fade the floor into the background: the floor stops sharply at `MAX_DIST` (related to fog, priority #10)
- [ ] Soft shadows, that can be turned off (`scene { shadows: none; }`?)
- [ ] Optional antialiasing (4× the cost)
- [ ] Measure the compile time of large scenes; if needed, loop in `calcNormal` so `map()` is copied only once

### Textures (after decision 59)

- [ ] A soft blend between faces (triplanar weights), for stone or bark on round shapes
- [ ] `texture-mapping: sphere`: the image wraps a sphere like a map around a globe (planets)
- [ ] Images in the playground: drag and drop, and in share links (data URLs?)
- [ ] Unmirror the −x, −z and bottom faces
- [ ] Textures in reflections and glass (`trace()` → `textureColor()`)
- [ ] `image-rendering` per face; `url(dirt.png)` without quotes; an atlas

### Rendering passes / runtime API

- [ ] **Post-processing as a `filter` list on the scene**: the scene is drawn into a texture (color, plus depth and normals), then small shaders run on the image, in order, like CSS `filter`: `scene { filter: bloom(.8, 1.4) grain(.05) contrast(1.1); }`. Opens bloom, grain, chromatic aberration, depth of field, `backdrop-filter` later, and a fog drawn from the depth. Still one raymarcher for the whole scene (never one shader per object). Cost: one more pass and framebuffers, only when `filter` is used; the Shadertoy export would need its Buffers A, B…
- [ ] **Custom properties set from JS without recompiling**: `scene.setProperty('--speed', 8)` on what `mount()` / `<gss-scene>` return, like `element.style.setProperty`. A variable declared as drivable (close to `@property`) becomes a uniform; the others stay resolved at compile time. Lets a page drive a scene from the scroll, a slider or data

### Backend

- [ ] WGSL / WebGPU (`"later"` in the docs)

### Quality / DX

- [ ] Report several errors per compile (today it stops at the first one)
- [x] Document `floor: none` in the registry
- [x] Update `DECISIONS.md` (groups: decisions 45 to 48)
- [ ] Split `shader/codegen.ts` (about 1,750 lines) by concern, and move `readAngle` / `readNumber` to `values/`
- [ ] Align the TextMate highlighting of the extension with `classifyGss` (web)

## Out of scope

- GLTF, classic meshes: deliberately out of scope for now
- Non-uniform scale (outside exact SDFs today, see Under discussion)

## Under discussion

- Non-uniform scale: stay with exact SDFs, or accept an approximation?
- When to rename the `csl` folder and repo → `gss` (the npm package already ships as `gss-lang`).
- Gamma correction: more natural light, but it changes the look of every existing scene.
- Shadows on by default or not (cost: one more ray march per pixel).
- Author-written shaders: `@shader hologram { … }` with a GLSL body and its own parameters, used as `shader: hologram; --intensity: 1.5;` (an escape hatch, like Houdini's `paint()`). Powerful, but how to report errors in the GLSL, keep the Shadertoy export, and stay a language an LLM writes without mistakes?
- Composing surface effects (a "textual shader graph"): to be split before deciding: deforming the shape with noise (a `displace` property, it changes the SDF and can slow the ray march), a `toon` material next to the others, and lighting effects (rim light, fresnel).

## Done recently

- `steps()`, `step-start` and `step-end`, in `@keyframes` and `transition` (decision 80)
- The rest of the CSS color functions: `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`, `color-mix()`, `light-dark()` (one version of the scene per color scheme), `contrast-color()` (decision 79)
- Every CSS math function: `asin()`, `acos()`, `atan()`, `atan2()`, `sign()`, `round()` (and its four strategies), `mod()`, `rem()`, `hypot()`, `log()`, `exp()`, `progress()` (decision 78)
- Performance with the same image (decisions 74–77): `animate()`, the sphere of the scene, bounds on groups; L'Orrery 20.3 → 7.5 ms, macropad 17.4 → 4.0 ms, todal 24.3 → 3.9 ms at dpr 2; the bench accepts stray pixels (GPU rounding)
- Child (`>`), adjacent sibling (`+`) and subsequent sibling (`~`) combinators, including mixed chains, `:hover` and relative `:has()` selectors (decision 73)

- Home page: the logo reveal, the SVG mark and the same logo live in GSS on either side of a slider (`src/home/logo-reveal.ts`)
- `src/compiler/` sorted by pipeline stage: `syntax/`, `cascade/`, `values/`, `features/`, `shader/`, `registry/`, end-to-end tests in `tests/` (decision 72)
- Scenes gathered in `src/scenes/`; three of Lucas's scenes in the showcase (L'Orrery, the macro pad, Tidal) with their captures
- Release 0.0.1: `gss-lang` on npm (passed the staged review), Apache-2.0 license, public README, `CONTRIBUTING.md`, tag `v0.0.1`
- `@media`, like CSS: one version of the scene per combination of its queries, switched when the screen changes (decision 71)
- Animation controls: delay, iteration count, direction, fill mode, and `animation-duration`, `-delay`, `-iteration-count`, `-direction`, `-fill-mode`, `-timing-function` (decision 70)
- `:has()`, like CSS: a group that holds a match, at compile time or under the mouse (`#g:has(sphere:hover) cube`), any selector inside (decision 69)
- Easings (`ease`, `ease-in`, `ease-out`, `cubic-bezier()`, `linear()`) in `@keyframes` and `transition`, which glides `:hover` in both directions like CSS (decision 68)
- `scene { dpr: auto | max | <number>; }`: the pixel density of the render, chosen by the author (decision 67)
- Performance tools and two speed-ups with an identical image (Oct. 1): the dev profiler and the bench (decision 64), `:hover` without a GPU wait (decision 65), bounding spheres for `path` and `prism` in `map()` (decision 66)
- Embedding and showcase: `<gss-scene>` / `embed.js`, `mount()`, the Vite plugin, a runtime without the compiler (10 kB), `showcase.html`, `npm run captures` (decision 63)
- `:hover`: triggers, a second cascade, `uHover[]` in the shader and a picking pass, on the home page, the playground and every "Try it" (decision 62)
- Textures: `texture: url("…")`, `::face()` / `::top` / `::bottom`, `image-rendering: pixelated`, `texture-size`: the Minecraft dirt and grass blocks (decision 59)
- `rgb()`, `hsl()` and the 148 CSS named colors, only where a color is expected (decision 58)
- Custom properties and `var()`, inherited and animatable (decision 55)
- The descendant combinator `#letters #S #left` (decision 47)
- Site on gss-lang.dev (Vercel, clean URLs, Open Graph and X cards) and brand page (decisions 56, 57)
- Group styles and transforms
- SVG arcs in paths
- "Distance field" design
- Prism filled from a `path()` (decision 50)
- Home page, playground moved to `playground.html` (decision 51)
- `calc()`, `sibling-index()`, `sibling-count()` and the CSS math functions (decision 52)
- Minimal shader: only the GLSL the scene uses, output without empty sections or extra blank lines (decision 53)
- `camera-spin: none` by default (decision 54)

## CSS → GSS fit (0–1)

A score for how well a CSS notion carries over to GSS (a style language → an SDF shader / scene). **1.0** = already in GSS, or a direct priority of the roadmap (`var`, colors, animation controls, `@media`, `:hover`, etc.). **0.8–0.9** = maps well, at compile time or in the shader/scene (`transform-origin`, nesting, `:nth-child`, `@import`, easings, `color-mix`, object `opacity`, `filter` as a post-process, fog, motion path, `@property` later). **0.5–0.7** = partial, possible later (layers, `@supports`, `@container`, `random`, `:is`/`:where`/`:not`, `@scope`, mixins/`@function`, `backdrop-filter` as a post-process, CSG-like masks, scroll timelines reframed…). **0.2–0.4** = weak, a stretch. **0.0–0.1** = poor fit (flex/grid/box flow, fonts/text, scroll chrome, forms, page breaks, float, painter-order `z-index`, DOM view transitions, shadow DOM, counters/lists, `@charset`/`@namespace`, most `-moz-`/`-webkit-` UI).

### Properties by theme

#### Animation & transitions

| Feature                               | Score | Short note                      |
| ------------------------------------- | ----: | ------------------------------- |
| `animation` (shorthand)               |   1.0 | Already in GSS                  |
| `animation-name`                      |   1.0 | Tied to `@keyframes`            |
| `animation-duration`                  |   1.0 | Already in GSS (decision 70)    |
| `animation-timing-function`           |   1.0 | Already in GSS (decision 70)    |
| `animation-delay`                     |   1.0 | Already in GSS (decision 70)    |
| `animation-iteration-count`           |   1.0 | Already in GSS (decision 70)    |
| `animation-direction`                 |   1.0 | Already in GSS (decision 70)    |
| `animation-fill-mode`                 |   1.0 | Already in GSS (decision 70)    |
| `animation-play-state`                |   0.7 | Runtime pause possible          |
| `animation-composition`               |   0.5 | Blending tracks, later          |
| `animation-timeline`                  |   0.5 | If reframed (scene time/scroll) |
| `animation-range` / `-start` / `-end` |   0.5 | Same, timelines                 |
| `transition` (shorthand)              |   1.0 | Already in GSS (decision 68)    |
| `transition-property`                 |   1.0 | Same                            |
| `transition-duration`                 |   1.0 | Same                            |
| `transition-delay`                    |   1.0 | Same                            |
| `transition-timing-function`          |   1.0 | Already in GSS (decision 68)    |
| `transition-behavior`                 |   0.4 | Little use for SDFs             |
| `timeline-scope`                      |   0.4 | DOM-centric                     |
| `interpolate-size`                    |   0.2 | Box layout                      |

#### Transforms & motion path

| Feature                                               | Score | Short note                             |
| ----------------------------------------------------- | ----: | -------------------------------------- |
| `transform`                                           |   0.9 | Already split (translate/rotate/scale) |
| `transform-origin`                                    |   1.0 | Roadmap priority #9                    |
| `transform-style`                                     |   0.6 | 3D groups already; preserve-3d limited |
| `transform-box`                                       |   0.3 | Box CSS                                |
| `translate`                                           |   1.0 | Already in GSS                         |
| `rotate`                                              |   0.9 | Close to `rotate-x/y/z`                |
| `scale`                                               |   1.0 | Already in (uniform, SDF)              |
| `perspective` / `perspective-origin`                  |   0.7 | Rather the scene camera                |
| `backface-visibility`                                 |   0.3 | Raster faces                           |
| `offset` / `offset-path` / `offset-distance`          |   0.9 | Motion path, priority #12              |
| `offset-rotate` / `offset-anchor` / `offset-position` |   0.8 | Motion path, continued                 |

#### Colors, opacity, compositing

| Feature                                      | Score | Short note                          |
| -------------------------------------------- | ----: | ----------------------------------- |
| `color`                                      |   1.0 | Already in GSS                      |
| `opacity`                                    |  0.85 | Object / volume, with care          |
| `color-scheme`                               |   0.4 | UI chrome                           |
| `print-color-adjust` / `forced-color-adjust` |   0.1 | Print / a11y UA                     |
| `dynamic-range-limit`                        |   0.2 | HDR display                         |
| `mix-blend-mode`                             |   0.5 | Post-process / limited SDF blending |
| `background-blend-mode`                      |   0.3 | 2D layers                           |
| `isolation`                                  |   0.3 | Stacking context                    |

#### Backgrounds & borders (surface / decoration)

| Feature                                                                           | Score | Short note                          |
| --------------------------------------------------------------------------------- | ----: | ----------------------------------- |
| `background` (shorthand)                                                          |   0.6 | → scene `background` / material     |
| `background-color`                                                                |   0.7 | Scene already                       |
| `background-image`                                                                |   0.4 | Done as `texture` (dec. 59)         |
| `background-position` / `-size` / `-repeat` / `-clip` / `-origin` / `-attachment` |   0.2 | Box painting                        |
| `background-position-x/y` / `background-repeat-x/y`                               |   0.1 | Same                                |
| `border` (+ longhands color/style/width/sides)                                    |   0.2 | Box model                           |
| `border-radius` (+ corners)                                                       |   0.7 | Close to the cube’s `corner-radius` |
| `border-image` (+ longhands)                                                      |   0.2 | 2D image border                     |
| `border-collapse` / `border-spacing`                                              |   0.0 | Tables                              |
| `border-block*` / `border-inline*` / logical radii                                |   0.1 | Logical box                         |
| `border-shape` / `corner-shape` (+ corner-\*-shape)                               |   0.5 | Corner shape → SDF, a stretch       |
| `box-shadow`                                                                      |   0.5 | Soft shadow / AO-like               |
| `box-decoration-break`                                                            |   0.1 | Fragmentation                       |
| `outline` (+ longhands)                                                           |   0.1 | Focus UI                            |
| `-webkit-border-before`                                                           |   0.0 | Vendor UI                           |

#### Filter, mask, clip

| Feature                                                               | Score | Short note                                  |
| --------------------------------------------------------------------- | ----: | ------------------------------------------- |
| `filter`                                                              |  0.85 | Post-process passes on the scene (Later)    |
| fog (GSS / atmosphere, not a strict CSS property)                     |   1.0 | Roadmap priority #10; fog-like post-process |
| `backdrop-filter`                                                     |   0.6 | Post-process behind the object              |
| `mask` (+ clip/composite/image/mode/origin/position/repeat/size/type) |  0.55 | CSG / alpha mask adjacent                   |
| `mask-border` (+ longhands)                                           |   0.2 | Box mask image                              |
| `-webkit-mask-*`                                                      |   0.1 | Vendor                                      |
| `clip-path`                                                           |   0.6 | Cutting → SDF / CSG                         |
| `clip` / `clip-rule`                                                  |   0.3 | Legacy / SVG rule                           |
| `-webkit-box-reflect`                                                 |   0.3 | Mirror stretch                              |

#### Box model, display, sizing, position, float, z

| Feature                                                                       | Score | Short note                              |
| ----------------------------------------------------------------------------- | ----: | --------------------------------------- |
| `display`                                                                     |   0.1 | Box tree                                |
| `width` / `height` / `min-*` / `max-*`                                        |   0.3 | Object size ≠ box; GSS `height` = shape |
| `block-size` / `inline-size` / logical min/max                                |   0.1 | Logical box                             |
| `aspect-ratio`                                                                |   0.4 | Shape size constraint                   |
| `box-sizing`                                                                  |   0.0 | Box model                               |
| `margin` (+ longhands / logical / trim)                                       |   0.1 | Flow                                    |
| `padding` (+ longhands / logical)                                             |   0.1 | Flow                                    |
| `inset` / `top` / `right` / `bottom` / `left` (+ logical)                     |   0.2 | CSS positioning                         |
| `position`                                                                    |   0.2 | Containing block                        |
| `position-anchor` / `position-area` / `position-try*` / `position-visibility` |   0.2 | Anchor positioning DOM                  |
| `anchor-name` / `anchor-scope`                                                |   0.2 | Same                                    |
| `float` / `clear`                                                             |   0.0 | Flow                                    |
| `z-index`                                                                     |   0.1 | Painter order ≠ SDF                     |
| `visibility` / `content-visibility` / `overlay`                               |   0.3 | Show/hide an object, weak               |
| `overflow` (+ x/y/block/inline/clip-margin/wrap)                              |   0.1 | Scrollport                              |
| `overflow-anchor`                                                             |   0.0 | Scroll anchoring                        |
| `resize`                                                                      |   0.0 | UI                                      |
| `contain` / `contain-intrinsic-*`                                             |   0.2 | Perf layout                             |
| `container` / `container-name` / `container-type`                             |   0.5 | With `@container`                       |

#### Flexbox, grid, alignment, multi-column, gaps

| Feature                                                                   | Score | Short note      |
| ------------------------------------------------------------------------- | ----: | --------------- |
| `flex` / `flex-*` / `order`                                               |   0.0 | Layout 1D       |
| `grid` / `grid-*`                                                         |   0.0 | Layout 2D       |
| `place-*` / `align-*` / `justify-*`                                       |   0.1 | Box alignment   |
| `gap` / `row-gap` / `column-gap`                                          |   0.2 | Layout spacing  |
| `columns` / `column-*` / `column-rule*` / `column-wrap` / `column-height` |   0.0 | Multi-col       |
| `row-rule*` / `rule*`                                                     |   0.0 | Gap decorations |
| Legacy `box-*` (flexbox old)                                              |   0.0 | Deprecated      |

#### Fonts, text, lists, counters, ruby, math

| Feature                                                                                                                                                                                                                                   | Score | Short note             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | ---------------------- |
| `font` / `font-*` (family, size, weight, style, variant\*, stretch, width, kerning, …)                                                                                                                                                    |  0.05 | Text, out of SDF scope |
| `font-smooth` / `font-synthesis*` / `font-palette` / `font-language-override` / `font-optical-sizing` / `font-size-adjust` / `font-variation-settings` / `font-feature-settings`                                                          |  0.05 | Same                   |
| `letter-spacing` / `word-spacing` / `word-break` / `line-break` / `line-height` / `line-clamp` / `line-height-step`                                                                                                                       |  0.05 | Text layout            |
| `text-align*` / `text-indent` / `text-justify` / `text-transform` / `text-wrap*` / `text-overflow` / `text-orientation` / `text-combine-upright` / `text-autospace` / `text-spacing-trim` / `text-fit` / `text-size-adjust` / `text-box*` |  0.05 | Same                   |
| `text-decoration*` / `text-emphasis*` / `text-underline-*` / `text-shadow` / `text-rendering` / `text-anchor`                                                                                                                             |   0.1 | Text decoration        |
| `-webkit-text-fill-color` / `-webkit-text-stroke*` / `-webkit-text-security`                                                                                                                                                              |   0.0 | Vendor text            |
| `white-space` / `white-space-collapse` / `tab-size` / `hyphens` / `hyphenate-*` / `hanging-punctuation` / `quotes` / `unicode-bidi` / `direction` / `writing-mode`                                                                        |  0.05 | Text / bidi            |
| `vertical-align` / `initial-letter`                                                                                                                                                                                                       |  0.05 | Inline layout          |
| `list-style*`                                                                                                                                                                                                                             |   0.0 | Lists                  |
| `counter-increment` / `counter-reset` / `counter-set`                                                                                                                                                                                     |   0.1 | Counters               |
| `ruby-*` / `math-*`                                                                                                                                                                                                                       |   0.0 | Ruby / MathML          |
| `speak-as`                                                                                                                                                                                                                                |   0.0 | Aural                  |

#### Images, object-fit, SVG presentation

| Feature                                                                     | Score | Short note                           |
| --------------------------------------------------------------------------- | ----: | ------------------------------------ |
| `object-fit` / `object-position` / `object-view-box`                        |   0.2 | Replaced content                     |
| `image-rendering`                                                           |   1.0 | Already in GSS (dec. 59)             |
| `image-orientation` / `image-resolution`                                    |   0.2 | Weak                                 |
| `fill` / `fill-opacity` / `fill-rule`                                       |   0.5 | Path fill / extrusion                |
| `stroke` / `stroke-*`                                                       |   0.7 | Close to `stroke-width` of GSS paths |
| `paint-order` / `vector-effect` / `shape-rendering`                         |   0.3 | SVG paint                            |
| `marker` / `marker-*`                                                       |   0.2 | SVG markers                          |
| `stop-color` / `stop-opacity`                                               |   0.4 | Gradients stops                      |
| `flood-color` / `flood-opacity` / `lighting-color` / `color-interpolation*` |   0.3 | SVG filters                          |
| `cx` / `cy` / `r` / `rx` / `ry` / `x` / `y` / `d`                           |   0.6 | Geometry; `d` already a path         |
| `path-length`                                                               |   0.5 | Motion / dash                        |

#### Shapes (float area) & tables & fragmentation & pages

| Feature                                                             | Score | Short note    |
| ------------------------------------------------------------------- | ----: | ------------- |
| `shape-outside` / `shape-margin` / `shape-image-threshold`          |   0.2 | Float shapes  |
| `table-layout` / `caption-side` / `empty-cells` / `border-collapse` |   0.0 | Tables        |
| `break-before` / `break-after` / `break-inside`                     |   0.0 | Fragmentation |
| `page-break-*` / `page` / `orphans` / `widows`                      |   0.0 | Pages         |
| `box-decoration-break`                                              |   0.1 | Fragments     |

#### Scroll, scrollbars, overscroll, snap, scroll-driven

| Feature                                                                                   | Score | Short note                      |
| ----------------------------------------------------------------------------------------- | ----: | ------------------------------- |
| `scroll-behavior` / `scroll-margin*` / `scroll-padding*`                                  |   0.1 | Scroll UI                       |
| `scroll-snap-*` / `scroll-initial-target` / `scroll-target-group` / `scroll-marker-group` |   0.1 | Snap chrome                     |
| `scrollbar-*`                                                                             |   0.0 | Scrollbar styling               |
| `overscroll-behavior*`                                                                    |   0.0 | Overscroll                      |
| `scroll-timeline*` / `view-timeline*`                                                     |   0.5 | Timelines reframed to the scene |
| `touch-action` / `-webkit-touch-callout` / `-webkit-tap-highlight-color`                  |   0.0 | Input chrome                    |

#### UI, forms, caret, cursor, appearance, interactivity

| Feature                                              | Score | Short note         |
| ---------------------------------------------------- | ----: | ------------------ |
| `appearance`                                         |   0.0 | Widget UA          |
| `cursor`                                             |   0.1 | Pointer host       |
| `caret` / `caret-*`                                  |   0.0 | Forms              |
| `accent-color`                                       |   0.1 | Form controls      |
| `pointer-events`                                     |   0.4 | Limited 3D picking |
| `user-select` / `user-modify` / `-moz-user-*`        |   0.0 | Selection          |
| `field-sizing` / `interactivity` / `interest-delay*` |   0.0 | UI experiments     |
| `will-change`                                        |   0.3 | Weak perf hint     |
| `zoom`                                               |   0.2 | Viewport zoom      |
| `reading-flow` / `reading-order`                     |   0.0 | A11y order         |

#### View transitions & misc longhands

| Feature                                                                     | Score | Short note                 |
| --------------------------------------------------------------------------- | ----: | -------------------------- |
| `view-transition-name` / `view-transition-class` / `view-transition-scope`  |   0.1 | DOM VT                     |
| `all`                                                                       |   0.4 | Reset cascade compile-time |
| Custom properties `--*`                                                     |   1.0 | Already in GSS (dec. 55)   |
| `-moz-float-edge` / `-moz-force-broken-image-icon` / `-moz-orient`          |   0.0 | Vendor                     |
| Remaining non-standard `-webkit-*` (slider, meter, search, … via selectors) |   0.0 | UI vendor                  |

### At-rules

| Feature                                                                                                                                                                                                                                                                 | Score | Short note                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | ---------------------------------------------------- |
| `@keyframes`                                                                                                                                                                                                                                                            |   1.0 | Already in GSS                                       |
| `@media`                                                                                                                                                                                                                                                                |   1.0 | Already in GSS (decision 71)                         |
| `prefers-reduced-motion` (media feature)                                                                                                                                                                                                                                |   1.0 | Already in GSS (decision 71)                         |
| `prefers-color-scheme` / `prefers-contrast` / `prefers-reduced-transparency` / `prefers-reduced-data`                                                                                                                                                                   |   1.0 | Already in GSS, through @media (decision 71)         |
| `hover` / `any-hover` / `pointer` / `any-pointer` (MF)                                                                                                                                                                                                                  |   0.6 | Input capability                                     |
| `width` / `height` / `aspect-ratio` / `orientation` / `resolution` (MF)                                                                                                                                                                                                 |   0.7 | Viewport → quality/LOD                               |
| Other media features (`color-gamut`, `dynamic-range`, `display-mode`, `forced-colors`, `scripting`, `update`, `scan`, `shape`, `grid`, device-_, overflow-_, viewport-segments, video-dynamic-range, inverted-colors, monochrome, color-index, `-webkit-*`/`-moz-*` MF) |  0.35 | Niche / vendor                                       |
| `@import`                                                                                                                                                                                                                                                               |  0.85 | Compose GSS modules                                  |
| `@supports`                                                                                                                                                                                                                                                             |   0.6 | Feature flags compile                                |
| `@container`                                                                                                                                                                                                                                                            |  0.55 | Queries on the parent size in the scene              |
| `@layer`                                                                                                                                                                                                                                                                |  0.55 | Cascade order at compile time                        |
| `@property`                                                                                                                                                                                                                                                             |  0.85 | Variable / animation types; later                    |
| `@scope`                                                                                                                                                                                                                                                                |  0.55 | Selector scope                                       |
| `@starting-style`                                                                                                                                                                                                                                                       |   0.5 | Entry transition                                     |
| `@function`                                                                                                                                                                                                                                                             |  0.55 | Mixins / custom functions                            |
| `@for` / `@each` (Sass-like, not in MDN)                                                                                                                                                                                                                                |   1.0 | Postponed: `* n` + `sibling-index()` first (dec. 52) |
| `@charset`                                                                                                                                                                                                                                                              |   0.0 | File encoding                                        |
| `@namespace`                                                                                                                                                                                                                                                            |   0.0 | XML NS                                               |
| `@font-face` / `@font-feature-values` / `@font-palette-values`                                                                                                                                                                                                          |  0.05 | Fonts                                                |
| `@counter-style` (+ descriptors)                                                                                                                                                                                                                                        |  0.05 | List markers                                         |
| `@page` (+ `size`, `page-orientation`)                                                                                                                                                                                                                                  |   0.0 | Print                                                |
| `@color-profile`                                                                                                                                                                                                                                                        |   0.4 | Advanced color spaces                                |
| `@custom-media`                                                                                                                                                                                                                                                         |   0.6 | Alias media                                          |
| `@document`                                                                                                                                                                                                                                                             |   0.1 | Deprecated                                           |
| `@position-try`                                                                                                                                                                                                                                                         |   0.2 | Anchor pos                                           |
| `@view-transition`                                                                                                                                                                                                                                                      |   0.1 | DOM VT                                               |

### Selectors

| Feature | Score | Short note |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------- | --- |
| Type / `<shape>` | 1.0 | Already in GSS |
| `.class` / `#id` / `*` | 1.0 | Already in GSS |
| Selector list `a, b` | 1.0 | Already in GSS |
| Descendant `a b` | 1.0 | Already in GSS |
| Child `>` / adjacent `+` / sibling `~` | 1.0 | Already in GSS (dec. 73) |
| Column `\|\|` | 0.0 | Tables |
| `&` nesting | 0.9 | Nesting, strong |
| Attribute selectors | 0.4 | Few attributes in GSS |
| `:hover` | 1.0 | Already in GSS (dec. 62) |
| `:active` / `:focus` / `:focus-visible` / `:focus-within` | 0.5 | Interaction host |
| `:nth-child()` / `:nth-of-type()` / `:nth-last-*` | 0.85 | Compile-time index |
| `:first-child` / `:last-child` / `:only-child` / `:first-of-type` / `:last-of-type` / `:only-of-type` / `:empty` | 0.8 | Scene structure |
| `:is()` / `:where()` / `:not()` | 0.6 | Selector utilities |
| `:has()` | 1.0 | Already in GSS (decision 69) |
| `:root` / `:scope` | 0.6 | Root / scope |
| `:lang()` / `:dir()` | 0.2 | I18n DOM |
| Link/visited/any-link/local-link/target\* | 0.1 | Navigation HTML |
| Form (`:checked`, `:disabled`, `:enabled`, `:valid`, `:invalid`, `:required`, `:optional`, `:read-*`, `:placeholder-shown`, `:autofill`, `:default`, `:indeterminate`, `:in-range`, `:out-of-range`, `:user-valid/invalid`) | 0.0 | Forms |
| Media (`:playing`, `:paused`, `:muted`, `:seeking`, `:buffering`, `:stalled`, `:volume-locked`, `:picture-in-picture`) | 0.1 | Media elements |
| Shadow (`:host`, `:host()`, `:host-context()`, `:has-slotted`, `:state()`, `::part()`, `::slotted()`) | 0.05 | Shadow DOM |
| View-transition pseudos (`:active-view-transition*`, `::view-transition*`) | 0.1 | DOM VT |
| `::before` / `::after` | 0.4 | Pseudo content → clones? |
| `::first-letter` / `::first-line` / `::selection` / `::marker` / `::placeholder` / `::backdrop` / `::file-selector-button` / `::grammar-error` / `::spelling-error` / `::highlight()` / `::search-text` / `::target-text` / `::details-content` / `::column` / `::cue` / `::checkmark` / `::picker*` / `::scroll-*` | 0.1 | Chrome / text |
| Vendor `:-moz-*` / `::-moz-*` / `::-webkit-*` | 0.0 | UI vendor |
| Keyframe selectors (`from`/`to`/`%`) | 1.0 | Already via `@keyframes` |
| Namespace separator `                                                                                                                                                                                                                                                                                               |     ` | 0.0 | XML |

### Functions

| Feature                                                                                                                                           | Score | Short note                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------ |
| `var()`                                                                                                                                           |   1.0 | Already in GSS (dec. 55)                                                                   |
| `calc()`                                                                                                                                          |   1.0 | Already in GSS (dec. 52)                                                                   |
| `min()` / `max()` / `clamp()`                                                                                                                     |   1.0 | Already in GSS (dec. 52)                                                                   |
| `abs()` / `sign()` / `mod()` / `rem()` / `round()` / `pow()` / `sqrt()` / `hypot()` / `log()` / `exp()` / `progress()`                            |   1.0 | Already in GSS (dec. 52, 78)                                                               |
| `sin()` / `cos()` / `tan()` / `asin()` / `acos()` / `atan()` / `atan2()`                                                                          |   1.0 | Already in GSS (dec. 52, 78)                                                               |
| `random()`                                                                                                                                        |  0.55 | Seed at compile time or runtime                                                            |
| `calc-size()`                                                                                                                                     |   0.2 | Intrinsic box                                                                              |
| `rgb()` / `hsl()` / `hwb()` / `lab()` / `lch()` / `oklab()` / `oklch()` / `color()`                                                               |   1.0 | Already in GSS (dec. 58, 79); `color()` takes srgb, srgb-linear, display-p3, xyz           |
| `color-mix()`                                                                                                                                     |   1.0 | Already in GSS (dec. 79)                                                                   |
| `alpha()` / `light-dark()` / `contrast-color()`                                                                                                   |   0.7 | `light-dark()` and `contrast-color()` already in (dec. 79); `alpha()` waits for transparency |
| `device-cmyk()` / `dynamic-range-limit-mix()` / `palette-mix()`                                                                                   |   0.2 | Niche print/HDR/fonts                                                                      |
| `cubic-bezier()` / `linear()` / `steps()`                                                                                                         |   1.0 | Already in GSS (dec. 68, 80)                                                               |
| `blur()` / `brightness()` / `contrast()` / `grayscale()` / `hue-rotate()` / `invert()` / `opacity()` / `saturate()` / `sepia()` / `drop-shadow()` |   0.8 | `filter` post                                                                              |
| `translate*()` / `rotate*()` / `scale*()`                                                                                                         |   0.9 | Already GSS concepts                                                                       |
| `skew()` / `skewX()` / `skewY()`                                                                                                                  |   0.4 | Skew ≠ SDF exact                                                                           |
| `matrix()` / `matrix3d()` / `perspective()`                                                                                                       |   0.5 | Generic matrix                                                                             |
| `sibling-index()`                                                                                                                                 |   1.0 | Already in GSS (dec. 52)                                                                   |
| `sibling-count()`                                                                                                                                 |   1.0 | Already in GSS (dec. 52)                                                                   |
| `path()` / `circle()` / `ellipse()` / `polygon()` / `inset()` / `rect()` / `xywh()` / `shape()` / `ray()`                                         |   0.7 | Shapes / motion path                                                                       |
| `superellipse()`                                                                                                                                  |   0.5 | Corner shape                                                                               |
| `url()`                                                                                                                                           |   0.8 | Already in `texture` (dec. 59); `@import` later                                            |
| `attr()` / `env()`                                                                                                                                |   0.4 | Host / env                                                                                 |
| `if()`                                                                                                                                            |  0.55 | Compile-time condition                                                                     |
| `layer()`                                                                                                                                         |   0.5 | With `@layer`                                                                              |
| `type()` / `param()`                                                                                                                              |   0.5 | `@function` / `@property`                                                                  |
| `anchor()` / `anchor-size()`                                                                                                                      |   0.2 | Anchor pos DOM                                                                             |
| `scroll()` / `view()`                                                                                                                             |   0.5 | Timelines                                                                                  |
| `counter()` / `counters()` / `symbols()`                                                                                                          |  0.05 | Counters                                                                                   |
| Gradients (`linear-` / `radial-` / `conic-` + repeating-\*)                                                                                       |   0.5 | Material / background                                                                      |
| `image()` / `image-set()` / `cross-fade()` / `element()` / `paint()`                                                                              |   0.2 | CSS images                                                                                 |
| `-moz-image-rect()`                                                                                                                               |   0.0 | Vendor                                                                                     |
| `fit-content()` / `minmax()` / `repeat()`                                                                                                         |   0.0 | Grid                                                                                       |
| Font variant fns (`stylistic`, `styleset`, …)                                                                                                     |   0.0 | Fonts                                                                                      |

### Concepts

| Feature                                                              | Score | Short note                                        |
| -------------------------------------------------------------------- | ----: | ------------------------------------------------- |
| Cascade & specificity                                                |   0.9 | Already in (with `!important`)                    |
| Inheritance                                                          |   0.7 | Scene/group properties                            |
| Nesting                                                              |   0.9 | Priority #7 (next)                                |
| Custom properties / variables                                        |   1.0 | Already in GSS (dec. 55)                          |
| Shorthand properties                                                 |   0.8 | Pattern GSS                                       |
| Values & units                                                       |   0.9 | Numbers, angles, colors                           |
| Functional notations                                                 |   0.9 | Math / colors                                     |
| At-rules (concept)                                                   |   0.9 | `@scene`, `@keyframes`, …                         |
| Selectors (concept)                                                  |   0.9 | Core of the language                              |
| Box model / formatting contexts / margin collapse / containing block |  0.05 | Layout CSS                                        |
| Stacking context / painting order                                    |   0.2 | ≠ SDF order                                       |
| Flex / Grid / Multi-column / Float layout                            |   0.0 | Out of scope                                      |
| Scroll containers / overflow                                         |   0.1 | Host UI                                           |
| Shadow DOM / scoping encapsulation                                   |   0.1 | Web components                                    |
| View Transitions                                                     |   0.1 | Document transitions                              |
| Media / container queries (concept)                                  |   0.8 | `@media` already in (dec. 71); `@container` later |
| Motion path (concept)                                                |   0.9 | Prio #12                                          |
| Filter effects (concept)                                             |  0.85 | Shader post-process                               |
| Masking / clipping (concept)                                         |  0.55 | CSG-adjacent                                      |
| Compositing & blending                                               |   0.5 | Close to GSS `operation`/`blend`                  |
| Scroll-driven animations                                             |   0.5 | Can be reframed                                   |
| Generated content                                                    |   0.3 | Limited pseudos                                   |
| Lists & counters                                                     |  0.05 | Out of scope                                      |
| Fonts & text layout                                                  |  0.05 | Out of scope                                      |
| Paged media / fragmentation                                          |   0.0 | Print                                             |
| CSSOM / style sheets API                                             |   0.3 | Host runtime, not the core                        |
| Houdini (`@property`, paint worklet)                                 |   0.5 | `@property` useful; paint not                     |
| Anchor positioning                                                   |   0.2 | DOM layout                                        |
| Environment variables                                                |   0.4 | `env()` host                                      |
| Mixins / custom functions                                            |  0.55 | DX compile                                        |
