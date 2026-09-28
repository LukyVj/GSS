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

**Decision**: a glass ray bends in with `refract()`, crosses the object with `marchInside()` (which marches with `-map()`), bends out, then `trace()` shows what's behind. When the light cannot get out (total internal reflection), the ray bounces back inside once.Frost averages 4 rays, each bent a little differently (jittered with `hash3()`), then adds a bit of milky white light. `ice` is `glass(#cfeaff, 1.31, 0.25)`.
**Accepted limits**: glass seen through another glass object looks matte (one bounce, decision 29). Each glass pixel costs three more marches. Frosted glass is grainy, and the grain shimmers when the camera moves. More rays would smooth it, at a higher cost.

## 32. Glass must not touch the floor

**Decision**: glass objects float slightly above the floor in the examples.
**Why**: when the bottom face of a glass object is exactly on the floor, both surfaces are at the same place and the ray exiting the object gets confused: the render shows stripes.
**Later**: exclude the floor from `marchInside()`.

## Open questions

- **Targeting multiplied ids**: should `#hero` target `hero-1`, `hero-2` and `hero-3`?
- **Non-uniform scale**: is `scale: 1 2 1` worth supporting, with an approximate distance?
- **Scene styling**: `:root` could replace `scene { }`, as in CSS, where the root background paints the whole canvas.
- **Validation inside `@keyframes`**: declarations in frames are not checked yet. An unknown or non-animatable property is silently ignored.
- **Animation keywords**: every animation loops. `infinite` is accepted but changes nothing, and there is no iteration count, `animation-delay` or `animation-direction: reverse` yet.
- **Colors in operations**: blended objects switch color halfway instead of mixing (decision 19).
