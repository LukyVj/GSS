# 3D in the layout, and the project's design tokens

**Status**: discussion only, nothing built (Lucas and Claude, Oct. 9, 2026). No decision number yet:
each part below becomes a decision if and when it is built.

**Where it comes from**: Lucas asked whether a Tailwind-like layer was possible
(`<div gss-class="sphere-radius-2 translate-1-0-1">`). The analysis found that utility classes
are the wrong layer for GSS (see "What was set aside"), but that two ideas behind the question are
worth keeping:

1. **3D in the layout**: a GSS object lives *inside* an HTML element, placed and sized by the
   page's own CSS (flex, grid, padding). Lucas's answer to "where do you see the object?": inside
   the div, in the layout.
2. **Token intake**: a scene reads the design tokens of the project it lives in (Tailwind or not),
   so the 3D uses the site's palette, radii and easings without copying them.

---

## 1. 3D in the layout

### The idea

What front-end developers want from 3D is rarely a full-screen scene: it is an accent. A 3D icon
in a button, a gem on a pricing card, an orb in an avatar, a medal in a badge. Today GSS gives them
a `<gss-scene>`, one canvas per scene, a box they size themselves. The idea is the reverse: **the
page's layout places the objects**, and GSS only draws them.

No other "CSS for 3D" tool does this well, and it is where GSS stops being "Tailwind for 3D" and
becomes something of its own: the part of CSS GSS scores lowest on (flex, grid, box flow: 0.0–0.1
in the roadmap's fit table) becomes useful, because the browser does it and GSS reads the result.

### A CSS-native syntax: anchor positioning

CSS already has a way for one thing to be placed relative to an element elsewhere: **anchor
positioning** (`anchor-name`, `position-anchor`). Following the repo's rule (when a CSS notion
exists, GSS takes its syntax and behavior), a first sketch:

```html
<button class="buy">
  <span class="gem" style="anchor-name: --gem"></span>
  Buy now
</button>
```

```css
/* GSS */
@scene { octahedron#gem; }

#gem {
  position-anchor: --gem;   /* lives in the box of the element named --gem */
  object-fit: contain;      /* fits the box, like an <img> */
  color: var(--color-violet-500);
  material: glass();
  animation: spin 6s linear infinite;
}

#gem:hover { scale: 1.15; } /* true when the button's anchor element is hovered */
```

The CSS properties it would borrow:

| CSS | Role in GSS |
|---|---|
| `anchor-name` (on the HTML element) | names a box an object can live in |
| `position-anchor` (on the GSS object) | which box the object lives in |
| `object-fit`, `object-position` | how the object fits its box (`contain`, `cover`, `none`) |
| `perspective`, `perspective-origin` | how strong the 3D is, and from where it is seen |
| `overflow` | whether the object may draw outside its box (a lifted card, a glow) |

The roadmap scores anchor positioning 0.2 ("DOM layout") today; this idea is exactly the case
where it maps well. Alternatives to discuss: an HTML attribute (`<span gss="gem">`), or a
`<gss-object>` element. `anchor-name` has the advantage of being a real CSS property, already in
Chromium, and of keeping the structure in `@scene` (decision 2 holds: HTML gives a place, GSS
describes the object, like decision 63).

### How it could run

- **One canvas for the page**, fixed over the viewport, `pointer-events: none`. Browsers allow
  about 16 WebGL contexts per page: one canvas per element does not scale to a list of cards.
- **Positions as uniforms, not as recompiles**. Each frame, the runtime sends the box of each
  anchor (x, y, width, height in canvas pixels) like `@property` values (decision 105). Layout
  changes, scrolling and resizing never touch the shader.
- **Each pixel marches only its own object**. The shader finds the anchor box the pixel falls in
  and marches that object alone; a pixel outside every box is discarded at once. Most of the page
  costs nothing, which matters for a full-viewport canvas.
- **A camera per box**. With one global perspective, an object near the edge of the screen is seen
  from the side. Like CSS 3D transforms, each box could have its own `perspective-origin` (its
  center by default), so the gem in the footer looks like the gem in the header.
- **Reading the boxes cheaply**: `ResizeObserver` and `IntersectionObserver` for size and
  visibility, the scroll offsets each frame, so the runtime does not force a layout per frame.
  Boxes off screen are skipped.

### Interaction and accessibility

- **The element's state is the object's state**: `#gem:hover`, `:active` (and a new `:focus-visible`)
  are true when the *anchor element* is hovered, pressed or focused. The button already handles the
  pointer and the keyboard; the 3D follows. No picking pass needed for anchored objects, and the
  3D becomes reachable from the keyboard for free.
- **Semantics stay in HTML**: the object is decorative; the element carries the label
  (`aria-label`, the button's text). Screen readers see a normal page.
- **Fallback**: without WebGL / WebGPU, or on a software renderer (decision 137), nothing is drawn
  and the element shows its own content (an emoji, an `<img>`, an SVG), like the poster of
  `<gss-scene>`.
- **Layout never depends on the 3D**: the box is sized by CSS, so there is no layout shift when the
  scene arrives, and server rendering works as is.

### Hard parts (to be honest about)

- **Scroll sync**: a fixed canvas that follows elements can lag one frame behind the scroll on some
  browsers (visible as objects "swimming"). Prior art handles it (see below); it needs measuring
  early, on Safari and Firefox too.
- **Stacking with HTML**: a canvas over the page draws over text; under the page, it is hidden by
  opaque backgrounds. Likely answer: over the page, objects only inside their box, and the author
  keeps text out of the box. `overflow: visible` (a glow) is where it gets hard.
- **Elements that come and go** (a React list): a new anchor would mean a new object, so a new
  shader. Better: one GSS object template matched by many elements (a class of anchors), with a
  fixed maximum of instances in a uniform array. The count changes, the shader does not.
- **Units**: in a box, lengths in `px` / `rem` finally mean something. Choice to make: one unit = the
  box's height, or CSS pixels, or both (`object-fit` deciding the scale).
- **A new runtime mode**, not a compiler change: the compiler mostly gains a per-object "box"
  input; most of the work is in the runtime and its tests (GPU tests that move and scroll a page).

### Prior art

- **drei `<View>`** (react-three-fiber): one canvas, a scissor per tracked `div`. Proves the
  approach on real sites, and documents the scroll-sync pitfalls.
- **Studio sites** (Lusion, Active Theory…): fixed WebGL canvas synced to DOM elements, by hand.
- **`<model-viewer>`**: one element per 3D object, one canvas each; simple, but it hits the context
  limit, which is why the single canvas matters.
- **A-Frame**: 3D described in HTML; a lesson on DOM cost, not this idea (here the DOM only gives
  boxes).

---

## 2. Token intake: a scene reads the project's design tokens

### The idea

A site already has its palette, radii, durations and easings, written somewhere: Tailwind v4's
`@theme`, a `:root { --brand: … }`, a `tokens.json` from Figma or Style Dictionary. A GSS scene
should read them instead of copying hex codes. Not a Tailwind integration: **a way to take in the
tokens of any project**, Tailwind being one source among others.

### The CSS-native answer: inheritance

In CSS, a custom property is inherited from the parent element. A `<gss-scene>` (or an anchored
object) *is* in the page: its scene could simply **inherit the custom properties of its host
element**, like any child would. Then:

```css
#gem { color: var(--color-violet-500); }   /* defined by Tailwind, read from the page */
#gem { color: var(--brand, tomato); }      /* the fallback works as in CSS */
```

The scene's own variables win, since they are closer, exactly like the cascade. It also respects
theming scopes: a scene inside `.theme-dark` reads the dark values.

### Two moments to read them

| When | Source | Fits |
|---|---|---|
| **In the page** (`<gss-scene>`, `mount()`) | the computed style of the host element | everything the page defines, whatever produced it |
| **At build time** (Vite plugin, no page yet) | files the plugin is pointed at: CSS (`@theme`, `:root`), DTCG `.tokens.json`, maybe a Tailwind v3 config | precompiled scenes, and checking names at build time |

A sketch of the build-time option: `gss({ tokens: ["src/app.css", "tokens.json"] })`.

**DTCG** (the W3C Design Tokens Community Group format) is the format worth supporting beyond CSS:
Figma variables, Tokens Studio and Style Dictionary export to it, and its types map well: `color`,
`dimension`, `duration`, `cubicBezier`, `number`.

### Live tokens

Read once at compile time, a token is frozen. A theme switch (light / dark, a brand theme) would
then need a recompile. Better: a variable that comes from the page becomes a uniform, like a
registered `@property` (decision 105), and the runtime updates it when the page changes: on a
`prefers-color-scheme` change, on a class or style change of an ancestor (`MutationObserver`), or
by reading the few variables the scene uses once per frame. To decide: which of these, and the cost.

### What maps, what does not

| Token | In GSS |
|---|---|
| Colors (Tailwind v4 writes `oklch()`, GSS reads it) | `color`, gradients, materials, `background`, lights |
| Durations, easings (`--ease-out`, `--default-transition-duration`) | `transition`, `animation` |
| Radii (`--radius-lg`) | `corner-radius`, meaningful in a box (part 1) |
| Spacing (`--spacing`) | only meaningful in a box, with CSS units |
| Shadows, fonts, breakpoints | no direct use (breakpoints: `@media` already reads the page) |

### Open questions

- Today a `var()` with no definition and no fallback is an error. With page tokens, it becomes
  "defined somewhere else": the playground cannot know. A token file attached to a playground
  scene? A warning instead of an error when the scene is embedded?
- Can the docs / playground show a scene with a sample palette (the Tailwind default theme) so
  examples using `--color-*` work as is?

---

## 3. Examples to show (Lucas liked these)

Each one written twice, as a demo page: the HTML / CSS of the page, the GSS of the object, and the
same object as a plain `<gss-scene>` for comparison. All of them use the page's tokens.

- **A button with a 3D icon** that turns on hover and squashes on press (`:hover`, `:active`
  through the button).
- **A product card** whose object lifts on hover (`overflow: visible`).
- **Pricing gems**: one gem per tier, color and material from the tier (`matte`, `metal`, `glass`),
  placed by a grid.
- **A 3D loader / spinner** inside a button that is loading.
- **A 404 page** in jelly.
- **A badge or medal** in `gold`, in a profile header.
- **An avatar orb** that follows `dark:` / `prefers-color-scheme` (live tokens).
- **A hero background** that follows the theme.

---

## What was set aside, and why

- **Utility classes** (`sphere-radius-2 translate-1-0-1`): the same vocabulary as GSS properties,
  so no less to learn; negative numbers, decimals, functions, gradients and `@keyframes` need
  arbitrary-value brackets (`translate-[-0.5_1_0]`), less readable than GSS; `* n` and
  `sibling-index()` loops disappear. And a class that changes means a new shader, which can take
  seconds to link on Windows (decisions 143, 150), where Tailwind is free.
- **A scene described in HTML** (A-Frame-like `<gss-sphere style="radius: 2">`): kept as a possible
  later step for React / Vue components; it would revisit decision 2.
- **A library of ready-made classes inside GSS** (`@import "gss/kit"`, `sphere.glass.float`): not
  set aside, just not this discussion. It needs `@import`, and it is the cheapest "Tailwind-like"
  win for beginners.

## Who it is for

- **Front-end developers** (Tailwind, React, Vue) who want 3D accents in a real page: the main
  audience of part 1.
- **Design-system teams**: part 2 makes GSS follow their tokens, which is what makes a tool
  acceptable in a product.
- **Site generators and LLMs** (v0, Bolt, Lovable…): they already produce a page with tokens; a
  small GSS block plus an `anchor-name` is easy to add.

## Before building anything

1. A throwaway spike for part 1: one fixed canvas, three anchored boxes in a scrolling page, boxes
   sent as uniforms; measure scroll sync on Chromium, Safari and Firefox. This is the risk that
   decides the rest.
2. Token intake in the page only (inheritance from the host element), frozen at compile time: the
   smallest useful step, and it does not depend on part 1.
3. Then: live tokens, build-time sources (CSS, DTCG), and the syntax of part 1 as decisions.
