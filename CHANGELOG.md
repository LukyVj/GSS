# Changelog

Notable changes to GSS, grouped by release. Features developed across several commits are listed once.

The 0.0.1 history was reconstructed from GitHub.

## Unreleased

### Changed

- The screen is no longer mirrored: +x is on the right, like CSS, and `rotate-y` and `rotate-z` now turn like CSS `rotateY()` and `rotate()` (clockwise). Gradients, conic gradients, textures, `path` and `prism` shapes and motion paths now appear as written, no longer flipped left to right. The default `light` becomes `-45deg 54.7deg`, so a scene without `light` is lit as before, from the upper left. Every scene, example and showcase of the site was mirrored to keep its look. **A scene written for an earlier version** shows mirrored: negate the x of `translate` and `camera-target`, the angles of `rotate-y` and `rotate-z`, and the first angle of `light` and `camera-angle`.

### Added

- `conic-gradient()` and `repeating-conic-gradient()`, like CSS: `from <angle>`, `at <position>`, stops placed with angles or percentages; in backgrounds, on objects and in materials.

- Motion path, like CSS: `offset-path: path("…")` or `ray(<angle>)`, `offset-distance` (a length or a percentage, animatable with `@keyframes`, `:hover` and the scroll) and `offset-rotate` (`auto`, `reverse`, an angle). The path stands in the object's xy plane like the `path` shape, so a tube and an object following it share the same `d`.

### Fixed

- A scene with a `filter` on an object and a metal, jelly or glass material no longer fails to compile on WebGL2: the reflections apply the object's filters without error.

## [0.0.3] — 2026-10-02 (prepared, not yet published)

### Added

- Scroll-driven animations, like CSS: `animation-timeline: scroll()` (the scroll of the page or of the nearest scroll container, any axis) and `view()` (the scene crossing the screen). The progress of the scroll replaces the time; iterations, direction and easing still apply. In the playground and the docs, a slider over the scene stands in for the scroll.

- `:active`, like CSS: the object pressed with the mouse or a finger, until the button goes up. It goes wherever `:hover` goes (groups, combinators, `:has()`), is drawn over the hovered state, and takes `transition`. On WebGL2 and WebGPU; scenes without `:active` compile as before.

- `currentColor`: the object's own color wherever a color is expected, like CSS: in `color-mix()`, `light-dark()`, gradient stops, a material (`metal(currentColor, 0.2)` follows the animated or hovered color) and variables, read with the color of the object that uses them.

- `:not(<selector list>)`, like CSS: any selector inside, complex ones, `:nth-child()` and `:has()` included (`cube:not(#g cube)`, `group:not(:has(sphere))`); it weighs like its most specific selector. Resolved at compile time.

- Structural pseudo-classes, like CSS: `:nth-child(An+B [of S])`, `:nth-last-child()`, `:nth-of-type()`, `:nth-last-of-type()` (`odd`, `even`, `3`, `2n+1`, `-n+3`…), and `:first-child`, `:last-child`, `:only-child`, `:first-of-type`, `:last-of-type`, `:only-of-type`. The copies of a `* n` are siblings one by one, so `:nth-child()` counts like `sibling-index()`: in `@scene { cube * 4; sphere; }`, `cube:nth-child(odd)` is cubes 1 and 3. Resolved at compile time, at no rendering cost.

- Performance panel for WebGPU: FPS, frame/CPU percentiles, resolution and shader/pipeline preparation time, plus asynchronous GPU timestamps spanning picking, scene rendering and post-processing when `timestamp-query` is available. Profiling remains lazy until the panel is opened and works with automatic backend selection.

- Dual GLSL/WGSL compilation for scenes, filter passes and media variants. Native WebGPU runtime with textures, camera controls, animation, hover picking and post-processing; `mountAsync()` selects WebGPU with a WebGL2 fallback or forces either backend. Existing synchronous APIs retain WebGL2. The playground includes backend selection and a WGSL tab; `<gss-scene backend="auto">` opts into WebGPU.

- The editor of the playground and of the reference suggests property names while you type, only those the rule can take (the scene, a shape, a group, `:hover`, a face, a `@keyframes` frame), each with its syntax and description.

- Every error of a compile is reported at once, not only the first: after an error, the tokenizer and the parser go on reading (to the end of the declaration, the element or the rule), then, once the text reads, every wrong property, value, variable or object is reported. The playground and every "Try it" underline each one and write it under its line, the status bar counts them, and the Vite plugin lists each error with its line and column. One error is still thrown as a `GssError`; several as a `GssErrors`, a `GssError` whose `errors` lists them in the order of the text.

### Changed

- A misspelled function inside math names the function it was meant to be: `Unknown function slibling-index(): did you mean sibling-index()?`
- The playground's performance panel is closed by default; the `perf` button or Alt+P opens it, and that choice is remembered.

## [0.0.2] — 2026-10-01

### Added

- Versioned npm, Vite and CDN installation guides, under Installation → Embedding a scene. Ship a standalone `lib/embed.js` in npm, with the `gss-lang/embed` entry point and a pinned jsDelivr URL.
- Package version in every site footer; homepage installation cards for npm, Vite and CDN.
- Modern colors: `hwb()`, Lab/LCH, OKLab/OKLCH, `color()`, `color-mix()`, `light-dark()` and `contrast-color()` (decision 79).
- Additional math: inverse trigonometry, `sign()`, `round()`, `mod()`, `rem()`, `hypot()`, `log()`, `exp()` and `progress()` (decision 78).
- `steps()`, `step-start` and `step-end` easings, including animation and transitions (decision 80).
- Deterministic compile-time `random()` and conditional `if()` values (decision 81).
- Linear, radial and repeating gradients on scene backgrounds and objects, including reflections (decisions 81–82).
- Filters on scenes, objects and groups: color adjustments, grain, blur and bloom, with additional rendering passes where needed (decisions 83–84).
- Camera, perfume, watch and orbit sequencer scene files; regression tests for every watch media variant, including WebGL compilation.


- Child (`>`), adjacent sibling (`+`) and subsequent sibling (`~`) selectors, including mixed chains, `:hover`, relative selectors inside `:has()`, empty groups and multiplied objects. Nested style rules with `&` are still unsupported. ([49309f0](https://github.com/LukyVj/GSS/commit/49309f0))
- `:has()` to match groups by their contents and let one object's hover affect another, with selector lists and descendant selectors inside. ([22a28cb](https://github.com/LukyVj/GSS/commit/22a28cb), [750bba0](https://github.com/LukyVj/GSS/commit/750bba0))
- `@media` rules evaluated by the browser, including color scheme and reduced motion. The compiler prepares variants for up to four distinct queries; the runtime switches variants while preserving the camera. `animation: none` can disable animation in a matching query. ([46ddf76](https://github.com/LukyVj/GSS/commit/46ddf76))
- Animation delay, iteration count, direction and fill mode, plus six animation longhands. Animations continue to loop by default for compatibility. ([b1850fc](https://github.com/LukyVj/GSS/commit/b1850fc))
- `ease`, `ease-in`, `ease-out`, `cubic-bezier()` and `linear()` easing functions, and `transition` for smooth changes into and out of an object's hover state. ([655ee5e](https://github.com/LukyVj/GSS/commit/655ee5e), [4d0b979](https://github.com/LukyVj/GSS/commit/4d0b979))
- `scene { dpr: auto | max | <number>; }` to control rendering pixel density. ([ec54102](https://github.com/LukyVj/GSS/commit/ec54102))
- Documentation copying as Markdown or plain text. ([50b93a6](https://github.com/LukyVj/GSS/commit/50b93a6))
- Showcase entries and captures for L'Orrery, the macro pad, Tidal, Ripples and Proximity, plus an interactive logo reveal on the home page. ([df86324](https://github.com/LukyVj/GSS/commit/df86324), [c6ceb97](https://github.com/LukyVj/GSS/commit/c6ceb97), [1dbe290](https://github.com/LukyVj/GSS/commit/1dbe290), [bfd5f4e](https://github.com/LukyVj/GSS/commit/bfd5f4e))

### Changed

- The playground's performance panel (frame, GPU and CPU time, real pixels, shader build time) ships on the public site, behind the `perf` button or Alt+P.
- Accessible collapsible documentation groups with keyboard controls, visible focus, session-persisted expansion and automatic opening for the current page.
- Documentation sidebar grouped by topic, with alphabetical entry sorting and explicit numeric order overrides; reading order and breadcrumbs follow the same structure.

- Pre-render the home page, documentation and showcase so their content is available without JavaScript, and remove their rendering dependencies from client bundles. ([9bb1b83](https://github.com/LukyVj/GSS/commit/9bb1b83))
- Give reference examples descriptive names in the documentation and playground menu. ([bfd5f4e](https://github.com/LukyVj/GSS/commit/bfd5f4e))
- Organize compiler modules by pipeline stage and consolidate demo scenes in `src/scenes/`. ([2eeb00d](https://github.com/LukyVj/GSS/commit/2eeb00d), [06374f2](https://github.com/LukyVj/GSS/commit/06374f2))
- Refine benchmark image comparisons to tolerate isolated GPU rounding differences and one-pixel edge shifts within a 0.05% image budget. ([f713c9e](https://github.com/LukyVj/GSS/commit/f713c9e))

### Performance

- Compute animated and hovered transforms once per pixel in `animate()`, instead of recomputing them at each distance-field evaluation. Shared animations reuse the same computed values; Shadertoy exports receive the same optimization. ([ed437e9](https://github.com/LukyVj/GSS/commit/ed437e9), [5d650e6](https://github.com/LukyVj/GSS/commit/5d650e6))
- Skip scene raymarching when a ray misses the scene's bounding sphere. Scenes whose animation or transition bounds cannot be established retain the original path. ([4b1e2e4](https://github.com/LukyVj/GSS/commit/4b1e2e4), [9b104a1](https://github.com/LukyVj/GSS/commit/9b104a1))
- Skip whole groups of at least three objects when their bounds cannot improve the nearest distance; apply this only to eligible groups of plain unions. ([83ad25a](https://github.com/LukyVj/GSS/commit/83ad25a))

## [0.0.1] — 2026-10-01

First tagged release of `gss-lang`, covering development from September 25 to October 1, 2026.
([Release commit](https://github.com/LukyVj/GSS/commit/965e88cd9bb68fdc13ea61149d9f430c69f85a7a))

### Language and rendering

- Compile a GSS scene into a single WebGL2 fragment shader using signed-distance-field raymarching.
- Declare shapes in `@scene`, multiply them with `* n`, and nest them in groups with inherited transforms.
- Style objects with shape, class, ID, universal, list and descendant selectors; resolve specificity, source order and `!important`.
- Draw cubes, spheres, tori, cylinders, cones, capsules, planes, SVG path tubes and extruded prisms, including SVG arcs and filled contours.
- Translate, rotate and scale objects; combine their distance fields with union, subtraction, intersection and blending.
- Use matte, metal, jelly and glass materials, including reflections, refraction and frost styles.
- Animate translation, rotation, scale and color with `@keyframes`, computed in the shader.
- Use custom properties and `var()`, including inherited variables, variable references, cycle detection and animated variables.
- Compute `calc()`, `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()`, `sin()`, `cos()` and `tan()` at compile time, with `sibling-index()` and `sibling-count()` for repeated objects.
- Write colors as hex, `rgb()`, `hsl()` or CSS named colors.
- Apply image textures, per-face selectors (`::face()`, `::top`, `::bottom`), pixelated sampling and texture sizing, with up to 16 images per scene.
- React to object and group `:hover` through a picking pass and a separate hover cascade.
- Configure the floor, background, lighting and orbit camera.

### Embedding and tools

- Publish compiler and runtime entry points, a runtime-only entry point and a Vite plugin, with TypeScript declarations and an Apache-2.0 license.
- Embed scenes using `mount()` or `<gss-scene>`, with visibility-based sleeping, reduced-motion support, optional camera controls and relative texture URLs.
- Provide a CodeMirror playground with examples, shareable URLs, a GLSL tab, located errors and a rendering status bar.
- Export scenes to Shadertoy, mapping textures to `iChannel0`–`iChannel3` and reporting scenes that exceed its four-image limit.
- Generate the reference from a shared feature registry, with editable live examples, syntax highlighting and Algolia DocSearch.
- Provide a comment-preserving GSS formatter and a VS Code extension with syntax highlighting and formatting.
- Add the public website, brand assets, showcase, capture generation and embedding examples.
- Add a development profiler and a benchmark that compares rendering and performance across commits using alternating rounds.
- Test documented examples by compiling their generated shaders in Chromium/WebGL2.

### Performance and fixes

- Emit only the shader helpers and materials used by a scene.
- Read hover picking results asynchronously to avoid blocking the CPU on the GPU.
- Use bounding spheres to skip unnecessary `path` and `prism` distance calculations.
- Fix shared search initialization, editor selection visibility and error messages for negative computed radii.
- Keep camera spinning off by default.

[0.0.1]: https://github.com/LukyVj/GSS/tree/v0.0.1
