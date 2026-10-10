<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

# GSS documentation

GSS (GPU Style Sheets) writes 3D scenes in CSS: shapes declared in `@scene`, styled with selectors, the cascade and `@keyframes`, and compiled into one shader for WebGL2 and WebGPU.

New to GSS? Start with [Getting started](getting-started.md), then [Installation](installation.md). The same pages, with every example to edit live, are on [gss-lang.dev/docs](https://www.gss-lang.dev/docs).

## Start here

- [Getting started](getting-started.md): Why GSS, Your first scene
- [Installation](installation.md): Embedding a scene, Package (npm), Vite plugin, CDN (no build step), Set variables from JavaScript, Editor support

## Language

- [At-rules](at-rules.md): `@keyframes`, `@media`, `@paint`, `@property`, `@property-panel`, `@scene`
- [Selectors](selectors.md): `<shape>`, `.class`, `#id`, `*`, `a, b`, `&`, `!important`
- [Combinators](combinators.md): `a b`, `a > b`, `a + b`, `a ~ b`
- [Pseudo-classes and cursor](pseudo-classes.md): `:hover`, `:active`, `:has()`, `:not()`, `:nth-child(), :nth-last-child()`, `:nth-of-type(), :nth-last-of-type()`, `:first-child, :last-child, :only-child`, `::face(), ::top, ::bottom`, `cursor`
- [Variables and conditions](variables-conditions.md): `if()`, `var()`
- [Math](values.md): `calc()`, `abs(), sqrt(), pow()`, `asin(), acos(), atan(), atan2()`, `hypot(), log(), exp()`, `min(), max(), clamp()`, `progress()`, `random()`, `sibling-count()`, `sibling-index()`, `sign(), round(), mod(), rem()`, `sin(), cos(), tan()`

## Structure

- [Shapes and groups](shapes.md): `capsule`, `cone`, `cube`, `cylinder`, `group`, `lathe`, `octahedron`, `path`, `plane`, `prism`, `pyramid`, `sphere`, `torus`, `tube`
- [Geometry](object-properties.md): `corner-radius`, `d`, `depth`, `height`, `radius`, `size`, `stroke-width`, `thickness`, `view-box`
- [Combinations](combinations.md): `blend`, `operation`

## Appearance

- [Colors](colors.md): `color`, `background`, `background-blend-mode`, `floor`
- [Color functions](color-functions.md): `rgb()`, `hsl()`, `hwb()`, `lab(), lch()`, `oklab(), oklch()`, `color()`, `color-mix()`, `light-dark()`, `contrast-color()`, `currentColor`
- [Gradients and noise](gradients.md): `<gradient>`, `checker()`, `displace()`, `noise()`, `stripes()`
- [Materials](materials.md): `material`
- [Textures](textures.md): `element()`, `image-rendering`, `paint()`, `texture`, `texture-size`
- [Filters](filters.md): `filter`
- [Visibility, opacity, outlines and masks](masks.md): `display`, `mask-image`, `mask-mode`, `opacity`, `outline`, `outline-color`, `outline-offset`, `outline-style`, `outline-width`, `visibility`

## Motion

- [Transforms](transforms.md): `offset-distance`, `offset-path`, `offset-rotate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale`, `transform-origin`, `translate`
- [Animation and transitions](animations.md): `animation`, `animation-delay`, `animation-direction`, `animation-duration`, `animation-fill-mode`, `animation-iteration-count`, `animation-range`, `animation-range-end`, `animation-range-start`, `animation-timeline`, `animation-timing-function`, `transition`
- [Easings](easings.md): `cubic-bezier()`, `linear()`, `steps()`

## Scene

- [Camera](camera.md): `camera-angle`, `camera-distance`, `camera-spin`, `camera-target`
- [Lighting and fog](scene-properties.md): `light` (sun), `light` (point), `intensity`, `ambient`, `shadows`, `fog`
- [Rendering](rendering.md): `dpr`, `shape-rendering`, `view`
