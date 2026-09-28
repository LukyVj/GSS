# Design decisions

## 1. Raymarching, no Three.js

**Decision**: the whole scene compiles to a single GLSL fragment shader, rendered by raymarching signed distance fields (WebGL2).
**Why**: no dependency, a tiny runtime, and organic shapes (smooth unions) that plain rasterization cannot do.
**Accepted limits**: no imported models (GLTF); the cost grows with the number of objects.
**Later**: a WGSL/WebGPU backend, made possible by an intermediate step separate from GLSL.

## 2. Structure lives in `@scene`, not in HTML

**Decision**: objects are declared in a `@scene { cube.corner * 4; }` block.
**Why**: one self-contained file, easy to share and easy for an LLM to generate. No web components.

## 3. Multiplied ids are numbered automatically

**Decision**: `torus#hero * 3` creates `hero-1`, `hero-2`, `hero-3`. Without a multiplier, the id stays `hero`.
**Why**: practical, never a blocking error, and every object stays targetable.

## 4. Specificity: id 10,000, class 100, tag 1

**Decision**: specificity is a single number with widely spaced weights.
**Why**: as in CSS, no realistic number of classes beats an id, and `#hero.big` beats `#hero`.
With equal specificity, the last rule in the file wins.

## 5. Everything that can be computed at compile time is

**Decision**: the cascade, selectors and units (`70deg` → radians) are resolved by the compiler.
The shader only receives final values.
**Why**: a simpler, faster shader; the GPU knows nothing about CSS.

## 6. JavaScript holds the state, the shader draws

**Decision**: the camera, time and, later, hover and transitions live in TypeScript
and are sent to the shader as uniforms on every frame.
**Why**: a shader has no memory from one frame to the next.
**Update**: `@keyframes` animations are the exception, see decision 21. They only depend on time, so the shader computes them from `iTime`.

## 7. One material number per object

**Decision**: each instance has its own number (its index in the scene), used by `getMaterial`.
**Why**: numbers are always consistent, and every object stays identifiable, which `:hover` will need.

## 8. The AST keeps raw values

**Decision**: the parser stores selectors and values as tokens, without interpreting them.
**Why**: the parser only understands structure; meaning is given later, by the cascade and code generation.

## 9. Angles always have a unit

**Decision**: angles accept `deg`, `rad` and `turn`. Only `0` is accepted without a unit.
**Why**: as in CSS. Without a unit, `1.5` could mean degrees or radians.

## 10. Behavior changes are explicit

**Decision**: any change to how the language behaves comes with an updated test and an entry in this file.
**Why**: the language must never change as a side effect of a code change.

## 11. `@scene` declares, `scene` styles

**Decision**: `@scene { }` declares which objects exist; the `scene { }` rule styles the scene itself (floor, background, and later lights and fog).
Only the exact selector `scene` targets the scene: `.scene`, `#scene` and `scene.big` do not.
**Why**: structure and appearance stay separate, and scene styles benefit from the cascade (`@media`, `var()`, animations).

## 12. Every property is registered

**Decision**: every GSS property is described once, in `src/compiler/registry.ts`.
The compiler rejects unknown properties and properties used in the wrong place.
The reference documentation is generated from the registry, and every example is compiled by the tests.
**Why**: a feature cannot exist without its documentation, and typos are never silently ignored.

## 13. `scale` is uniform

**Decision**: `scale` takes a single positive number, applied on all three axes.
**Why**: a uniform scale keeps distances exact (the distance is multiplied back by the scale). A non-uniform scale would distort the distance field and cause rendering artifacts.

## 14. Shape-specific properties

**Decision**: some properties only apply to some shapes (`size` to `cube`, `radius` to `sphere` and `torus`).
Using one with an explicit, incompatible tag is an error (`sphere { size: 2; }`).
Through a class or an id, it applies to compatible shapes and is ignored by the others, as in CSS.
**Why**: clear errors when the intent is obviously wrong, without breaking classes shared by several shapes.

## 15. Property families share a prefix

**Decision**: related properties share a prefix (`camera-target`, `camera-distance`…), as in CSS (`border-width`, `border-color`).
The bare name (`camera`) is reserved for a future shorthand.
**Why**: families are easy to read and document, and shorthands stay possible without breaking existing files.

## 16. The compiler also returns runtime settings

**Decision**: `compileScene()` returns the shader and the settings the runtime needs (the starting camera).
`compileGSS()` stays a shortcut that only returns the shader.
**Why**: some values are starting points that the mouse then changes; they belong to the runtime, not to the shader.

## 17. Speeds are written as durations

**Decision**: `camera-spin` takes the duration of one full turn (`20s`, `500ms`) or `none`, not an angle per second.
**Why**: as in CSS (`animation-duration`), a duration reads naturally and uses units everyone already knows.

## 18. Operations apply in declaration order

**Decision**: `operation` combines an object with every object declared before it in `@scene` (union, subtract, intersect).
The floor is added last and is never affected. The walls of a hole take the material of the object that carves it.
**Why**: it reads like drawing, then erasing, and needs no grouping syntax yet.

## 19. blend smooths any operation

**Decision**: `blend: <distance>` turns the object's operation into its smooth version (Inigo Quilez's smooth union, subtraction and intersection). `blend: 0` keeps the sharp version.
**Limit**: in the blend zone, the color switches from one object to the other halfway, without a gradient.
**Why**: smooth blending is the signature of signed distance fields; no other web 3D tool offers it in one property.

## 20. Percentages are their own token

**Decision**: `50%` is a `PERCENTAGE` token, not a `DIMENSION` with the unit `%`. A `%` separated from its number (`50 %`) is an error.
**Why**: as in the CSS tokenizer. A percentage is not a unit like `deg`, and a distinct type prevents `50%` from ever reaching `readAngle` by mistake.

## 21. `@keyframes` animations are computed in the shader

**Decision**: `animation: float 2s` compiles to a GLSL expression that uses `iTime`, for example `mix(vec3(…), vec3(…), progress)`. Nothing changes in `main.ts`.
**Why**: a keyframes animation only depends on time, which the shader already receives. Everything else is resolved at compile time (decision 5).
**Accepted limits**: an animation cannot be paused, restarted or started on an event.
**Later**: `:hover` and `transition` depend on events, so they will go through JavaScript and uniforms (decision 6).

## 22. Keyframes follow the CSS rules

**Decision**:

- `from` means `0%` and `to` means `100%`. `0%, 100% { … }` sets both offsets.
- A missing `0%` or `100%` uses the object's own value (`translate`, `color`…).
- A frame only animates the properties it declares. A property that no frame declares keeps its own value.
- The same offset twice, or two `@keyframes` with the same name: the last one wins.
  **Why**: people and LLMs already know these rules from CSS.

## 23. Several keyframes make a chain of `mix`

**Decision**: each pair of neighbouring frames becomes one `mix()`, and each `mix()` takes over when the previous one ends. The timing function (`ease-in-out`) applies to each segment, not to the whole animation, as in CSS.
**Why**: one method works for any number of frames and for any value that `mix()` accepts (`float` or `vec3`).
**Accepted limits**: the progress expression is repeated in every segment, so the generated GLSL gets long. The GPU does not mind.

## 24. Animatable properties

**Decision**: `translate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale` and `color` can be animated. The other properties keep their fixed value.
**Why**: they are the ones that already produce a GLSL `float` or `vec3`, so `mix()` works on them directly.

## 25. The test scene has one zone per feature

**Decision**: `src/scene.gss` groups features into zones, separated in the file and in space: transforms at the center, operations behind (z = -6), animations in front (z = 6). Every object has its own id.
**Why**: a shared scene quickly becomes chaotic. A rule like `cube { … }` or a reused id silently changes another feature's objects.

## 26. `material` and `color` stay separate

**Decision**: `color` keeps the base color of the object. `material` says how its surface reacts to light. A material without its own color uses `color`, like `currentColor` in CSS.
**Why**: `color` stays animatable with `@keyframes`, even on a metal. And `color: #ff5a36; material: gold;` keeps a single, readable meaning: the material's own color wins.
**Accepted limits**: `material` cannot be animated.

## 27. Materials are functions, keywords are shortcuts

**Decision**: a material is a function with its settings, like `rgb()` in CSS: `matte()`, `metal(#d4af37, 0.2)`. The color is optional and always comes first. Keywords (`gold`, `chrome`) are shortcuts written in GSS: the compiler tokenizes their text and reads it again as a function.
**Why**: functions hold the settings, keywords are easy to guess for people and LLMs. A keyword adds no code: its checks and errors are the ones of its function.

## 28. Function arguments follow modern CSS

**Decision**: `readFunction` splits arguments on commas when there are some, otherwise on spaces. `metal(#fff, 0.2)` and `metal(#fff 0.2)` are the same, like `rgb(255, 90, 54)` and `rgb(255 90 54)`.
**Later**: nested functions such as `calc(var(--x) / 2)` are not supported yet (session 3).

## 29. One bounce for reflections

**Decision**: a reflection is one more ray, marched by `trace()`. What it hits gets diffuse lighting only: a metal seen in another metal looks matte.
**Why**: each bounce costs a full march per pixel.
**Accepted limits**:

- Roughness does not blur the reflection. It mixes the sharp reflection with diffuse light, because a real blur needs dozens of rays per pixel.
- Metals get a bit of diffuse light (0.3) so they stay readable on a dark background. It is a visual choice, not physics.
- The reflected ray starts 0.01 above the surface, otherwise it hits its own starting point.

## 30. Shader structure: reusable functions, one placeholder each

**Decision**: the shader is split into functions that can be called again: `march()` follows a ray, `trace()` tells what a ray sees, `diffuse()` lights a surface, `getMaterial()` returns a `Material` struct (color, kind, roughness). Values the whole shader needs are constants at the top: `MAX_DIST`, `BACKGROUND`, `LIGHT_DIR`.
**Why**: reflections, and later refractions, reuse the same functions. And `.replace()` only replaces the first occurrence: every `/*@…*/` placeholder must appear exactly once in the template.

## 31. Glass: one refraction in, one out

**Decision**: … Frost has four styles, all driven by one amount: the normals are bumped with smooth noise (`noise()`, stuck to the surface), like a normal map in a 2D glass shader. `frostSettings()` holds the size and strength of the bumps for each style. `frosted` adds a white patchy layer (the default), `wavy` and `hammered` only distort, `blurred` also averages 4 rays in a fixed cross, adds a tint, light on the bumps and speckles. Written `glass(1.5, hammered 0.4)`, style and amount in any order.
**Why**: we compared six techniques side by side. Random jittered rays were grainy and shimmered; smooth noise stuck to the surface gives distortion without grain.
**Accepted limits**: glass seen through another glass object looks matte (decision 29). Each glass pixel costs three more marches, six with `blurred`.

## 32. Glass must not touch the floor

**Decision**: glass objects float slightly above the floor in the examples.
**Why**: when the bottom face of a glass object is exactly on the floor, both surfaces are at the same place and the ray exiting the object gets confused: the render shows stripes.
**Later**: exclude the floor from `marchInside()`.

## 33. Code style: one formatter decides

**Decision**: `formatGss` sets the style of every GSS file. One instance per line in `@scene`. Rules are always expanded, one declaration per line, indented with two spaces. One space after the `:` of a declaration and none before; the `:` of a selector stays stuck (`cube:nth-child`). No column alignment. Blank lines written by the author are kept, but never more than one, and top-level blocks are always separated by one. Values are written as the author wrote them (`2.0`, `#BADA55`). Comments are kept exactly as written, on their own line or at the end of a line.
**How**: the formatter works on the tokens of `scan()`, which keeps comments and the position of each token. Between two tokens it only decides the whitespace: a line break after `{`, `;` and `}`, otherwise one space where the source had some and nothing where tokens touch. So it cannot change the meaning, and a test checks it on every documented example and on `scene.gss`.
**Where**: one function, used everywhere: the docs examples, the playground, `npm run format` (and `format:check`), and the VS Code / Cursor extension, which bundles the same file.
**Why**: readable diffs, no style debates, and the same result in the docs, the playground and the editor.

## 34. The playground: index.html, CodeMirror, the code in the URL

**Decision**: `index.html` is the playground. The editor is CodeMirror 6, colored by our own `classifyGss()` (the same as the docs), not by a CodeMirror grammar. The code lives in the URL (`#code=` + deflate + base64url), so the address bar is always a share link; nothing goes to a server. An "Examples" menu lists the first scene, the test scene and every example of the registry. A GLSL tab shows the shader the code becomes, read-only.
**Errors**: compile errors are `GssError`s with a `start` and an `end` in the source. Tokens get their position in `scan()`, kept in a WeakMap so the AST does not change; readers throw with `errorAt(tokens, message)`, and `locate()` gives a position to errors thrown deeper. The editor underlines the span and says "Line 6, column 14".
**Why**: the playground is what people open from a link, so sharing comes first. A textarea could not grow into line numbers, error marks, undo and later autocomplete from the registry. Keeping one classifier keeps the colors identical in the docs and the editor. The GLSL tab is the "readable path toward the shader" of Getting started.
**Accepted limits**: errors that are not about a written value (an unknown shape in `@scene`, a GPU compile error) have no position yet, only a message. CodeMirror adds about 120 kB (gzip) to the playground and to the docs' "Try it".

## 35. Custom shapes: path, a tube along an SVG path

**Decision**: a `path` object follows `d: path("…")`, written like the `d` of an SVG path (and CSS `path()`): M, L, H, V, C, S, Q, T, Z, absolute and relative. `stroke-width` is the thickness of the tube, in path units, with round ends. `view-box: x y width height` works like an SVG viewBox: its center is the origin of the object, so paths copied from one SVG stay aligned. y is flipped, so a path copied from Figma or an SVG keeps its way up. One path unit is one scene unit: an icon needs a `scale`.
**How**: strings are a new token (`STRING`). At compile time, curves are cut into segments that never stray more than 1/100 of the stroke width from the curve (fewer segments on gentle curves). Each path becomes a GLSL function written segment by segment (no array, no loop: much faster), with segments grouped by 8 behind a bounding box test, and the whole path behind its own box. Objects sharing the same path share the function.
**Why**: SVG paths are what front-end developers already copy from their design tools, and a tube is enough for icons and logos (the GSS logo is drawn in GSS: `src/playground/logo.gss`).
**Accepted limits**: no arcs (A) yet, no filled shapes (fill + extrusion comes later). A path costs more than a sphere: the logo renders about 10 times slower than the same scene with spheres in software rendering. Up to 512 segments per path.

## 36. Dimensions are full sizes, shapes are centered

**Decision**: every dimension a shape reads is a full size, and every shape is centered on its origin, like `size` for the cube. `height: 2` goes from y = -1 to y = 1 around the object's `translate`. The compiler halves the value before writing the GLSL, because Inigo Quilez's distance functions expect half sizes (`sdCylinder(q, 1.0, r)` for `height: 2`). `radius` stays a radius, as its name says.
**Why**: in CSS, `width` and `height` are full sizes; nobody writes half a height. Keeping one rule for every shape means a reader never has to know how a GLSL function counts. Centered shapes rotate and scale around their middle, which is what `rotate-*` and `scale` already do for cubes, spheres and tori.
**Accepted limits**: a shape does not stand on the floor at `translate: 0 0 0`: its y must be half its height (`translate: 0 1 0` for `height: 2`). A `transform-origin` could change that later.

## 37. The universal selector \*

**Decision**: `*` targets every object of the scene, never the `scene` settings. Its specificity is 0, as in CSS: a tag (1), a class (100) or an id (10000) always beats it, wherever it is written. `*` can only start a selector and can be followed by classes or an id: `*.big` is the same as `.big`. In the compiler, `*` is a selector with no tag, no id and no class, which `matches()` already accepted for every object: `parseSelector` only learns to read it.
**Why**: CSS does the same, so every front-end developer (and every LLM) already knows what it means. It gives one place for scene-wide defaults (`* { material: matte(); }`) and is needed later for `@media (prefers-reduced-motion) { * { animation: none; } }`.
**Accepted limits**: the cascade picks one value, it never combines them: `* { scale: 0.5; }` only changes the objects that have no `scale` of their own, and a `path.logo { scale: 0.1; }` keeps 0.1. `scale` also shrinks each object around its own center, so `* { scale: 0.5; }` makes objects smaller but does not bring them closer: to shrink the whole scene, positions included, use a scene-level scale.

## 38. !important: two passes in the cascade

**Decision**: a declaration ending with `!important` wins against every declaration without it, whatever their selectors. Between two `!important` declarations, specificity decides again, then the order of the file. The parser takes `! important` out of the value and marks the declaration (`important: true`, a field normal declarations do not have). `resolveStyles` walks the sorted rules twice: first the normal declarations, then the `!important` ones, which overwrite them. A `!` not followed by `important` is an error.
**Why**: CSS does the same, so front-end developers and LLMs already know it. It is the classic tool for accessibility overrides: `@media (prefers-reduced-motion) { * { animation: none !important; } }`. Two passes keep the sort by specificity untouched: `!important` is a second cascade on top of the first.
**Accepted limits**: the cascade still picks one value and never combines them: `* { scale: 0.5 !important; }` gives every object a scale of 0.5, it does not halve their own (the logo, scaled 0.1, becomes 5 times bigger). In `@keyframes` and in `scene { }`, `!important` is read but has no effect: the declaration counts as a normal one (CSS ignores `!important` declarations in keyframes). An animation still beats an `!important` value, where CSS would let `!important` win.

## Open questions

- **Targeting multiplied ids**: should `#hero` target `hero-1`, `hero-2` and `hero-3`?
- **Non-uniform scale**: is `scale: 1 2 1` worth supporting, with an approximate distance?
- **Scene styling**: `:root` could replace `scene { }`, as in CSS, where the root background paints the whole canvas.
- **Validation inside `@keyframes`**: declarations in frames are not checked yet. An unknown or non-animatable property is silently ignored.
- **Animation keywords**: every animation loops. `infinite` is accepted but changes nothing, and there is no iteration count, `animation-delay` or `animation-direction: reverse` yet.
- **Colors in operations**: blended objects switch color halfway instead of mixing (decision 19).
