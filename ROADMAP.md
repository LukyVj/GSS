# ROADMAP — GSS

A living list of the next features. Tick an item or move it to **Done recently** once it ships.

**Rule:** every new feature or entry goes into the **registry** (in the right place) **and** into the **docs** (syntax, example, etc.).

## Already in GSS (Oct. 4, 2026)

What the language and the tools can do today. Each feature is detailed in the registry (so in the docs), and the "why" is in `DECISIONS.md` (column _Dec._).

### Language

| Feature              | Syntax                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Dec.                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Scene structure      | `@scene { cube.corner * 4; torus#hero; }`, `;` optional between elements                                                                                                                                                                                                                                                                                                                                                                                              | 2, 11, 46                                  |
| Multiplication       | `cube * 12`; numbered ids: `cube#petal * 12` → `#petal-1` … `#petal-12`                                                                                                                                                                                                                                                                                                                                                                                               | 3                                          |
| Groups               | `group#g { … }`: transforms and animation apply to the children, positions are relative                                                                                                                                                                                                                                                                                                                                                                               | 45, 48                                     |
| Scene styling        | `scene { floor; background (a color, a gradient or layers with `background-blend-mode`, animatable, dec. 103, 112); light; ambient; fog (dec. 108); camera-* }`                                                                                                                                                                                                                                                                                                       | 11, 15, 16, 108                            |
| Selectors            | `<shape>`, `.class`, `#id`, `*`, lists `a, b`, descendant `a b`, child `a > b`, siblings `a + b` / `a ~ b`, faces `::face(front)`, `::top`, `::bottom`, `:hover` (on objects and their groups), `:active` (pressed), `:has()` (`#g:has(sphere:hover) cube`), `:nth-child(An+B [of S])` and its family, `:first-child`…, `:not()`, nesting with `&`                                                                                                                    | 4, 37, 47, 59, 62, 69, 73, 92, 93, 95, 106 |
| Cascade              | specificity (id 10,000, class 100, tag 1), last one wins, `!important` in 2 passes                                                                                                                                                                                                                                                                                                                                                                                    | 4, 38                                      |
| Animation            | `@keyframes` (`from`, `to`, `%`), `animation: name duration [easing] [delay] [count \| infinite] [direction] [fill-mode]` and the six longhands, computed in the shader; driven by the scroll with `animation-timeline: scroll()` / `view()`                                                                                                                                                                                                                          | 21, 22, 23, 24, 70, 96                     |
| Easings              | `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end`, `cubic-bezier()`, `linear()`, `steps()`, in `@keyframes` and `transition`                                                                                                                                                                                                                                                                                                           | 68, 80                                     |
| Media queries        | `@media (…) { … }`: any query the browser knows (width, orientation, `prefers-color-scheme`, `prefers-reduced-motion`…), up to 4 per scene, switched live; range syntax (`width < 600px`); `if(media(…))` and `light-dark()` add their own (dec. 79, 81)                                                                                                                                                                                                              | 71                                         |
| Math                 | `calc()`, `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()`, trigonometry and its inverses (`asin()` … `atan2()`), `sign()`, `round()`, `mod()`, `rem()`, `hypot()`, `log()`, `exp()`, `progress()`, `random()`, `pi`, `e`                                                                                                                                                                                                                                      | 52, 78, 81, 104                            |
| Variables            | `--size: 2`, `var(--size, 1)`; inherited scene → group → object, a variable can use another, animatable in `@keyframes`; `@property` registers one that the page sets with `setProperty()`, without compiling again; `@property-panel { display: open \| folded \| none; }` gives it a control over the render of the playground and of Try it                                                                                                                        | 55, 105, 127, 128                          |
| Colors               | `#ff5a36`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`, `color-mix()`, `light-dark()`, `contrast-color()`, `currentColor` (dec. 94), the 148 CSS names (`tomato`) where a color is expected; a gradient (`linear-`, `radial-`, `conic-`, dec. 82, 98) in `color` or a material, animated in `color` (dec. 102); `noise()` placed by a 3D noise (dec. 111); `displace()`, an image moved by a map (dec. 114); math and `var()` inside | 58, 79                                     |
| CSS-style loops      | `sibling-index()`, `sibling-count()`: each copy of a `* n` gets its own value                                                                                                                                                                                                                                                                                                                                                                                         | 52                                         |
| Units                | angles `deg` `rad` `turn` (always with a unit), durations `s` `ms`, `%`                                                                                                                                                                                                                                                                                                                                                                                               | 9, 17, 20                                  |
| Modern CSS functions | commas or spaces: `metal(#d4af37, 0.2)`, `polygon(0 1, 1 0, -1 0)`                                                                                                                                                                                                                                                                                                                                                                                                    | 28                                         |

### Shapes (11)

| Shape                 | Own properties                                                                                                                     | Dec.   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `cube`                | `size` (1 or 3 values), `corner-radius`                                                                                            | 14, 36 |
| `sphere`              | `radius`                                                                                                                           | 14     |
| `torus`               | `radius`, `thickness`                                                                                                              | 14     |
| `cylinder`, `capsule` | `radius`, `height`                                                                                                                 | 36     |
| `cone`                | `radius` (bottom, top), `height`                                                                                                   | 36     |
| `plane`               | `size` (1 or 2 values)                                                                                                             | 40     |
| `path`                | a tube along an SVG path: `d: path("M… C… A…")`, `stroke-width`, `view-box`                                                        | 35, 49 |
| `prism`               | a filled contour given a depth: `d: polygon(…)` or `d: path(…)` (even-odd holes), `depth`, `view-box`                              | 41, 50 |
| `lathe`               | a filled contour turned around the y axis: `d: polygon(…)` or `d: path(…)`, x = 0 is the axis, `view-box`                          | 130    |
| `group`               | draws nothing, holds the others                                                                                                    | 45     |
| `light`               | a point of light, never drawn: `color`, `intensity`, placed like an object (translate, groups, animations, motion path); 8 at most | 110    |

All centered on their origin, dimensions as full sizes (dec. 36).

### Object properties

| Family       | Properties                                                                                                                                                                                                                                          | Dec.                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Transforms   | `translate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale` (uniform), `transform-origin`; x to the right, like CSS                                                                                                                                    | 13, 99, 107                     |
| Motion path  | `offset-path: path()` / `ray()`, `offset-distance` (animatable), `offset-rotate`                                                                                                                                                                    | 97                              |
| Look         | `color`, `material`                                                                                                                                                                                                                                 | 26                              |
| Textures     | `texture: url("…")` or `element(#id)` (a live HTML element, dec. 101), `image-rendering: pixelated`, `texture-size`                                                                                                                                 | 59                              |
| Opacity      | `opacity: <number> \| <percentage>`, a transparent `color` or gradient, `filter: opacity()`: the surfaces behind showing through, on groups multiplied into each object                                                                             | 116, 117                        |
| Masks        | `mask-image: <gradient> \| noise()` cuts sharp holes where the image is transparent, `mask-mode: alpha \| luminance`                                                                                                                                | 113                             |
| Combinations | `operation: union \| subtract \| intersect`, `blend` (smooth union)                                                                                                                                                                                 | 18, 19                          |
| Animation    | `animation`; animatable: `translate`, `rotate-*`, `scale`, `transform-origin`, `color` (a gradient too), `mask-image`, `offset-distance`, the `intensity` of a light (also what `:hover` can change); on the scene, `background`, `fog` and `light` | 24, 62, 102, 103, 107, 108, 110 |
| Transition   | `transition: 0.3s ease-out`, one per object; easings: keywords, `cubic-bezier()`, `linear()`                                                                                                                                                        | 68                              |

### Materials

| Material | Syntax                                                                                              | Dec.       |
| -------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Matte    | `matte([color])` (default)                                                                          | 27         |
| Metal    | `metal([color,] [roughness])`; shortcuts `gold`, `chrome`                                           | 27, 29     |
| Jelly    | `jelly([color,] [density])`; shortcut `jelly`                                                       | 27         |
| Glass    | `glass([tint,] [index] [, frosted \| wavy \| hammered \| blurred frost])`; shortcuts `glass`, `ice` | 27, 31, 32 |

### Scene

| Property                                                          | Role                                                                                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `floor`                                                           | floor color, a gradient, a `noise()` or a `displace()` (dec. 122), or `none`                                                                         |
| `background`                                                      | background color                                                                                                                                     |
| `light`, `ambient`                                                | the sun (`<azimuth> <elevation> [<color>] [<intensity>]`, or `none`), the ambient light (`<number> [<color>]`); lights of `@scene` add up (dec. 110) |
| `fog`                                                             | `none`, or `[<color>] <start> <end>` from the camera (dec. 108)                                                                                      |
| `shadows`                                                         | `none` (default), `hard` or `soft`: from the sun and every light (dec. 115)                                                                          |
| `dpr`                                                             | pixel density of the render: `auto` (the screen, up to 2), `max`, a number (dec. 67)                                                                 |
| `view`                                                            | `shaded` (default) or `distance`: the isolines of the distance to the objects over the scene; chips switch it in the playground and Try it (dec. 131) |
| `camera-target`, `camera-distance`, `camera-angle`, `camera-spin` | camera (mouse orbit; automatic turn as a duration, `none` by default, dec. 54)                                                                       |

### Rendering

| Feature                                                                                                                                                                           | Dec.         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Everything compiled into **a single fragment shader**, in GLSL (WebGL2) and WGSL (WebGPU, with a WebGL2 fallback), SDF raymarching, no Three.js                                   | 1, 5, 30, 90 |
| One reflection (1 bounce), glass refraction (in + out), procedural frost                                                                                                          | 29, 31       |
| Everything is computed, except the images of `texture`: projected on each face (triplanar), at most 16 per scene                                                                  | 1, 59        |
| Minimal shader: only the GLSL the scene uses goes in (an empty scene: 104 lines)                                                                                                  | 53           |
| `:hover`: a 1-pixel picking pass under the mouse, `uHover[]` mixed into every hovered property                                                                                    | 62           |
| `:hover` read without waiting for the GPU: a pixel buffer and a fence (`runtime/picker.ts`)                                                                                       | 65           |
| `map()` skips a `path` or a `prism` whose bounding sphere is further than the nearest object: same image, macropad −37 %, logo −50 % on the GPU at dpr 2                          | 66           |
| Animations and `:hover` computed once per pixel, in `animate()`                                                                                                                   | 75           |
| A sphere around the whole scene: a ray that passes by it only meets the floor                                                                                                     | 76           |
| A tree of spheres around the objects, built by where they are: one test per group of 3 objects or more                                                                            | 77, 132      |
| Render on demand: a frame is drawn only when what it shows can have changed; a still scene leaves the GPU idle                                                                    | 134          |
| Fog: mixed into the color after the lighting, from the camera; the bounding spheres follow `transform-origin`                                                                     | 107, 108     |
| Lights: the sun, the ambient light and up to 8 point lights of `@scene`, in `diffuse()` and the highlights of metal, jelly and glass; shadows with `scene { shadows }` (dec. 115) | 110, 115     |

### Tools

| Tool                       | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Dec.                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Home page                  | `/` (`index.html`), live demo, numbers read from the registry                                                                                                                                                                                                                                                                                                                                                                                             | 51                              |
| Playground                 | `playground.html`: CodeMirror, code in the URL (sharing), examples (Start here, New features, Studies, the reference), HTML, GLSL and WGSL tabs, backend selection (auto, WebGPU, WebGL2), a resizable editor, the dpr menu, the panel of variables of `@property-panel`, the chips of the view                                                                                                                                                                                  | 34, 90, 101, 120, 123, 127, 128, 131 |
| Status bar                 | `ok · 0 objects · glsl 104 lines · compiled in 4 ms · 60 fps`                                                                                                                                                                                                                                                                                                                                                                                             | 42                              |
| Located errors             | every error of a compile at once (the text first, then the values), each underlined and written under its line (`15:3 …`); `3 errors` in the status bar; line and column in Vite's terminal                                                                                                                                                                                                                                                               | 43, 86                          |
| Generated docs             | `docs.html`, one page per entry, from the registry, live "Try it" everywhere; "Set variables from JavaScript", the JS API with a live slider; a lead, a table of the values, titled examples                                                                                                                                                                                                                                                              | 12, 39, 44, 109, 121, 135       |
| Site                       | [gss-lang.dev](https://gss-lang.dev) on Vercel, clean URLs (`/playground`, `/docs`, `/brand`), Open Graph and X cards                                                                                                                                                                                                                                                                                                                                     | 56                              |
| Brand page                 | `/brand` (`brand.html`): marks, wordmark, lockup, icons, doc icons, social cards                                                                                                                                                                                                                                                                                                                                                                          | 57, 135                         |
| Shadertoy export           | `→ shadertoy` button in the playground, images in `iChannel0`…`3` (at most 4)                                                                                                                                                                                                                                                                                                                                                                             | 60                              |
| Analytics                  | DocSearch Insights (Algolia) + Umami, events through `track()`                                                                                                                                                                                                                                                                                                                                                                                            | 61                              |
| Docs search                | DocSearch v5 on every page; the Algolia Crawler reads `/docs` with `src/docs/crawler.ts` (one record per page and per part, 420, under the 750 a page), pasted with `npm run docsearch:extractor`; before a word is typed: Start here, New in 0.0.4 (`since` in the registry, a version once the package has it, dec. 129), Popular searches (Query Suggestions); three columns: the contents, the list, "How GSS works" in four drawings (`concepts.ts`) | 124–126                         |
| Autocompletion             | property names while typing, only those the rule can take (scene, shape, group, `:hover`, face, `@keyframes`, a nested rule), with their syntax and description                                                                                                                                                                                                                                                                                           | 89, 106                         |
| Formatter                  | `formatGss`, `Shift+Alt+F` in the playground                                                                                                                                                                                                                                                                                                                                                                                                              | 33                              |
| VS Code / Cursor extension | highlighting (nested rules, `&` and `@media` since decision 106, `@property` and `@property-panel` since decision 129), formatter, icon for `.gss` files; 0.4.0, prepared with 0.0.5                                                                                                                                                                                                                                                                      | 33, 106, 129                    |
| Design                     | `DESIGN.md` "Distance field", tokens in `src/styles/tokens.css`, what every page shares in `src/styles/site.css` (`@layer site`: a page's own `<style>` always wins)                                                                                                                                                                                                                                                                                      | –                               |
| npm package                | [`gss-lang`](https://www.npmjs.com/package/gss-lang) 0.0.5, prepared Oct. 4 (0.0.4: tag `v0.0.4`; 0.0.3: `v0.0.3`; 0.0.2: `v0.0.2`, 0.0.1: `v0.0.1`), Apache-2.0: `gss-lang` (compiler + `mount`), `gss-lang/runtime`, `gss-lang/vite`, `gss-lang/embed` (pinned CDN module)                                                                                                                                                                              | 63, 85                          |
| Scenes                     | every demo `.gss` in `src/scenes/` (playground examples, showcase, bench), all compiled by `gpu.test.ts`                                                                                                                                                                                                                                                                                                                                                  | 63                              |
| Tests                      | Vitest (CPU) + GPU compilation of every registry example (Chromium)                                                                                                                                                                                                                                                                                                                                                                                       | 12, 25                          |
| Profiler                   | a panel over the playground scene, public, closed by default and lazy (nothing measured before it opens), `perf` button or Alt+P (remembered), WebGL2 and WebGPU (timestamp queries when available): fps, frame, GPU and CPU time, real pixels, shader build time; over budget in signal                                                                                                                                                                  | 64, 87, 91                      |
| Bench                      | `npm run bench:compare -- main --dpr 2`: another commit against the working tree, 3 alternating rounds, images compared pixel by pixel, report in `bench-results/compare.md`                                                                                                                                                                                                                                                                              | 64                              |

## Release 0.0.5 (prepared Oct. 4, to publish)

- [x] Package and lockfile version set to 0.0.5; README, installation snippets and changelog follow.
- [x] What was unreleased goes into 0.0.5: decisions 118 to 135 (notes in the docs, the studies of the showcase, the dpr menu, the docs rewrite, the floor images, the resizable playground, the docs search, the panel of variables and `@property-panel`, the New features examples, the `lathe` shape, `view: distance` and its chips, the tree of spheres, render on demand, the icons of the docs sidebar).
- [x] "New in 0.0.5" in the docs search: `view`, `@property-panel` and `lathe`, which carry `since: "0.0.5"` (decision 129).
- [x] VS Code extension 0.4.0: the `.vsix` rebuilt with the grammar of decisions 106 and 129 (nested rules, `&`, `@media`, `@property`, `@property-panel`).
- [ ] Published on npm, tag `v0.0.5`, site deployed (Lucas).

## VS Code extension on the Marketplace (Lucas, Oct. 4: for Oct. 5)

- [ ] Publish the extension (0.4.0, publisher `lukyvj`) on the VS Code Marketplace; Lucas signs in and holds the token. Its `package.json` has no `repository` yet, and `npm run package` skips the license: both to settle before publishing.
- [ ] Say in the docs that GSS has syntax highlighting (and formatting) in VS Code, with the link to the Marketplace: the docs do not mention the extension today.

## Release 0.0.4 ✅

- [x] Package and lockfile version set to 0.0.4; README, installation snippets and changelog follow.
- [x] What was unreleased goes into 0.0.4: decisions 101 to 117 (`element()`, animated gradients and the scene's animation, `@property` and `setProperty()`, nesting, `transform-origin`, fog, several and colored lights, `noise()`, layers of background, `mask-image`, `displace()`, shadows, `opacity` and transparent colors), and the clamped computed values (decision 104).
- [x] Published on npm (Oct. 3), tag `v0.0.4`, site deployed (v0.0.4 in the footer).
- [ ] For `element()` on gss-lang.dev, an origin trial token for HTML-in-Canvas (the trial ends Oct. 20): none on the site yet.

## Release 0.0.3 ✅

- [x] Package and lockfile version set to 0.0.3; README, installation snippets and changelog follow.
- [x] Everything since 0.0.2: WebGPU (decisions 90, 91), every error at once (86), the public profiler (87), autocompletion (89), the Essentials (92–96).
- [x] What was unreleased goes into 0.0.3 too: motion path (decision 97), `conic-gradient()` (98), the screen no longer mirrored (99), the object filter order fix (100). The announcement film shows them as 0.0.3.
- [x] Published on npm (Oct. 2), tag `v0.0.3`, site deployed; the versioned CDN URL answers.

## Release 0.0.2 ✅

- [x] Package and lockfile version set to 0.0.2; version displayed in site footers.
- [x] Installation docs: Embedding a scene, npm, included Vite plugin, and versioned CDN module shipped in the package (decision 85).
- [x] Documentation grouped by subject with alphabetical sorting and explicit order overrides (decision 85).
- [x] Changelog and README updated for decisions 73–85 and the new showcase scenes.
- [x] Published to npm (Oct. 1, 23:54), tag `v0.0.2`, site deployed with the versioned CDN instructions (`gss-lang@0.0.2` on gss-lang.dev).

## Priorities

**Next, in Lucas's order** (Oct. 2, after 0.0.3; replaces the list of Oct. 1):

**Next up** (Lucas, Oct. 3: "the order that makes the most sense"): the rest of item 7, in this order: ~~layers of `background` with `background-blend-mode`~~ ✅ decision 112; ~~`mask-image`~~ ✅ decision 113; ~~a displacement like `feDisplacementMap`~~ ✅ decision 114 (`displace()`). Lucas's list of Oct. 2 is done; then, his choice (Oct. 3): ~~soft shadows~~ ✅ decision 115; the transparency of the objects: ~~`opacity`~~ ✅ decision 116, ~~the transparent colors and `opacity()` on objects~~ ✅ decision 117; then, his choice (Oct. 4): ~~the panel of sliders for the `@property` variables~~ ✅ decision 127, asked for by the scene with `@property-panel` (decision 128). Ask him for the next one. (Decision 101 to come back to after the origin trial ends on Oct. 20 if needed.)

1. ~~**Animated gradients**~~ ✅ decisions 102, 103: a gradient changes into another of the same kind in `@keyframes` and on `:hover`, through a variable too; the scene plays an animation, so its `background` moves (a flat, moving image)
2. **`setProperty()` from JS**: first step ✅ decision 105 (`@property`, `setProperty()` / `getPropertyValue()` / `removeProperty()`, in `translate`, `rotate-*`, `scale`, `color`, `offset-distance`, `background`). Second step ✅: inside `calc()` and the math functions, and the color functions (`hsl(var(--hue) …)`, `color-mix()`…), computed on the GPU. Third step ✅, Lucas's choice "everywhere": the sizes of shapes (without their bounding spheres), the numbers of a gradient, materials, `light`, `ambient`, `floor`, `camera-target`, `blend`, `offset-rotate`, `texture-size`, filters (with a `"<length>"` syntax in px, the passes included). Not read at run time: the copies of `* n`, `d`, `view-box`, the timings, the camera the mouse moves, `dpr`. The playground panel of sliders ✅ decision 127
3. ~~**Nesting** with `&`~~ ✅ decision 106: rules inside rules, `&`, a descendant without `&`, `@media` inside a rule; unfolded by the parser
4. ~~**`transform-origin`**~~ ✅ decision 107: keywords and percentages on the box of the object, numbers from its center like `translate`; animatable, on groups with numbers
5. ~~**Fog**~~ ✅ decision 108: `fog: [<color>] <start> <end>` on the scene, into the background behind each object or a color that covers the background too; animatable, readable from `@property`
6. ~~`:nth-child()`~~ ✅ already done (decision 92)
7. ~~**A noise image function**~~ ✅ decision 111: `noise()` wherever a gradient goes, colors placed by a 3D noise like `feTurbulence` (scale, octaves, `turbulence`, `seed`, `at`), in the object's own space, animated like a gradient. Since then, the rest of the item: layers of `background` with `background-blend-mode` (decision 112), `mask-image` (decision 113) and `displace()` (decision 114)
8. ~~**Several lights, and colored lights**~~ ✅ decision 110: `light` elements in `@scene` (point lights, `color`, `intensity`, placed like objects, animated, `:hover` through their group), the sun with a color, an intensity and `none`, a colored `ambient`
9. ~~**`texture: element(#id)`**~~ ✅ decision 101 (Oct. 3: the texture, the WebGL2 runtime, `<gss-scene>`, the docs examples, the HTML tab of the playground): a live image of an HTML element on an object, like CSS `element()`, rendered by HTML-in-Canvas (`layoutsubtree`, `texElementImage2D` / `copyElementImageToTexture`, the `paint` event); the element is a child of `<gss-scene>` or of the `<canvas>`; without the API, the object shows its `color`. Comes with an **HTML tab in the playground** (share links carry it, registry examples can carry HTML). Waits until the future of the API after its origin trial is clearer

Done from the list of Oct. 1: ~~`filter`~~ ✅ (decisions 83, 84), ~~motion path~~ ✅ (decision 97), ~~`conic-gradient()`~~ ✅ (decision 98), the mirrored screen fixed (decision 99).

**Essentials** (added by Lucas, Oct. 2), **before the motion path**, in the order suggested by Claude: structure first (compile time, no runtime cost), then interaction, then scroll.

- [x] **`:nth-child(an+b [of S])`** ✅ decision 92, `:nth-last-child()`, `:nth-of-type()`, `:nth-last-of-type()`, with `odd` / `even`: resolved at compile time on the tree of `@scene`; the copies of a `* n` are siblings, so `:nth-child(odd)` and `sibling-index()` count the same way (decision 52; confirmed by Lucas, Oct. 2: in `@scene { cube * 4; sphere; }`, `cube:nth-child(odd)` is cubes 1 and 3, the sphere is child 5)
- [x] **`:first-child`** ✅ decision 92, `:last-child`, `:only-child`, `:first-of-type`, `:last-of-type`, `:only-of-type` (shortcuts of the above; "type" = the shape: `cube`, `sphere`, `group`…)
- [x] **`:not(<selector list>)`** ✅ decision 93: compile time, specificity of its most specific argument like CSS; first version without `:hover` / `:active` inside (an inverted hover trigger), a clear error until then
- [x] **`currentColor`** ✅ decision 94 (also `currentcolor`): the object's own `color` wherever a color is expected, resolved after the cascade like `var()`: `color-mix(in oklab, currentColor 60%, white)`, the stops of a gradient, a material's color, `light-dark()`; on `:hover`, the hovered color. `color: currentColor` would refer to itself (GSS does not inherit `color` from a group): an error, like a `var()` that loops
- [x] **`:active`** ✅ decision 95: the object under the pressed mouse button or finger, the same picking pass as `:hover` (decision 62), with its own slots after the hover slots in `uHover[]`, `transition` included; on a group like `:hover` (`#g:active cube`), inside `:has()`; like CSS, the object stays pressed until the button goes up, even if the pointer leaves it
- [x] **`scroll()`** ✅ decision 96: `animation-timeline: scroll([root | nearest] || <axis>)` and `view(<axis>)`, like CSS; the progress replaces the time (`uniform vec4 uTimeline`, up to 4 timelines), read from the layout every frame; a slider stands in for the scroll in the playground and the docs. Later: `animation-range`, named timelines, `view()` insets

1. [x] Loops: **option B chosen** (decision 52): `* n` + `calc(sibling-index())`, as in CSS. `@for` / `@each` later, only to change the shape at each step or to walk through a list
2. [x] `var()` ✅ decision 55, inherited and animatable (+ `calc()` ✅ decision 52, with `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()`, `sin()`, `cos()`, `tan()`; every other CSS math function ✅ decision 78)
3. [x] Functional colors: `rgb()`, `hsl()` and the named colors ✅ decision 58; `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`, `color-mix()`, `light-dark()`, `contrast-color()` ✅ decision 79
4. [x] Textures: `texture: url("…")`, one image per face, `::face()` (decision 59)
5. [x] Animation controls ✅ decision 70: delay, iteration count, direction, fill mode, and the six longhands
6. [x] `@media` ✅ decision 71: any media query the browser knows (width, orientation, `prefers-color-scheme`, `prefers-reduced-motion`…), up to 4 per scene
7. [x] Selectors / nesting: combinators `>` `+` `~` ✅ decision 73 (including relative selectors in `:has()`); nested style rules with `&` ✅ decision 106
8. [x] `:hover` ✅ decision 62 (picking pass → `uHover[]`), `transition` ✅ decision 68 (one per object; per-property lists later), `:has()` ✅ decision 69 (`#g:has(sphere:hover) cube`, any selector inside)
9. [x] `transform-origin` ✅ decision 107
10. [x] Fog ✅ decision 108
11. [x] `sibling-index()` + `sibling-count()` (decision 52)
12. [x] Motion path ✅ decision 97: `offset-path: path()` / `ray()`, `offset-distance`, `offset-rotate`, in the xy plane like the `path` shape. Later: `offset-position`, `offset-anchor`, the `offset` shorthand, `circle()` as a path

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
- [x] GitHub repository renamed to `GSS`; the local folder remains `csl`
- [x] npm publishing: `gss-lang` 0.0.1

### Playground

- [x] **A panel of sliders for the `@property` variables** ✅ decision 127 (decision 105), kept for later by Lucas (Oct. 2): one control per registered variable, by its syntax (a slider for a number, an angle, a percentage or a length; a color picker for a color), calling `setProperty()` live, without compiling again. The best demo of `setProperty()`
- [x] `view: distance` / `view: shaded` ✅ decision 131: a property of the scene, the isolines of the distance to the objects on the plane through the camera target; chips over the render switch it without touching the code

### Performance

Measured with the bench at dpr 2 (M4 Pro, Oct. 1), GPU median, after decisions 75–77: orrery 7.5 ms (was 20.3), todal 3.9 ms (24.3), macropad 4.0 ms (17.4), test scene 5.2 ms, spiral 3.7 ms, logo 2.8 ms: every scene under the 8.3 ms of 120 Hz. Every item below must keep the image (the bench compares it pixel by pixel; stray pixels from GPU rounding are accepted, decision 74).

- [x] **Animations once per pixel**, in `animate()` (decision 75): L'Orrery 20.3 → 9.2 ms
- [x] **A sphere around the whole scene** (decision 76): a ray that passes by it only meets the floor; todal −18 %, spiral −15 %
- [x] **Bounds on whole groups**, one test per group of 3 objects or more (decision 77): macropad 16.6 → 4.0 ms, todal 19.4 → 3.9 ms
- [x] **A tree of spheres**, built by where the objects are, for every shape and without groups (decision 132): camera-cutaway 75 → under 20 ms, grass 26 → 5 ms, ripple and noise-atmosphere −60 %
- Set aside: a mask of the objects each ray can meet (decision 133): faster on camera-cutaway and grass, slower on glass and shadows, and it moves edge pixels; kept on the branch `perf/ray-mask-experiment`
- [x] **Render on demand** (decision 134): a frame is drawn only when what it shows can have changed; a still scene, or one at rest under the mouse, leaves the GPU idle
- Set aside: animations computed on the CPU and sent as uniforms (decision 75: after `animate()`, it would only save one evaluation per pixel, and the image would change)
- [x] `scene { dpr: auto | max | <number>; }`: the pixel density of the render, chosen by the author (decision 67). With `@media` (decision 71): `@media (max-width: 600px) { scene { dpr: 1; } }`

### Shapes / rendering

- [x] Solid fill of a path: `prism` with `d: path(…)`, holes included (decision 50)
- [x] `lathe` ✅ decision 130: a contour turned around the y axis, its axis at x = 0 of the contour. Still to come: a `stroke-width` for thin shells
- [ ] Lost ray: when `march` runs out of its 100 steps without hitting anything or passing `MAX_DIST`, `main()` treats it as a hit (fixed for rays that pass by the sphere of the scene, decision 76; still there in scenes without one)
- [x] Fade the floor into the background: the floor stops sharply at `MAX_DIST` ✅ a fog that ends before it hides the edge (decision 108)
- [x] Soft shadows ✅ decision 115: `scene { shadows: none | hard | soft }`, off by default, from the sun and every light; still to come: a setting per light, a softness, shadows in reflections
- [ ] Optional antialiasing (4× the cost)
- [ ] Measure the compile time of large scenes; if needed, loop in `calcNormal` so `map()` is copied only once

### Textures (after decision 59)

- [ ] A soft blend between faces (triplanar weights), for stone or bark on round shapes
- [ ] `texture-mapping: sphere`: the image wraps a sphere like a map around a globe (planets)
- [ ] Images in the playground: drag and drop, and in share links (data URLs?)
- [ ] Unmirror the −x, −z and bottom faces
- [ ] Textures in reflections and glass (`trace()` → `textureColor()`)
- [ ] `image-rendering` per face; `url(dirt.png)` without quotes; an atlas
- [x] `texture: element(#id)`: an HTML element as a live texture ✅ decision 101 (WebGL2; WebGPU when Chromium copies an element to it)

### Rendering passes / runtime API

- [x] **Post-processing as a `filter` list on the scene** ✅ decision 83: the pixel filters at the end of the scene's shader, `blur()` and `bloom()` as passes (`runtime/post.ts`). Still to do: `drop-shadow()` (`opacity()` ✅ decision 117, on objects and groups), `backdrop-filter`, a fog drawn from the depth, the passes in the Shadertoy export (Buffers A, B…)
- [x] **Custom properties set from JS without recompiling** ✅ decision 105: `scene.setProperty('--speed', 8)` on what `mount()` / `<gss-scene>` return, like `element.style.setProperty`. A variable declared as drivable (close to `@property`) becomes a uniform; the others stay resolved at compile time. Lets a page drive a scene from the scroll, a slider or data

### Backend

- [x] WGSL / WebGPU ✅ decisions 90, 91: WGSL generated from the same scene code, native WebGPU runtime, `mountAsync()` / `<gss-scene backend>` with a WebGL2 fallback

### Quality / DX

- [x] Report several errors per compile ✅ decision 86
- [x] Document `floor: none` in the registry
- [x] Update `DECISIONS.md` (groups: decisions 45 to 48)
- [x] Split `shader/codegen.ts` by concern into `shader/codegen/`, and move `readAngle` / `readNumber` to `values/` ✅ decision 88
- [ ] Autocompletion: values (`gold`, `ease-out`…), shapes in `@scene`, and the same suggestions in the VS Code extension
- [ ] Align the TextMate highlighting of the extension with `classifyGss` (web)
- [ ] `gpu.test.ts` compiles the scenes of the inspiration grid (`INSPIRATION`), not only the use cases: `starorbit` broke WebGL2 without a test failing (decision 100)

## Out of scope

- GLTF, classic meshes: deliberately out of scope for now
- Non-uniform scale (outside exact SDFs today, see Under discussion)

## Under discussion

- Non-uniform scale: stay with exact SDFs, or accept an approximation?
- When to rename the `csl` folder and repo → `gss` (the npm package already ships as `gss-lang`).
- Gamma correction: more natural light, but it changes the look of every existing scene.
- Shadows on by default or not (cost: one more ray march per light and per pixel): off by default since decision 115, opt-in with `scene { shadows: soft; }`.
- Author-written shaders: `@shader hologram { … }` with a GLSL body and its own parameters, used as `shader: hologram; --intensity: 1.5;` (an escape hatch, like Houdini's `paint()`). Powerful, but how to report errors in the GLSL, keep the Shadertoy export, and stay a language an LLM writes without mistakes?
- Composing surface effects (a "textual shader graph"): to be split before deciding: deforming the shape with noise (a `displace` property, it changes the SDF and can slow the ray march), a `toon` material next to the others, and lighting effects (rim light, fresnel).

## Done recently

- Icons for the docs sidebar: one per group, before its title, 16 px in `currentColor` (signal on the group being read); the brand page shows them and offers each as an SVG file, from the same source (decision 135)
- Render on demand: both backends draw a frame only when the size, the time (for a scene that moves), the camera, `:hover`, the timelines, the variables or the images changed; the picking pass still follows the mouse over a resting frame; the profiler draws every frame while its panel is open (decision 134). A mask of the objects each ray can meet, tried and set aside (decision 133)
- A tree of spheres in `map()`, built by where the objects are (the surface-area heuristic), for every shape and without groups: camera-cutaway 75 → under 20 ms, grass 26 → 5 ms at dpr 2, the same image (decision 132)
- `view: shaded | distance` on the scene: the isolines of the distance field over the scene, one every 0.25, fainter as they go away, the floor left out; the chips `view: shaded` and `view: distance` over the render of the playground and of Try it switch it without touching the code; a page of the reference (decision 131)
- `lathe`, a new shape: a `polygon()` or `path()` contour turned around the y axis (a vase, a bowl, a ring), where a `prism` pushes it into a flat plate; its curves cut 50 times finer than a prism's; a page whose first example shows both (decision 130)
- `@property-panel { display: open | folded | none; }`: the scene asks for the panel of variables, a page of the reference with its examples; no panel without it (decision 128); `since: "0.0.5"`, shown under "New in" once the package is 0.0.5, and the VS Code grammar colors it with `@property` (decision 129)
- A "New features" group in the playground examples: Astral Greenhouse, Property Control Room, Noise Atmosphere, Mask & Displacement, HTML Card (scenes started in other worktrees, fixed to compile)
- A panel of variables over the render of the playground and of Try it: a slider and its number, or a color picker, per `@property` variable, set live without compiling again; the range comes from the start value and widens for a typed number (decision 127)
- A resizable playground: a separator between the editor and the scene, by mouse, finger or keyboard; the editor folds into a rail; the size is kept (decision 123)
- An image on the floor: a gradient, a `noise()` or a `displace()`, a gradient over a square of 40 under the scene (decision 122)
- The docs, page by page: a short lead, a table of the values, a paragraph, titled examples with a sentence each, code shown as code; "light (sun)" and "light (point)"; Colors and Selectors split into smaller groups (decision 121)
- A dpr menu over the renders of the playground and the docs: `auto` follows the frame rate, a number fixes it (decision 120)
- Seven studies open the showcase, one at a time in a viewer, a slider for those driven by `scroll()`; their own group in the playground (decision 119)
- Notes in the docs: a callout under the description (`note` in the registry), first on `element()` and `texture`, for the flag and the origin trial (decision 118)
- Transparent colors on objects (plain, gradients with transparent stops) and `filter: opacity()` on objects and groups, multiplied with `opacity` (decision 117)
- `opacity` on objects and groups, like CSS: the surfaces along the ray drawn from the front, each over what is behind it, a transparent object being a skin; light through it like stained glass with shadows (decision 116)
- Shadows: `scene { shadows: none | hard | soft }`, from the sun and every light of `@scene`, a soft penumbra or sharp, through the holes of `mask-image`, the reflections without them (decision 115)
- `displace(<image>, <map>, <amount>)`, an image moved by a map like SVG `feDisplacementMap`, wherever a gradient goes; a `noise()` map draws each channel with its own noise, like `feTurbulence` (decision 114)
- `mask-image` cuts holes in an object, read like a gradient in `color` with transparent colors, `mask-mode: luminance` too; the ray, the reflections and the mouse go through the holes, and an object inside shows through them (decision 113)
- Layers of background, like CSS, with transparent colors in them (and only there) and the 16 modes of `background-blend-mode`, each layer animated like a gradient (decision 112)
- The playground has an `html` tab for the elements that `element(#id)` shows; share links carry it (`#code=…&html=…`), and the examples and the docs pass it on (decision 101)
- `texture: element(#card)`, first step: an HTML element of the page as a live texture, uploaded at each `paint` of the canvas with `texElementImage2D` (both shapes of the API), found inside the canvas or through the `<slot>` of `<gss-scene>`; WebGL2 only, `auto` picks it (decision 101)
- `noise()`, wherever a gradient goes: colors placed by a 3D gradient noise, like SVG `feTurbulence` (scale, octaves, `turbulence`, `seed`, `at`), cut in the object's own space, following the view in the background, animated like a gradient (decision 111)
- Several lights, and colored lights: `light` elements in `@scene`, point lights placed like objects (groups, animations, motion path, `:hover` through their group), with `color` and `intensity`; the sun with a color, an intensity and `none`, animated by the scene; a colored `ambient` (decision 110)
- The docs page "Set variables from JavaScript": the three methods on `mount()`, `mountAsync()` and `<gss-scene>` (after `load`), the values by syntax, a live slider; `@property` links to it and lists every property a variable can go in, checked against the compiler (decision 109)
- `fog` on the scene: `fog: [<color>] <start> <end>` from the camera, into the background behind each object, or a color that covers the background too; animatable, readable from `@property`; hides the sharp end of the floor (decision 108)
- `transform-origin`: keywords and percentages on the box of the object, numbers from its center like `translate`, numbers only on a group; animatable, readable from `@property`; the bounding spheres follow it (decision 107)
- Nesting with `&`, unfolded by the parser: rules inside rules, a descendant without `&`, `&` inside `:has()` / `:not()`, `@media` inside a rule; autocompletion and the VS Code grammar follow (decision 106)
- `@property` and `setProperty()` / `getPropertyValue()` / `removeProperty()`: registered variables set from the page without compiling again, in three steps: transforms, colors and the background; inside `calc()` and the color functions, computed on the GPU; everywhere a value reaches the shader (decision 105)
- A computed value out of its range is clamped to it, like CSS: `color-mix(… calc(sibling-index() * 40% - 20%))` no longer fails on the last copies (decision 104)
- Animated gradients (decision 102) and the scene's own animation of its background (decision 103)
- The Essentials: `:nth-child()` and its family (decision 92), `:not()` (93), `currentColor` (94), `:active` (95), `animation-timeline: scroll()` / `view()` (96); then the motion path (97), `conic-gradient()` (98), the screen no longer mirrored (99)
- Release 0.0.3 on npm, tag `v0.0.3`, site deployed (with motion path, `conic-gradient()` and the unmirrored screen)
- A filtered object next to a metal, jelly or glass compiles on WebGL2: the object filters are written before the reflections that call them (decision 100)
- WGSL and native WebGPU rendering next to GLSL / WebGL2, automatic backend with fallback, WGSL tab and backend selection in the playground, profiler on both backends (decisions 90, 91)
- A misspelled function inside math suggests the one it was meant to be (`slibling-index()` → `sibling-index()`)

- Autocompletion of property names in the playground and every "Try it", from the registry, filtered by what the rule targets (decision 89)

- Every error of a compile at once: the tokenizer and the parser go on after an error, then every value error once the text reads; all underlined in the editor, counted in the status bar, listed with line and column by the Vite plugin (decision 86)
- The performance panel is public on gss-lang.dev, closed by default (decision 87)
- `shader/codegen.ts` split into `shader/codegen/`, 15 files, shaders byte for byte the same; `readNumber` / `readAngle` in `values/` (decision 88)
- Release 0.0.2 on npm, tag `v0.0.2`, site deployed

- Prepared 0.0.2: versioned installation and CDN package entry, site footer version, documentation navigation grouped by subject (decision 85)

- `filter` on objects and groups: pixel filters on their own pixels (and in reflections), `blur()` and `bloom()` as layers carried in the alpha (decision 84)
- `filter` on the scene: `brightness()`, `contrast()`, `saturate()`, `grayscale()`, `sepia()`, `hue-rotate()`, `invert()`, `grain()` in the scene's shader, `blur()` and `bloom()` as passes after it (decision 83)
- `random()` (stable at every reload), `if()` with `media()` / `style()`, gradients in `background`, `color` and materials (decision 82) (`linear-`, `radial-`, `repeating-`), the media range syntax `(width < 600px)` (decision 81)
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

| Feature                               | Score | Short note                   |
| ------------------------------------- | ----: | ---------------------------- |
| `animation` (shorthand)               |   1.0 | Already in GSS               |
| `animation-name`                      |   1.0 | Tied to `@keyframes`         |
| `animation-duration`                  |   1.0 | Already in GSS (decision 70) |
| `animation-timing-function`           |   1.0 | Already in GSS (decision 70) |
| `animation-delay`                     |   1.0 | Already in GSS (decision 70) |
| `animation-iteration-count`           |   1.0 | Already in GSS (decision 70) |
| `animation-direction`                 |   1.0 | Already in GSS (decision 70) |
| `animation-fill-mode`                 |   1.0 | Already in GSS (decision 70) |
| `animation-play-state`                |   0.7 | Runtime pause possible       |
| `animation-composition`               |   0.5 | Blending tracks, later       |
| `animation-timeline`                  |   1.0 | Already in GSS (decision 96) |
| `animation-range` / `-start` / `-end` |   0.5 | Same, timelines              |
| `transition` (shorthand)              |   1.0 | Already in GSS (decision 68) |
| `transition-property`                 |   1.0 | Same                         |
| `transition-duration`                 |   1.0 | Same                         |
| `transition-delay`                    |   1.0 | Same                         |
| `transition-timing-function`          |   1.0 | Already in GSS (decision 68) |
| `transition-behavior`                 |   0.4 | Little use for SDFs          |
| `timeline-scope`                      |   0.4 | DOM-centric                  |
| `interpolate-size`                    |   0.2 | Box layout                   |

#### Transforms & motion path

| Feature                                               | Score | Short note                                                                     |
| ----------------------------------------------------- | ----: | ------------------------------------------------------------------------------ |
| `transform`                                           |   0.9 | Already split (translate/rotate/scale)                                         |
| `transform-origin`                                    |   1.0 | Already in GSS (dec. 107)                                                      |
| `transform-style`                                     |   0.6 | 3D groups already; preserve-3d limited                                         |
| `transform-box`                                       |   0.3 | Box CSS                                                                        |
| `translate`                                           |   1.0 | Already in GSS                                                                 |
| `rotate`                                              |   0.9 | Close to `rotate-x/y/z`                                                        |
| `scale`                                               |   1.0 | Already in (uniform, SDF)                                                      |
| `perspective` / `perspective-origin`                  |   0.7 | Rather the scene camera                                                        |
| `backface-visibility`                                 |   0.3 | Raster faces                                                                   |
| `offset` / `offset-path` / `offset-distance`          |   0.9 | `offset-path`, `offset-distance`: already in GSS (decision 97); `offset` to do |
| `offset-rotate` / `offset-anchor` / `offset-position` |   0.8 | `offset-rotate`: already in GSS (decision 97); the others to do                |

#### Colors, opacity, compositing

| Feature                                      | Score | Short note                          |
| -------------------------------------------- | ----: | ----------------------------------- |
| `color`                                      |   1.0 | Already in GSS                      |
| `opacity`                                    |   1.0 | Already in GSS (dec. 116)           |
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

| Feature                                                               | Score | Short note                                                    |
| --------------------------------------------------------------------- | ----: | ------------------------------------------------------------- |
| `filter`                                                              |   1.0 | Already in GSS on the scene, objects and groups (dec. 83, 84) |
| fog (GSS / atmosphere, not a strict CSS property)                     |   1.0 | Already in GSS (dec. 108)                                     |
| `backdrop-filter`                                                     |   0.6 | Post-process behind the object                                |
| `mask` (+ clip/composite/image/mode/origin/position/repeat/size/type) |  0.55 | `mask-image`, `mask-mode` in GSS as holes (dec. 113)          |
| `mask-border` (+ longhands)                                           |   0.2 | Box mask image                                                |
| `-webkit-mask-*`                                                      |   0.1 | Vendor                                                        |
| `clip-path`                                                           |   0.6 | Cutting → SDF / CSG                                           |
| `clip` / `clip-rule`                                                  |   0.3 | Legacy / SVG rule                                             |
| `-webkit-box-reflect`                                                 |   0.3 | Mirror stretch                                                |

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

| Feature                                                                                                                                                                                                                                                                                                             |     Score | Short note                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------: | ---------------------------------------------------------- | --- |
| Type / `<shape>`                                                                                                                                                                                                                                                                                                    |       1.0 | Already in GSS                                             |
| `.class` / `#id` / `*`                                                                                                                                                                                                                                                                                              |       1.0 | Already in GSS                                             |
| Selector list `a, b`                                                                                                                                                                                                                                                                                                |       1.0 | Already in GSS                                             |
| Descendant `a b`                                                                                                                                                                                                                                                                                                    |       1.0 | Already in GSS                                             |
| Child `>` / adjacent `+` / sibling `~`                                                                                                                                                                                                                                                                              |       1.0 | Already in GSS (dec. 73)                                   |
| Column `\|\|`                                                                                                                                                                                                                                                                                                       |       0.0 | Tables                                                     |
| `&` nesting                                                                                                                                                                                                                                                                                                         |       1.0 | Already in GSS (dec. 106)                                  |
| Attribute selectors                                                                                                                                                                                                                                                                                                 |       0.4 | Few attributes in GSS                                      |
| `:hover`                                                                                                                                                                                                                                                                                                            |       1.0 | Already in GSS (dec. 62)                                   |
| `:active` / `:focus` / `:focus-visible` / `:focus-within`                                                                                                                                                                                                                                                           | 1.0 / 0.5 | `:active`: roadmap (Essentials); focus: interaction host   |
| `:nth-child()` / `:nth-of-type()` / `:nth-last-*`                                                                                                                                                                                                                                                                   |       1.0 | Roadmap (Essentials): compile-time index                   |
| `:first-child` / `:last-child` / `:only-child` / `:first-of-type` / `:last-of-type` / `:only-of-type` / `:empty`                                                                                                                                                                                                    | 1.0 / 0.8 | Roadmap (Essentials), `:empty` later: scene structure      |
| `:is()` / `:where()` / `:not()`                                                                                                                                                                                                                                                                                     | 1.0 / 0.6 | `:not()`: roadmap (Essentials); `:is()` / `:where()` later |
| `:has()`                                                                                                                                                                                                                                                                                                            |       1.0 | Already in GSS (decision 69)                               |
| `:root` / `:scope`                                                                                                                                                                                                                                                                                                  |       0.6 | Root / scope                                               |
| `:lang()` / `:dir()`                                                                                                                                                                                                                                                                                                |       0.2 | I18n DOM                                                   |
| Link/visited/any-link/local-link/target\*                                                                                                                                                                                                                                                                           |       0.1 | Navigation HTML                                            |
| Form (`:checked`, `:disabled`, `:enabled`, `:valid`, `:invalid`, `:required`, `:optional`, `:read-*`, `:placeholder-shown`, `:autofill`, `:default`, `:indeterminate`, `:in-range`, `:out-of-range`, `:user-valid/invalid`)                                                                                         |       0.0 | Forms                                                      |
| Media (`:playing`, `:paused`, `:muted`, `:seeking`, `:buffering`, `:stalled`, `:volume-locked`, `:picture-in-picture`)                                                                                                                                                                                              |       0.1 | Media elements                                             |
| Shadow (`:host`, `:host()`, `:host-context()`, `:has-slotted`, `:state()`, `::part()`, `::slotted()`)                                                                                                                                                                                                               |      0.05 | Shadow DOM                                                 |
| View-transition pseudos (`:active-view-transition*`, `::view-transition*`)                                                                                                                                                                                                                                          |       0.1 | DOM VT                                                     |
| `::before` / `::after`                                                                                                                                                                                                                                                                                              |       0.4 | Pseudo content → clones?                                   |
| `::first-letter` / `::first-line` / `::selection` / `::marker` / `::placeholder` / `::backdrop` / `::file-selector-button` / `::grammar-error` / `::spelling-error` / `::highlight()` / `::search-text` / `::target-text` / `::details-content` / `::column` / `::cue` / `::checkmark` / `::picker*` / `::scroll-*` |       0.1 | Chrome / text                                              |
| Vendor `:-moz-*` / `::-moz-*` / `::-webkit-*`                                                                                                                                                                                                                                                                       |       0.0 | UI vendor                                                  |
| Keyframe selectors (`from`/`to`/`%`)                                                                                                                                                                                                                                                                                |       1.0 | Already via `@keyframes`                                   |
| Namespace separator `                                                                                                                                                                                                                                                                                               |         ` | 0.0                                                        | XML |

### Functions

| Feature                                                                                                                                           | Score | Short note                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------- |
| `var()`                                                                                                                                           |   1.0 | Already in GSS (dec. 55)                                                                                                              |
| `calc()`                                                                                                                                          |   1.0 | Already in GSS (dec. 52)                                                                                                              |
| `min()` / `max()` / `clamp()`                                                                                                                     |   1.0 | Already in GSS (dec. 52)                                                                                                              |
| `abs()` / `sign()` / `mod()` / `rem()` / `round()` / `pow()` / `sqrt()` / `hypot()` / `log()` / `exp()` / `progress()`                            |   1.0 | Already in GSS (dec. 52, 78)                                                                                                          |
| `sin()` / `cos()` / `tan()` / `asin()` / `acos()` / `atan()` / `atan2()`                                                                          |   1.0 | Already in GSS (dec. 52, 78)                                                                                                          |
| `random()`                                                                                                                                        |   1.0 | Already in GSS (dec. 81): at compile time, one stable value per object, property and call                                             |
| `calc-size()`                                                                                                                                     |   0.2 | Intrinsic box                                                                                                                         |
| `rgb()` / `hsl()` / `hwb()` / `lab()` / `lch()` / `oklab()` / `oklch()` / `color()`                                                               |   1.0 | Already in GSS (dec. 58, 79); `color()` takes srgb, srgb-linear, display-p3, xyz                                                      |
| `color-mix()`                                                                                                                                     |   1.0 | Already in GSS (dec. 79)                                                                                                              |
| `alpha()` / `light-dark()` / `contrast-color()`                                                                                                   |   0.7 | `light-dark()` and `contrast-color()` already in (dec. 79); `alpha()` waits for transparency                                          |
| `device-cmyk()` / `dynamic-range-limit-mix()` / `palette-mix()`                                                                                   |   0.2 | Niche print/HDR/fonts                                                                                                                 |
| `cubic-bezier()` / `linear()` / `steps()`                                                                                                         |   1.0 | Already in GSS (dec. 68, 80)                                                                                                          |
| `blur()` / `brightness()` / `contrast()` / `grayscale()` / `hue-rotate()` / `invert()` / `opacity()` / `saturate()` / `sepia()` / `drop-shadow()` |   1.0 | Already in GSS (dec. 83), plus `bloom()` and `grain()`; `opacity()`, `drop-shadow()` need transparency                                |
| `translate*()` / `rotate*()` / `scale*()`                                                                                                         |   0.9 | Already GSS concepts                                                                                                                  |
| `skew()` / `skewX()` / `skewY()`                                                                                                                  |   0.4 | Skew ≠ SDF exact                                                                                                                      |
| `matrix()` / `matrix3d()` / `perspective()`                                                                                                       |   0.5 | Generic matrix                                                                                                                        |
| `sibling-index()`                                                                                                                                 |   1.0 | Already in GSS (dec. 52)                                                                                                              |
| `sibling-count()`                                                                                                                                 |   1.0 | Already in GSS (dec. 52)                                                                                                              |
| `path()` / `circle()` / `ellipse()` / `polygon()` / `inset()` / `rect()` / `xywh()` / `shape()` / `ray()`                                         |   0.7 | Shapes / motion path                                                                                                                  |
| `superellipse()`                                                                                                                                  |   0.5 | Corner shape                                                                                                                          |
| `url()`                                                                                                                                           |   0.8 | Already in `texture` (dec. 59); `@import` later                                                                                       |
| `attr()` / `env()`                                                                                                                                |   0.4 | Host / env                                                                                                                            |
| `if()`                                                                                                                                            |   1.0 | Already in GSS (dec. 81): `media()`, `style()`, `else`, `not` / `and` / `or`                                                          |
| `layer()`                                                                                                                                         |   0.5 | With `@layer`                                                                                                                         |
| `type()` / `param()`                                                                                                                              |   0.5 | `@function` / `@property`                                                                                                             |
| `anchor()` / `anchor-size()`                                                                                                                      |   0.2 | Anchor pos DOM                                                                                                                        |
| `scroll()` / `view()`                                                                                                                             |   1.0 | Roadmap (Essentials): `animation-timeline`                                                                                            |
| `counter()` / `counters()` / `symbols()`                                                                                                          |  0.05 | Counters                                                                                                                              |
| Gradients (`linear-` / `radial-` / `conic-` + repeating-\*)                                                                                       |   0.9 | Already in GSS: `linear-`, `radial-`, `conic-` and their `repeating-` forms, in `background`, `color` and materials (dec. 81, 82, 98) |
| `image()` / `image-set()` / `cross-fade()` / `element()` / `paint()`                                                                              |   0.2 | CSS images; `element()` planned in `texture` (dec. 101)                                                                               |
| `-moz-image-rect()`                                                                                                                               |   0.0 | Vendor                                                                                                                                |
| `fit-content()` / `minmax()` / `repeat()`                                                                                                         |   0.0 | Grid                                                                                                                                  |
| Font variant fns (`stylistic`, `styleset`, …)                                                                                                     |   0.0 | Fonts                                                                                                                                 |

### Concepts

| Feature                                                              | Score | Short note                                        |
| -------------------------------------------------------------------- | ----: | ------------------------------------------------- |
| Cascade & specificity                                                |   0.9 | Already in (with `!important`)                    |
| Inheritance                                                          |   0.7 | Scene/group properties                            |
| Nesting                                                              |   1.0 | Already in GSS (dec. 106)                         |
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
| Scroll-driven animations                                             |   1.0 | Roadmap (Essentials)                              |
| Generated content                                                    |   0.3 | Limited pseudos                                   |
| Lists & counters                                                     |  0.05 | Out of scope                                      |
| Fonts & text layout                                                  |  0.05 | Out of scope                                      |
| Paged media / fragmentation                                          |   0.0 | Print                                             |
| CSSOM / style sheets API                                             |   0.3 | Host runtime, not the core                        |
| Houdini (`@property`, paint worklet)                                 |   0.5 | `@property` useful; paint not                     |
| Anchor positioning                                                   |   0.2 | DOM layout                                        |
| Environment variables                                                |   0.4 | `env()` host                                      |
| Mixins / custom functions                                            |  0.55 | DX compile                                        |
