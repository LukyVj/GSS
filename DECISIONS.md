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
**Later**: nested functions such as `calc(var(--x) / 2)` are not supported yet (session 3). Done: decision 55.

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
**Accepted limits**: no arcs (A) at first (they came with decision 49), no filled shapes (fill + extrusion comes later). A path costs more than a sphere: the logo renders about 10 times slower than the same scene with spheres in software rendering. Up to 512 segments per path.

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

## 39. Selectors and shapes are documented from the registry

**Decision**: the docs have two new sections, generated like the others: "Selectors and cascade" (`SELECTORS`: `<shape>`, `.class`, `#id`, `*`, `a, b`, `!important`, each with its specificity) and "Shapes" (`SHAPE_DOCS`: one entry per shape, with a description and its default dimensions). A shape does not list its own properties: `renderShape` finds them in `PROPERTIES` through `appliesTo`. `codegen.ts` exports `shapeNames()`, and a test checks that `SHAPE_DOCS` documents exactly those shapes. Selector anchors are written by hand (`selector-universal`), shape anchors are prefixed (`shape-cone`).
**Why**: selectors and the cascade are the heart of "the CSS of the 3D web", and they were documented nowhere. The registry stays the single source (decision 12): every example compiles on the CPU and on the GPU, and a new shape cannot ship without its entry. Reading the properties from `appliesTo` means a new shape property shows up on its shape without touching the docs. A name like `*` or `.class` cannot be an HTML id or a CSS timeline name, hence the anchors.
**Accepted limits**: the specificity of a selector is written as text, not computed by `specificity()`: nothing checks they agree. Descriptions are plain text (escaped), so they cannot link to another section.

## 40. plane: a finite, flat, thin box

**Decision**: `plane` is a finite rectangle lying flat in the xz plane, centered on its origin, 1 × 1 by default. `size` takes one value (a square) or two (width and depth), as full sizes (decision 36). It is drawn with `sdRoundBox`, a fixed thickness of 0.02 and no rounded corners: no new GLSL function. `rotate-x: 90deg` stands it up like a wall.
**Why**: a flat surface to place and style (a mat, a wall, a card, a shelf) is what a front-end developer expects from the word, like a div in 3D. An infinite plane would duplicate the floor; as a cutting tool, it can come later under another name. A surface with no thickness would be jumped over by the ray and flicker.
**Accepted limits**: the thickness cannot be changed. A plane lying on the floor needs `translate: 0 0.01 0`, half its thickness.

## 41. prism: a polygon(), filled and given a depth

**Decision**: `prism` fills a contour and gives it a depth. The contour is `d: polygon(x y, x y, …)`, written like CSS `clip-path: polygon()`: commas between points, at least 3 points, the polygon closes itself. It follows the rules of `path` (decision 35): the prism stands in the xy plane facing the camera, is centered on its polygon or its `view-box`, and y is flipped so a polygon copied from SVG or CSS keeps its way up. `depth` is its full thickness along z, 0.2 by default (decision 36). `readPolygon` (values.ts) returns `null` when the value is not a `polygon()`, so `d` can later accept `path()` too.
**How**: `polygonFunction` (path.ts) writes one GLSL function per polygon, side by side, with no array and no loop: `segment2()` gives the distance to each side, and `crosses()` flips a sign each time a horizontal line from the point crosses a side (an odd count means inside). `extrude()` turns the signed 2D distance into a 3D one. Objects sharing the same polygon share the function (`useFunction`).
**Why**: `polygon()` is known by every front-end developer and every LLM, and it gives stars, arrows and letters with a few points. A real triangle mesh would cost one distance per triangle at every step of every ray: too slow beyond a few dozen triangles. The word "mesh" stays out of the language: `prism` says what it does, like `lathe` later.
**Accepted limits**: no `path()` contour at first, so no curves and no holes (both came with decision 50), no bevel. The cost grows with the number of sides.

## 42. The status bar shows real numbers from the compiler

**Decision**: the playground ends with a status bar (DESIGN.md § 6): `ok · 3 objects · glsl 412 lines · compiled in 4 ms`, then the frame rate on the right; after an error, only `1 error`. `compileScene` also returns `objects`, the number of instances (like the camera settings, decision 16); `renderer.load` returns the whole `CompiledScene`, and `renderer.sampleFrames()` gives the images drawn since its previous call. The texts come from pure functions in `runtime/status.ts` (`plural`, `statusParts`, `fpsText`), tested without a browser. The editor reports the numbers through `onStats`; its `status` badge becomes optional (the docs keep it).
**Why**: "honest numbers" is a rule of the design language, and these ones teach what GSS does: the GLSL line count grows with the scene, the compile time stays short. The object count is known only inside the compiler, hence the extra field.
**Accepted limits**: the compile time includes the GPU program creation (it is what the user waits for). A compile stops at the first error, so the count is always 1 for now.

## 43. A located error is written under its line

**Decision**: when a `GssError` knows its position, the editor underlines it (as before) and inserts a block under its line: `15:3  "height" only applies to …`, on the signal wash with a 2px signal rule. It is a CodeMirror block widget kept in a `StateField` (block widgets change the height of the document, which a view plugin may not do); it follows the text while typing and disappears at the next successful compile. An error with no position (a GLSL error) is still shown under the editor.
**Why**: the error sits where the eye already is, as in the design reference (`design/reference/png/02-playground.png`). line:column is the format of every compiler and of our own errors.
**Accepted limits**: one error line at a time, like one compile error at a time.

## 44. The docs show one entry per page

**Decision**: the reference is still generated as one HTML page (`renderDocs`), but `docs/pages.ts` shows one entry at a time, chosen by the hash: `#material` shows `material`, `#material--example-2` scrolls to its second example, a section (`#shapes`) opens at its first entry, anything else at the very first one (`resolvePage`). The layout follows `design/reference/png/03-docs.png`: the contents on the left (the current entry marked with `aria-current`), the entry in the middle with a breadcrumb and previous / next links (`neighbors`, across sections), "On this page" on the right (the value table, each example, and a link that opens the first example in the playground). The contents fold away on a small screen.
**Why**: one long page buried each entry among fifty others, and the design reference is a page per entry, like MDN. Keeping the whole reference in the HTML means every existing link (`#material`, `#object-properties`) still works, the tests of `render.ts` are unchanged, and the change of page is instant.
**Accepted limits**: "find in page" only searches the entry on screen. The highlight of what is being read (view timelines) is gone: with one entry on screen, `aria-current` says it. An open "Try it" is closed when the page changes (one WebGL canvas at a time).

## 45. group: a node that holds other objects

**Decision**: `@scene` becomes a tree. `group#letters { cube#L; cube#U }` holds objects, and groups can be nested. A group is written like any object (`group`, `#id`, `.class`, `* N`), so it is styled with the selectors and the cascade we already have: `#letters { translate: -6 1 0; }`, like an SVG `<g id="letters">`. Only `group` may have children; `cube#a { … }` is an error pointed at `cube`. `group#g * 2` duplicates the whole group (`g-1`, `g-2`). `expandScene` flattens the tree: it outputs only the drawn objects, numbered from 1 across the whole scene; a group never takes an index, and each object keeps the list of its groups, from the outermost to the innermost.
**Why**: moving five letters meant editing five `translate`s. A group gives one place to move, turn or scale them together, and each child's position becomes relative to the group. The first idea, `[letters] { … }` then `letters { … }`, was dropped: in CSS `[…]` is an attribute selector, and a bare name would collide with type selectors (`cube { }`): a group called `cube` would be ambiguous.
**Accepted limits**: styles and transforms of groups are not applied yet (resolve and codegen come next). The descendant combinator came right after (decision 47); no child combinator (`>`) yet.

## 46. The ";" is optional between @scene elements

**Decision**: inside `@scene` (and a group), the `;` after an element may be left out: a new element or a `}` is enough to end it. Inside a rule, the `;` stays required between declarations (still optional before `}`).
**Why**: one object per line reads like a list, and the grammar needs no newline to know where an element ends: after `cube#a.big * 2`, only `;`, `}`, `{` or a new name can follow. In declarations, a value can span lines (`path("…")`, `polygon(…)`), so a newline cannot mean "end".
**Accepted limits**: `cube#a torus#b` on one line is accepted too; the formatter puts one element per line.

## 47. The descendant combinator: a space means "inside"

**Decision**: `#letters #S #left` targets `#left` when it is inside the group `#S`, itself inside `#letters`, at any depth. `parseSelector` returns the last compound (the object) with its `ancestors`, from the outermost to the innermost. `matches` reads them from right to left, like a browser: each ancestor must match one of the instance's `groups`, further out each time. The specificity adds up all the parts, like CSS: `#g #c` beats `#c`. Two ids in one compound (`#letters#S`) are an error, in a rule as in `@scene`: an object has only one id, and the old parser kept the last one silently.
**How**: the tokenizer skips spaces, so `parseSelector` finds them back with the positions of the tokens (`spanOf`): a gap between two tokens starts a new compound. No new token, so no test of the tokenizer changes. The formatter keeps one space in a descendant selector, and now also starts a new line for every element of `@scene` or a group, with or without `;` (decision 46).
**Why**: styling "every cube of the letters" or "the left bar of the S" without an id on each object is what groups are for, and every CSS developer reads a space this way.
**Accepted limits**: no child combinator (`>`), no sibling combinators (`+`, `~`). A comment between two parts of a selector counts as a space. A selector made in code (without positions) is read as one compound.

## 48. group is documented next to the shapes

**Decision**: `group` has its own entry in the Shapes section of the docs, even though it draws nothing: that is where a reader looks for what can be written in `@scene`. `ShapeDef` gets an optional `takes`, the only properties that have an effect (translate, the rotations, scale and animation); the page lists them instead of "every object property". The test that compares the documented shapes with the compiler's now expects `group` on top of them. `@scene`, translate, the rotations, scale, animation and the `<shape>` selector say what they do on a group, and `@scene` has an example with a group.
**Why**: every feature gets its entry as soon as it exists (decision 12), and a group without docs is a group nobody finds.
**Accepted limits**: a property a group does not take (`color: red` on `#letters`) is silently ignored; an error or a warning would be better.

## 49. Arcs (A) in paths

**Decision**: `d: path()` accepts `A rx ry rotation large-arc sweep x y` and `a`, like SVG. Like SVG, radii too small to reach the end point are scaled up, a radius of 0 draws a straight line, an arc to its own start draws nothing, and the two flags may be glued (`a1 1 0 011 0` in minified SVG). A flag other than 0 or 1 is an error.
**How**: `arcCenter` turns the two points and the radii into a center, a start angle and a turn, with the conversion of the SVG spec (appendix B.2.4). The arc is then cut into segments like the curves, with the same flatness bound (curvature at most r × turn²), and its last point is the end point itself, so rounding never leaves a gap. No Bézier on the way.
**Why**: arcs are everywhere in icons exported from Figma or Illustrator (circles, rounded corners), and the error asked people to redraw them by hand.
**Accepted limits**: none left for prisms: decision 50 gave them `path()` contours, arcs included.

## 50. A prism accepts a path(): filled contours, with holes

**Decision**: `d` on a prism takes a `polygon()` or a `path("…")`. Every subpath of the path is a contour, closed even without `Z`, and all of them are filled together with the even-odd rule: a contour inside another one is a hole (the inside of an "o", the counter of an "a"). A logo exported as an SVG path becomes a solid object with `prism` instead of a wire with `path`.
**How**: `readPrismD` returns contours (one for a polygon); `polygonFunction` takes them all. The curves of a path are cut with a precision that follows the size of the shape (a thousandth of its width plus height), so a logo 400 units wide is as smooth, relative to its size, as a shape 2 units wide. Sides are grouped by 8 like the segments of a path: a group is skipped for the distance when its box is further than the nearest side found, and for the inside test when the horizontal line through the point does not cross its height. Far from the whole shape, the distance to its box is returned at once.
**Why**: logos and text are shapes, not lines, and the tube of `path` draws only their outline. The even-odd rule is the one the crossing test already used, so holes cost nothing more.
**Accepted limits**: SVG fills with the nonzero rule by default: a path drawn with overlapping contours in the same direction can show holes that the SVG does not. A detailed logo is heavy: the "Lucas" logo is 400 sides, fine on a GPU, very slow in software rendering.

## 51. A home page at /, the playground at playground.html

**Decision**: the site has three pages: the home page (`index.html`, `src/home/main.ts`), the playground (`playground.html`, formerly `index.html`) and the docs (`docs.html`). The home page follows `design/reference/png/01-home.png`: the headline, the mark in its distance field, three pillars with real code, a live demo (the real editor and renderer, started only when the section comes into view) and numbers read from the registry (shapes, properties, selectors). A link shared before the move (`/#code=…`) is sent on to `playground.html` with its code. The demo is the first scene of the docs, in `jelly` on a dark floor.
**Why**: a language needs a front door that says what it is before asking visitors to write code; the playground stays one click away. The numbers come from the registry so they stay true as the language grows. The WebGL context of the demo costs nothing to visitors who don't scroll to it. Glass on a dark floor shows the floor through it and turns muddy, hence jelly, the material of the logo.
**Accepted limits**: no `npm i gss-lang` and no GitHub link until the package and the repo are public. The home page has no test of its own: it only assembles tested parts (highlight, editor, renderer, status texts).

## 52. calc(), sibling-index() and the CSS math functions, computed at compile time

**Decision**: loops are written the CSS way: `* n` makes the copies, and `sibling-index()` in `calc()` tells them apart, like in CSS: `@scene { cube.petal * 12; } .petal { rotate-y: calc(sibling-index() * 30deg); }`. GSS knows `calc()`, `sibling-index()`, `sibling-count()`, `sin()`, `cos()`, `tan()`, `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()` and the constants `pi` and `e`, in any value, even inside another function (`metal(#fff, calc(0.1 * 2))`). `calc.ts` computes them after the cascade, once per object (`compileScene`), and puts back a plain NUMBER, DIMENSION or PERCENTAGE token that keeps the position of the whole call: the rest of the compiler is unchanged. Units follow CSS: + and - need the same unit (angles are brought back to deg, durations to s), _ needs a plain number on one side, / by a plain number keeps the unit, and dividing two angles gives a number. + and - need spaces, like CSS. Siblings are the objects of the same @scene block or group, a group included, counted one by one after `_ n` (`expandScene`: `siblingIndex`, `siblingCount`). The functions are documented in the registry (`FUNCTIONS`, a "Values and math" section), and a test checks that every function of `calc.ts`is documented.
**Why**:`sibling-index()`, `sibling-count()`and the math functions are real CSS: LLMs and front-end developers already write them, and "when a notion exists in CSS, we take its syntax". One rule replaces a loop, which is the point of "Rules, not loops". Sass-like`@for` would need its own variables, interpolation (`#{$i}`) and math anyway, for a syntax that is not CSS. Everything is known at compile time, so the GPU only receives numbers: math costs nothing when drawing.
**Accepted limits**: `var()` came later (decision 55). No unary minus before a function (`-sibling-index()`is read as one name): write`calc(-1 _ sibling-index())`. `sibling-index()`has no meaning in`scene { }`and in`@keyframes`, shared by every object: an error says so. A math value cannot be animated per object, except in a `@keyframes`that uses variables, which is copied per object (decision 55).`@for`/`@each`may come later for what`_ n` cannot do: a different shape at each step, or a list of values.

## 53. The shader only contains what the scene uses

**Decision**: the GLSL of a scene holds only the functions it calls. The shapes (`sdSphere`…), the helpers of `path` and `prism` (`segment2`, `box2`, `crosses`, `extrude`), the rotation and the operations other than union (`rot`, `opS`, `opI`, `opSmooth*`), the materials other than matte (`metal()`, `jelly()`, `glass()` with their constants) and their lighting (`shadeMetal`, `shadeJelly`, `shadeGlass` and what they call: `trace`, `fresnel`, `thickness`, `noise`…) each go in only when needed. What always stays is the raymarcher itself: `map`, `getMaterial`, `matte()`, `opU` (the floor uses it), `march`, `calcNormal`, `diffuse`, `main`. An empty scene went from 418 lines to 104.
**How**: each family of functions is a table in `codegen.ts` (`SHAPE_FUNCTIONS`, `PATH_HELPERS`, `MAP_HELPERS`, `MATERIALS`, `SHADING`), cut out of the template word for word. `used(table, code)` keeps the functions whose `name(` appears in the generated code, then looks again in the functions it kept, until nothing new comes up: `shadeGlass` brings `noise`, which brings `hash3`. It returns them in the order of the table, which is the order of the template, so each function comes after those it calls, as GLSL requires. Each table is searched in the right code: the shapes and the operations in `map()`, the path helpers in the generated path and prism functions, the materials in `getMaterial()`, the lighting in the lines `if (m.kind == …)` of `main()`, themselves written only for the materials the scene uses. The frost styles, `FROSTED` included, come with `glass()`; `matte()`, `metal()` and `jelly()` pass `0` as `frostStyle`, which only glass reads. The output is tidy: a section comment is written only when its section has something (`section()`), a hole at the end of a line leaves no blank line (`moreLines()`), and runs of blank lines become one.
**Why**: the GPU compiles every function it receives, so a shader full of unused code is slower to start, and the GLSL tab of the playground showed 400 lines for an empty file. Reading the generated code, instead of having every shape and material declare what it needs, cannot forget a dependency: `plane` gets `sdRoundBox` because it calls it.
**Accepted limits**: a function is found by its name followed by `(`, so a table must not hold a name that ends another one: with `box` and `sdbox`, a call to `sdbox(` would bring `box` too. The constant `MATTE` stays for readability: a `const int` costs nothing on the GPU.
**Rejected**: normals from 4 samples (a tetrahedron) instead of 6 (central differences). It saves 2 calls to `map()` per pixel against dozens in `march`, a few percent at most, and it is less precise: its error grows with the curvature (about e × curvature, against e² for central differences), which could show in the sharp reflections of metal and in glass.

## 54. The camera does not spin by default

**Decision**: without `camera-spin`, the camera stays still (`none`); `readSpin` returns 0 instead of 0.3 radian per second (a turn in about 21 s). The registry says `initial: none`.
**Why**: a scene stays where its author put it; the camera moves when the author asks for it (`camera-spin: 20s`) or with the mouse. The registry said `21s` and the compiler turned at 0.3 radian per second; both now say `none`.
**Accepted limits**: the examples of the docs without `camera-spin` no longer turn; `scene.gss` sets `camera-spin: 100s` itself.

## 55. Custom properties and var(), inherited and animatable

**Decision**: a property whose name starts with `--` is a variable, valid on the scene, on groups and on objects, and in `@keyframes` frames: `validate.ts` lets it through without looking it up in the registry. `var(--name)` and `var(--name, fallback)` read it, like CSS. Variables are inherited: the scene plays `:root`, then each group from the outside in, then the object; the closest level wins (`compileScene`: `levels`, `seenAt`). `vars.ts` replaces every `var()` by tokens (`resolveVars`), after the cascade and before the math, so `calc(var(--x) * 2)` works and the rest of the compiler never sees a `var()`: `computeVars` also drops the `--` properties before codegen. A variable can use another one (`--big: calc(var(--size) * 2)`): its value is resolved in turn, with the chain of variables being resolved, so a loop is an error that shows it (`--a uses itself: --a → --b → --a`). The fallback is only read when it is used, like CSS: `var(--size, var(--nope))` is fine when `--size` exists. A frame can set a variable: every animatable property of the object that uses it, directly or through another variable (`usesVariables`), moves with it. A `@keyframes` that sets or reads a variable cannot be shared, since its values depend on the object: `animateVariables` makes a copy for each object that plays it, with plain values, under a name no file can write (`up (copy 3)`), and the object plays that copy. `var` is documented with the functions (`FUNCTIONS`, `fn-var`), and the highlighter gives `--name` its own color (`gss-variable`).
**Why**: custom properties are real CSS, the first thing a front-end developer reaches for to share a value. Replacing them at compile time keeps decision 52's promise: the GPU only receives numbers. Copying the `@keyframes` per object keeps codegen unchanged, and costs nothing on the GPU, where each animated value is already written inline. It also lifts a limit of decision 52 for these frames: their math runs per object, so `sibling-index()` works in a frame that uses variables.
**Differences with CSS**: a missing variable without fallback is an error, not an invalid declaration silently dropped (decision 12). A variable that uses another one is resolved where it is used, not where it is declared: with `scene { --big: calc(var(--size) * 2); }` and `#g { --size: 5; }`, the objects of `#g` get 10, where CSS would give the value computed on the root. An animated variable moves the values that use it smoothly, as if it were a registered `@property`; in CSS, an unregistered variable flips at the middle of the step.
**Accepted limits**: a property that cannot be animated (`radius`…) and uses an animated variable is an error that names both. The variables of the scene and of `@keyframes` without an object are not animated: `scene { }` plays no animation. `@property` (typed variables) is not supported.

## 56. The site lives on gss-lang.dev, the repo stays private

**Decision**: the site (home, playground, docs, brand) is hosted on Vercel at `gss-lang.dev`. `vercel.json` turns on clean URLs, so pages are linked as `/playground`, `/docs` and `/brand`, without `.html`. Every page has a meta description, a canonical URL and its own Open Graph and X card (`public/marks/social-*.png`). The GitHub repo stays private for now.
**Why**: a language is judged by its front door: a short domain, links that look good when shared, and a playground one click away. Keeping the repo private leaves time to clean the code and rename `csl` → `gss` before opening it.
**Accepted limits**: no GitHub link and no `npm i gss-lang` on the site until the repo and the package are public (decision 51).

## 57. A brand page, and the words that go with the mark

**Decision**: `brand.html` (`/brand`) shows the marks from `DESIGN.md`: the `{ ● }` mark (light, dark, mono, isolines), the wordmark, the lockup, the icons and the social cards, all in `public/marks/`. The home card says **"Style sheets for the GPU."**; the tagline is **"If you can write CSS, you can write GSS."**
**Why**: the marks had to exist in every variation before the social cards were drawn from them, and one page lets anyone (people, press, coding agents) take the right file. One line for the home card, one for the pitch, so they stay the same everywhere.

## 58. rgb(), hsl() and the named colors, turned into hex at compile time

**Decision**: `colors.ts` turns `rgb()`, `rgba()`, `hsl()` and `hsla()` into a plain `#rrggbb` token (`resolveColors`), with the modern syntax (spaces) and the old one (commas). `rgb()` takes numbers from 0 to 255 or percentages, clamped; `hsl()` takes a hue as a number of degrees or in `deg`, `rad`, `turn`, wrapped around the circle (-120 is 240), and a saturation and a lightness as percentages or numbers. The 148 named colors of CSS Color 4 (`named-colors.ts`) become hex too, but only where a color is expected (`resolveNamedColors`): `color`, `floor`, `background`, and the first argument of a material (`metal(tomato, 0.2)`). This pass runs after the math, on objects, groups, the scene and `@keyframes` (`colorsOf`, `computeColors`), so the pipeline is: `var()` → math → colors → codegen, and `hsl(calc(sibling-index() * 45) var(--s) 50%)` works with no special case. `readColor` and the rest of codegen are unchanged: they only ever see a HASH token. `rgb()` and `hsl()` are documented with the functions (`fn-rgb`, `fn-hsl`); a test checks that `COLOR_FUNCTIONS` is documented.
**Why**: `rgb()`, `hsl()` and `tomato` are what a CSS developer writes without thinking. Converting them at compile time keeps the GPU receiving numbers only, like decision 52 and 55. Each pass does one thing and trusts the previous ones: the colors never need to know about variables or siblings.
**Named colors only where a color is expected**: `gold` is both a CSS color (`#ffd700`) and a GSS material (`material: gold`, decision 27). Replacing names everywhere would turn the material into a color, and every future GSS keyword could clash with one of 148 names. The property decides, like CSS, where `red` means a color in `color` but an animation name in `animation`.
**Accepted limits**: no alpha: `rgb(255 0 0 / 50%)` is an error ("GSS has no transparency yet"), not silently ignored (decision 12). No `transparent` and no `currentcolor`. An unknown name (`tomatoe`) is left alone and reported by `readColor`. A color written as a hex keeps 8 bits per channel: `rgb(127.5 0 0)` is rounded. `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`, `color()` and `color-mix()` come later.

## 59. Textures: images projected on the faces of the object, a face styled like a pseudo-element

**Decision**: `texture: url("dirt.png")` paints an image on an object. SDF shapes have no UVs, so the image is projected along the normal (triplanar mapping, dominant axis): the point and the normal are moved into the object's space with the same lines as `map()` (`spaceN()`), so the image moves, turns and scales with the object, groups included. By default one image covers one face (the size of the cube, the diameter of the sphere); `texture-size` sets the size of one image in the object's units, and `fract()` repeats it, like `background-size`. The image is painted over the color by its alpha, like `background-image` over `background-color`: an image that is not loaded yet (one transparent pixel) or a transparent pixel of a PNG shows the object's `color`. `image-rendering: pixelated` (or `crisp-edges`) reads the center of the nearest pixel (`textureSize`), per object, in the shader; the texture itself stays smooth on the GPU, so one image used pixelated and smooth is still one texture. One face is styled with a pseudo-element, like `::part()` in CSS: `::face(top)`, `bottom`, `front` (+z), `back`, `left`, `right` (+x is right), in the object's space; `::top` and `::bottom` are shortcuts, for the faces a Minecraft-style block changes most. A face rule counts like a tag in the specificity, only takes `texture`, and closes the selector. Each object gets `faceStyles` from the same cascade, with only the rules of that face, and they go through `var()` with the object's variables. A face without a rule of its own shows the object's texture.
**How**: the compiler lists every image once, the object's first, then its faces in the order of `FACES` (`sceneTextures`, at most 16: the texture units WebGL2 guarantees), and gives each one a `uniform sampler2D uTextureN`. `textureColor()` picks the image of the object by its id and, when a face has its own, the face by `faceOf()`, which runs the same tests as `triplanar()` so a face and its projection always agree. `faceOf()` goes in only when a face has its own image (decision 53). The renderer keeps one texture per file (`createTextureStore`), shared by every scene it loads, so typing in the playground does not download an image again, and binds image N to texture unit N each frame.
**Why**: textures were asked for to redo a Minecraft dirt block, then a grass block. `url()`, `image-rendering` and pseudo-elements are CSS, so a front-end developer (or an LLM) writes them without learning anything. Numbered sides (`::side(1)`) were rejected: which one is 1 would have to be learned by heart; the names of `border-top`, `border-left`… need no explanation. Pixelated in the shader rather than on the texture keeps the choice per object, like CSS, with no second copy of an image.
**This lifts part of decision 1**: "no textures, everything is computed" is no longer true for objects that ask for an image; the rest of the rendering is unchanged.
**Accepted limits**: a round shape is cut like the cube around it: a sphere shows six regions with seams, the image stretched near their edges (a soft blend, or a spherical mapping with `texture-mapping`, may come later). The images of −x, −z and the bottom are mirrored, invisible on dirt, visible on text. Reflections and glass see an object's color, not its image (`trace()` does not call `textureColor()`). `image-rendering` is set on the object, not per face. `url("…")` needs quotes; images come from URLs only (no drag and drop in the playground, and a share link does not carry them); an image from another site needs CORS. No atlas: one file per image.

## 60. The Shadertoy export plugs the images into Shadertoy's channels

**Decision**: `toShadertoy()` removes our `uniform` lines (Shadertoy writes its own), so a scene with textures lost the declaration of `uTextureN`, and the export no longer compiled. The export now adds `#define uTexture0 iChannel0`, one line per image (`channelDefines`), under a comment that says which channel holds which image. A scene with more than 4 images is refused with a clear error ("Shadertoy has 4 image channels, this scene uses N images"), shown for a few seconds on the `→ shadertoy` button. The GPU test wraps the export in a header that declares `iChannel0`…`iChannel3`, like Shadertoy does.
**Why**: Shadertoy cannot receive our PNG files: its 4 channels are filled by hand from its own library. An empty channel reads as transparent, and `triplanar()` mixes the image over the color by its alpha (decision 59), so a textured object falls back to its `color` with no special case: the export works as is, and anyone can put an image in the channel afterwards. Removing the textures, or refusing the export, would have been more code for a worse result.
**Accepted limits**: at most 4 images in an exported scene. The channels are not filled with our images; the user picks them in Shadertoy.

## 61. Analytics: DocSearch Insights and Umami, behind one track()

**Decision**: DocSearch runs with `insights: true`, so Algolia receives the clicks on search results (click-through rate, click position, searches without a click), on top of the search analytics it already had (top searches, searches without results). The site is measured with Umami Cloud: a `<script defer>` in the `<head>` of the 4 pages. Custom events go through `src/analytics/track.ts`: `track(name, data)` accepts only known event names (`playground-share`, `playground-example`, `docs-try-it`) and does nothing when Umami is not loaded (ad blocker, local dev, tests in Node). Simple clicks can use `data-umami-event` in the HTML.
**Why**: page views say little about a language; what matters is what people do: open the playground, share a scene, pick an example, try a doc example. Vercel Web Analytics on the Hobby plan has no custom events and one month of history. Umami is cookieless (no consent banner), open source, and has custom events on its free plan. One `track()` module keeps the tool replaceable: if the tool changes, only this file moves.
**Accepted limits**: `track()` is not called anywhere yet (share, examples and Try it are the next step). No `data-domains` on the script yet, so local dev and Vercel previews are counted. Ad blockers often block `cloud.umami.is`; serving the script from our domain (a rewrite in `vercel.json`) may come later. Compile errors are not tracked: they fire on every keystroke.

## 62. :hover: a second cascade, uHover[] in the shader, a picking pass in the renderer

**Decision**: `:hover` is a pseudo-class, read anywhere after the tag (`cube:hover.big`) and on the groups of a descendant selector (`#letters:hover cube`). It counts 100 in the specificity, like a class, as in CSS. It works in four steps:

1. **Triggers** (`resolve.ts`): for each object, the objects that, hovered, put it in its hover state (`hoverTriggers`, ids from 1). `cube:hover` → the object itself; `#g:hover cube` → every object of `#g`, nested groups included, like hovering a child hovers its parent in CSS. Several `:hover` in one selector must all be true: the sets are intersected. Several rules add up.
2. **Hover styles** (`resolve.ts`, `index.ts`): a second cascade, with the `:hover` rules this time (`hoverStyles`). The normal cascade skips them. `:hover` rules follow the specificity (`#a` beats `cube:hover`) and `!important` like any other, and go through `var()`, the math and the colors with the object's variables (`cube:hover { --c: red; }`).
3. **Shader** (`codegen.ts`): each object with triggers gets a slot in `uniform float uHover[N]`, 0 at rest, 1 hovered. Every animatable property that `:hover` changes becomes `mix(rest, hovered, uHover[slot])`, on top of `@keyframes` (`hoverValue` wraps `animatedValue`), in `map()`, `getMaterial()` and the texture spaces. Only the object's own node is mixed, never its groups. A scene without `:hover` gets exactly the same shader as before.
4. **Picking** (`renderer.ts`, `runtime/hover.ts`): each frame, when the scene has slots and the mouse is over the canvas, the same shader is drawn on a 1 × 1 framebuffer with `uPicking` on: it aims at the mouse pixel (`uPick`) and writes the id it hits right after `march()`, before any lighting (red + 256 × green, 0 for the floor and the background). `readPixels` reads it back, `hoverValues` turns it into `uHover[]`, then the real frame is drawn. `pointerleave` clears the hover.
   **Why**: slots rather than ids: a scene of 50 objects where 3 react sends 3 floats, not 51 (a `uniform float[]` costs one vector slot per value). A number from 0 to 1 rather than a boolean: `transition` will only make JavaScript slide it, the shader will not change. GPU picking rather than raymarching the mouse ray on the CPU: `map()` only exists in GLSL, and the same shader cannot disagree with what is on screen. Triggers resolved at compile time, like the rest of the cascade (decision 5): at run time, the renderer only compares one id with a list.
   **Shadertoy** (decision 60): no picking there. `uHover` becomes a constant array of zeros and `uPicking` / `uPick` constants: every object stays at rest.
   **Accepted limits**: an object has one hover state: two `:hover` rules with different triggers (`cube:hover` and `#g:hover cube`) both apply as soon as either one is triggered. A `:hover` rule cannot style a group (`#g:hover { translate: … }` is an error: write `#g:hover cube`), nor a face (`cube:hover::top`). Only the animatable properties (decision 24) and variables can change. The change is instant until `transition`. `readPixels` waits for the GPU once per frame; if it shows on large scenes, pick only when the mouse or the scene moves (since decision 65, the pixel is read without waiting). On a touch screen the object stays hovered after the touch, like mobile browsers. No `cursor` yet. `:has()` comes next, as more triggers: `#g:has(sphere:hover) cube` → the spheres of `#g`.

## 63. Embedding: <gss-scene>, mount() and a Vite plugin, on a runtime without the compiler

**Decision**: a GSS scene can be embedded in any page, three ways, one per audience:

- **Designers**, no build step: `<script type="module" src="https://www.gss-lang.dev/embed.js"></script>` then `<gss-scene src="logo.gss"></gss-scene>`, or the code inline in a `<script type="text/gss">` child.
- **Developers**: `import { mount } from "gss-lang"` then `mount(canvas, source)`; it returns `update()`, `pause()`, `play()` and `destroy()`.
- **Developers who count the kilobytes**: `import scene from "./logo.gss"` with the plugin `gss-lang/vite`, then `mount` from `gss-lang/runtime`: the scene is compiled at build time, the page ships the runtime and the shader, not the compiler.
  The runtime is split in two: `runtime/view.ts` draws a `CompiledScene` and does not import the compiler; `createRenderer` (`load(source)`, used by the playground, the home page and the docs) compiles, then hands the result to the view.
  An embedded scene behaves like the playground by default: drag turns the camera, the wheel zooms, `:hover` works (`controls="none"` / `controls: false` keeps only `:hover`). It only creates its WebGL context when it comes into view, stops drawing when it leaves it (its clock stops too, so an animation resumes where it was), and freezes the time under `prefers-reduced-motion`. Images are resolved against the `.gss` file (`base`), like `url()` in a stylesheet; the Vite plugin turns relative images into assets.
  **Why**: a use-case page has to show what a visitor can do on their own site, and until now GSS only lived on gss-lang.dev. `<gss-scene>` is a web component, but it does not go against decision 2: the structure of the scene stays in `@scene`; the element only gives a scene a place in a page, the one thing plain HTML cannot do without a script. `embed.js` is served by gss-lang.dev, so the showcase and designers can use it before the repo is public or the package is published. Splitting the runtime is what makes "no Three.js" a real argument: a precompiled scene costs a small runtime and one shader.
  **Accepted limits**: the wheel zooms by default, so the page does not scroll while the pointer is over a scene (Ctrl/Cmd + wheel, like maps, was proposed and set aside for now). GSS has no transparency: the scene's `background` should match the page. A browser keeps about 16 WebGL contexts: a page with many scenes should use captures and start one scene at a time. The npm package is not published until the project has a license.

## 64. Performance is measured, never assumed: a profiler in dev, a bench for every change

**Decision**: two tools, both dev only (they are not build inputs and never reach a page of the site or `embed.js`).
- **The profiler** (`src/profiler/`): a panel over the playground scene, shown or hidden with the `perf` button of the status bar or Alt+P, remembered across reloads. It shows the frame time (median, p95, p99) and the fps from the mean frame time, the GPU time of a frame (`EXT_disjoint_timer_query_webgl2`, read a few frames later, never waited for; "unavailable" without the extension, never 0 ms), the CPU time of the draw (where a GPU wait shows), the real resolution in canvas pixels and the GLSL build time. A line over budget turns signal: under 55 fps, a frame p95 over 20 ms, GPU over 12 ms, CPU over 4 ms, a shader over 500 ms. `view.ts` only knows an optional `profile(gl)` option and four calls (`frameStart`, `drawStart`, `drawEnd`, `shaderBuilt`): without it, nothing runs. The playground loads the panel with `import.meta.env.DEV ? await import(…) : null`, so a build does not contain it.
- **The bench** (`npm run bench:compare -- main [--dpr 2] [--scenes …]`, `scripts/bench.mjs`, `bench.html`, `src/bench/`): another commit is benched in a git worktree with today's bench and profiler copied in (the same measuring tool on the old engine), then the working tree, **3 rounds each, alternating**, in a real Chromium on the machine's GPU. For each scene: two images with the time stopped at 0 (mouse outside, then over the middle, for `:hover`) and the profiler's numbers (mouse outside, then over the scene). The report (`bench-results/compare.md`) says **worse** or **better** only when the medians differ beyond a floor (10 % and 0.3 ms for the GPU) **and every round agrees**; the p95 are shown, not judged. Any pixel that moves by more than 2 (out of 255) is a change, with an image of the differences; exit code 1 on a regression. `--dpr 2` renders like a Retina screen.
**Why**: "a frame feels slow" is not a number, and a speed-up that changes the image is not a speed-up. The first bench, with one run per version and fixed thresholds, reported regressions on scenes whose shader had not changed: two runs of the same code differ more than any fixed threshold. Alternating rounds measure the machine's own noise; comparing `main` with itself gives "no regression" on every line. Rendering at dpr 2 matters: on an M4 Pro at dpr 1 every scene ran under the screen's frame time, so no GPU change could show.
**Accepted limits**: the timings need a quiet machine and a visible window; a busy machine gives rounds so far apart that nothing can be judged (the report shows the lowest and highest round, so it can be seen). The images are taken at time 0 only. The GPU timer is missing in some browsers (Safari). The bench's verdict on pixels is strict: see the open question on edge pixels.

## 65. :hover reads its pixel without waiting for the GPU

**Decision**: the picking pass of decision 62 no longer reads its pixel with a blocking `readPixels`. `runtime/picker.ts` draws it into its 1 × 1 framebuffer, has the GPU copy it into a pixel buffer (`PIXEL_PACK_BUFFER`, `readPixels` with an offset), and puts a fence after it (`fenceSync`). Each frame, `poll()` checks the fence (`getSyncParameter`, never `clientWaitSync`); once it has passed, `getBufferSubData` reads the id at once. One pixel at a time: no new request while one is on its way. Until an answer comes back, the last hovered id holds; outside the canvas, nothing is hovered at once; a new shader forgets the old id.
**Why**: a blocking `readPixels` stops the CPU until the GPU has finished everything it was given, every frame the mouse is over a scene with `:hover`. Measured (bench, dpr 1, M4 Pro, mouse over the scene): CPU time of the draw 4.1 → 0.4 ms on orrery, 5.2 → 0.3 ms on macropad; the GPU median fell by 45 % too, since the GPU no longer sat idle while the CPU read. Every image identical, hover included.
**Accepted limits**: the hover answers one or two frames later (16 to 33 ms at 60 fps). When the GPU is saturated (dpr 2, a heavy scene), the one read that remains still waits behind the browser's GPU process: making the scene cheaper is what helps (decision 66). Picking only when the mouse or the scene moves is still possible.

## 66. map() skips a path or a prism when its bounding sphere is further than the nearest object

**Decision**: every shape gives the radius of a sphere, centered on its origin, that holds it (`SHAPES` returns `{ code, radius }`; `shapeRadius()`; for `path` and `prism`, `pathRadius` / `polygonRadius` in `path.ts`: their points around the view-box center, plus half the stroke or the depth, which also covers the box they return when far away). For `path` and `prism` only (`BOUNDED`), and only for a plain union, `map()` tests that sphere right after the object's own translate and before its rotations: `(length(q) - R * scale) * groupScales <= nearest`, where `nearest` is `res.x`, or `min(res.x, p.y)` when the scene only has plain unions and a floor (then `map()` is a plain `min()` and the floor counts from the start). The radius is rounded up with a 0.001 margin, for 32-bit floats.
**Why**: a `path` or a `prism` walks dozens of segments at every call of `map()`. GSS shapes are exact distances, so an object whose sphere is further than the nearest one would have lost anyway: the image does not change. Measured (bench, dpr 2, M4 Pro, 3 rounds): GPU median macropad 27.1 → 17.2 ms (−37 %, 120 Hz reached), logo 3.95 → 1.99 ms (−50 %), test scene 8.9 → 5.7 ms; every image identical. Bounding **every** shape was tried first and measured slower on scenes of simple shapes (spiral +44 %, todal +21 %): for a sphere the test costs as much as the shape, and one branch per object breaks the straight-line code GPUs run best. Scenes without path or prism compile to the exact same shader as before.
**Accepted limits**: a subtraction, an intersection or a blend is never skipped (far away, they still change the result). The radii of the simple shapes are computed and tested but unused: they are there for bounds on whole groups, or on the whole scene, later.

## 67. `dpr`: the pixel density of the render, chosen by the author

**Decision**: `scene { dpr: auto | max | <number>; }`, `auto` by default. `auto` is what every scene did before: the screen's `devicePixelRatio`, up to 2. `max` follows the screen, however dense. A number from 0.25 to 4 sets the density, never above the screen's (`dpr: 2` on a 1x screen renders at 1). The compiler reads it after `var()` and the math (`readDpr` in `compiler/dpr.ts`, called on the computed scene like `readCamera`) and returns it in `CompiledScene.dpr`; the runtime turns it into the canvas ratio with `pixelRatio(dpr, devicePixelRatio)` (`runtime/dpr.ts`), read at every `resize()`, so a new value applies at the next frame. A scene property (`scene { }`, with `floor` and `background`), not an at-rule: `@scene` lists the objects (decision 11), and a property is what `@media` will be able to change.
**Why**: the pixel density is the strongest lever on the GPU cost (dpr 2 renders 4 times the pixels of dpr 1), and only the author knows whether a scene must be sharp (`max`, a hero on a phone) or cheap (`1`, a heavy scene; below 1, a deliberately coarse look). A number is capped by the screen so that it never costs more than `max`: rendering above the screen (supersampling) would be a different feature. `auto` keeps every existing scene unchanged, and has a name so that a later `@media` rule can set it back.
**Accepted limits**: not animatable. The Shadertoy export ignores it: Shadertoy draws at its own size. Changing it with the screen waits for `@media`.

## 68. Easings and `transition`: one reading, computed in JavaScript for transitions and in GLSL for @keyframes

**Decision**: `compiler/easing.ts` reads every easing once: the CSS keywords (`ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear`), `cubic-bezier(x1, y1, x2, y2)` (x from 0 to 1, y free, so a curve can overshoot) and `linear(…)` with its positions filled like CSS (first at 0%, last at 100%, a run spread evenly, a position never going back, two percentages = a flat step, two points at one moment = a jump). `findEasing()` finds the one easing among the tokens of a shorthand. Two engines compute it: `runtime/easing.ts` (`ease()`: Newton, then bisection when Newton stalls) for transitions, and the shader for `@keyframes` (`cubicBezier()`, a 16-step bisection, written only when a scene uses it; `linear()` as segments, `step()` for a jump). **`ease-in-out` stays a `smoothstep()` in `@keyframes`**: the scenes written before keep their exact motion and cost (the 98 shaders of the scenes and examples are unchanged); a `cubic-bezier(0.42, 0, 0.58, 1)` written out is drawn the same way. `transition: [all] <duration> [<easing>] [<delay>]`, one per object (`compiler/transition.ts`, `ease` by default like CSS): `CompiledScene.transitions` gives each hover slot an `enter` transition (from the object's styles in the `:hover` state, so a `:hover` rule can set its own) and a `leave` one (the styles at rest), like CSS. The runtime (`runtime/transitions.ts`, `createTransitions()`) moves each `uHover[slot]` from where it is to 0 or 1: the shader is unchanged (decision 62 had planned it). Going back halfway takes the share of the duration still to cover, like CSS's reversing; a positive delay is kept, a negative one starts partway. Under `prefers-reduced-motion` (`freeze()`), the change stays instant.
**Why**: transitions are state the runtime keeps (decision 6): the mouse decides when they start and when they turn back, which the shader cannot know. `@keyframes` are a function of time, so they stay in the shader (decision 21). One parser keeps both engines reading the same curve. The bisection in GLSL is slower than Newton but never stalls (a curve like `cubic-bezier(1, 0, 0, 1)` has a flat point that stops Newton), and it only runs in scenes that use these easings.
**Accepted limits**: one transition per object: `transition: scale 0.3s` or a list (`scale 0.3s, color 1s`) is an error for now, since an object has one hover slot. `transition` only plays with `:hover` (nothing else changes a style at run time yet). `steps()` is not there yet. Since the default `animation` easing is `linear` (not `ease` as in CSS), an animation without an easing keeps a constant speed. The Shadertoy export ignores transitions (decision 62).

## Open questions

- **Targeting multiplied ids**: should `#hero` target `hero-1`, `hero-2` and `hero-3`?
- **Non-uniform scale**: is `scale: 1 2 1` worth supporting, with an approximate distance?
- **Scene styling**: `:root` could replace `scene { }`, as in CSS, where the root background paints the whole canvas.
- **Validation inside `@keyframes`**: an unknown or non-animatable property in a frame is an error (`validateKeyframes`); a custom property (`--x`) is allowed (decision 55). Still open: checking the values of a frame before the object that plays it is known.
- **Animation keywords**: every animation loops. `infinite` is accepted but changes nothing, and there is no iteration count, `animation-delay` or `animation-direction: reverse` yet.
- **Colors in operations**: blended objects switch color halfway instead of mixing (decision 19).
- **`@for` / `@each`**: are they worth adding, for what `* n` and `sibling-index()` cannot do (decision 52): a different shape at each step, or a list of values?
- **Gamma**: colors are lit as if they were linear and written without gamma correction, which gives hard shading. Correcting it would change the look of every scene.
- **Edge pixels in the bench**: moving the same arithmetic elsewhere in the shader (computing the animations once per pixel, branch `perf/animate`) changed 17 pixels out of 2 million, all on silhouettes, each taking a color one of its neighbours already had: the GPU compiler rounds the moved code a little differently, and on a grazing ray that flips hit and miss. Should the bench accept such edge flips (a changed pixel whose new color already exists in its 3 × 3 neighbourhood), or keep requiring identical pixels?
- **Shadows**: objects cast no shadow, so they seem to float. A soft shadow costs one more march per pixel; should it be on by default, with `scene { shadows: none; }`?
