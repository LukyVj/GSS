# Changelog

Notable changes to GSS, grouped by release. Features developed across several commits are listed once.

The 0.0.1 history was reconstructed from GitHub.

## Unreleased

### Added

- `outline`: a line around the silhouette of an object, like CSS: `outline: 0.03 solid #111;` for a drawn look, or an outline that appears on `:hover`. Its width and `outline-offset` are in the units of the scene, so the line gets thinner far away, like the object. Every style of CSS: `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `inset` and `outset`. Its color is the object's own by default, and width, color and offset can be animated.
- In the playground and in Try it, `@media` reads the size of the render, like the result of CodePen: make the render narrower to see a `max-width` query apply. On a page, it still reads the window, like CSS.
- `display: none` leaves an object, or a whole group, out of the scene, and turns a light off; with `@media`, a phone can draw fewer objects. It still counts for `:nth-child()`.
- `visibility: hidden` hides an object: not drawn, no shadow, and the mouse goes through it. Like CSS, a group passes it to its objects, and it can change on `:hover` and in `@keyframes`, for a blinking light or an object shown by hovering another.
- `cursor: pointer`, `grab`, `grabbing` and the other cursors of CSS: the mouse pointer over an object, also in `:hover` and `:active` rules (`cube:active { cursor: grabbing; }`).
- `animation-range`, `animation-range-start` and `animation-range-end`: the part of a scroll timeline the animation plays on, like CSS: `animation-range: entry` plays while the scene comes into view, `entry 50% exit 50%` from half in to half out, and `25% 75%` on the middle of the scroll.
- `filter: vignette()` and `chromatic-aberration()` on the scene: darker corners, and red and blue that split towards the edges, like a lens.
- `material: iridescent()`: a thin film, like a soap bubble or the back of a CD, whose colors turn with the angle you see it at. `emissive` and `iridescent` also work as keywords, like `jelly` and `glass`.
- `checker()` and `stripes()`: a checkerboard and bands of two colors, wherever a gradient goes (`color`, a material, `background`, `floor`). Like `noise()`, they are cut in the object's own space, with no seam, and can be animated: `stripes(4 at 0 -0.25 0, …)` in a `@keyframes` makes the bands scroll.
- Three shapes: `pyramid`, on a square base and sized by `size` like a cube; `octahedron`, eight triangles, sized by `radius`; and `tube`, a hollow cylinder, with an outer `radius`, a `height` and the `thickness` of its wall.
- `material: emissive()`: a surface that gives its own light, a lamp, a screen or a neon, from a strength of 0 to 4. With `bloom()` in the scene's `filter`, it glows.
- `material: copper`, `silver`, `brass` and `aluminum`: four more metals, ready to use like `gold` and `chrome`.
- `@paint` and `texture: paint(name)`: a texture drawn by a fragment shader, the way CSS `paint()` draws an image from code. The block of `@paint rings { … }` is GLSL, written as it is for the web: `out vec4 color;` or `gl_FragColor`, with `time`, `resolution` and `mouse` filled by GSS (`u_time`, `u_resolution`, `u_mouse` too). It is drawn into a 512 × 512 texture, again at every frame when it reads `time`, once otherwise, and the object shows it like an image. An error in its GLSL names the `@paint` and its line. A scene with `paint()` is drawn with WebGL2. The playground, the docs and the VS Code extension color the block as GLSL, and the formatter keeps it as written.
- `scene { shape-rendering: geometricPrecision; }` smooths the silhouettes of the objects: a pixel that the edge of an object only partly covers blends the object with what is behind it. It takes about 15 % more work from the graphics card for now, so it is off by default: `auto` draws the sharp edges of before, unchanged.
- VS Code / Cursor extension: HTML snippets for both documented `<gss-scene>` forms, a scene loaded from a `.gss` file and an inline `<script type="text/gss">` scene.
- Docs: every page says the version that added it, beside its title: `since v0.0.3`.
- Docs: the contents mark the pages of the latest version with `new in v0.0.5`, and their group with a dot, so a folded group says it holds something new.
- GSS is open source on GitHub: [github.com/LukyVj/GSS](https://github.com/LukyVj/GSS). The site links to it from its top bars and footers, the docs at the top of Installation, and the package and the VS Code extension declare it, so npm and the extension registries link to the code and the issues.
- Computers without a graphics card: the processor would draw a scene so slowly that the page could freeze, so the scene waits for a click. `<gss-scene>` shows its poster and a button, "Draw it anyway"; the site does the same on the home page, in the playground and in Try it, where the code still shows. `softwareRendering()`, from `gss-lang` and `gss-lang/runtime`, tells a page that uses `mount()`.
- `<gss-scene poster="cover.jpg">`: an image shown until the scene draws, like the poster of a `<video>`.
- A scene too heavy for the computer stops instead of freezing the page: after a second or two of frozen frames at its lowest density, it stops drawing, `<gss-scene>` and the site show "Draw it anyway", and `mount()` fires a `gss-too-heavy` event on the canvas, where `scene.play()` draws it anyway.
- `mount(canvas, scene, { adaptDpr: false })`: the `dpr` as written, never lowered and never stopped, for a capture or a benchmark.
- Showcase: an eighth study, the GSS 0.0.5 announcement. A 30-second film written as one stylesheet: "css" types itself and turns into "gss.", the braces close the rule, then eight features take the stage one after the other. It opens in the playground, in the "Studies" group.
- An `animation` in a `:hover` or `:active` rule starts with the state and plays to its end, like a button that fires: the pointer can leave, the button can go up, the animation goes on, once unless it says how many times; the state stays on until it ends, or for good with `forwards`, and the next press plays it again. `cube:active { animation: topple 0.8s forwards; }`.
- Showcase: "Le Chonk", a pixel 4 in the inspiration grid. A `prism` from a staircase contour, pixelated tiles from a texture; a click tips it over to the left, then on its back, with an animation started by `:active`.
- Showcase: the Utah teapot joins the inspiration grid. A `lathe` body and lid, a `cone` spout and a `path` handle melted into the body; hover lifts the lid, a click sends the teapot over a speed bump, with `linear()` transitions that overshoot and settle.
- Showcase: the Product Hunt mark in 3D joins the inspiration grid. An orange coin with the P of the flat logo pushed out of it, its `d` pasted into `path()`; no sun, two lights sweep the stage and the coin floats over its own shadows.
- Showcase: a room lit by one shaft of sun, after Maxime Heckel's global illumination study, closes the inspiration grid. The sun comes in low through a window out of view and lands on the wall behind an orange ball; a warm light makes the ball glow on the floor, a cool one stands for the sky.
- GSS is on X: [@GSS_lang](https://x.com/GSS_lang), for news, scenes, questions and ideas. The site links to it from its top bars and footers, with a contact line in every footer (X for questions, GitHub for issues), the docs say so at the top of Installation, and a link shared on X attributes the card to the account. In the playground, once the share link is copied, the status bar offers to post it on X, with the account mentioned.
- Docs search: once a word is typed, the right column shows the page of the selected result, by the pointer or the arrows: its sentence, its syntax and an example (the one the result lands on), with a link to open it. With an empty box, the four drawings come back.
- Docs search: the columns on each side of the results can be widened or narrowed, by dragging the line between them or with the arrow keys, and the search keeps the widths for next time. Each column arranges itself for its width: the contents show the icon of each group once there is room, and a wide right column puts each drawing beside its text.
- Docs search: "Try it" on the example of a preview. The search slides to the left and the example opens live beside it, code and render, to edit without leaving the results; "Close" brings the search back. On a screen too narrow for both, it opens the example in the playground, in a new tab.
- Docs: "Editor support", at the end of Installation. The GSS extension for VS Code (highlighting, formatting, the `.gss` file icon) is on the Visual Studio Marketplace, and on Open VSX for Cursor, VSCodium and Windsurf: search for *GSS* in the Extensions view, or run `code --install-extension lukyvj.gss-language`.
- Docs: "Editor support" opens on a square button that holds the marks of VS Code and Cursor like letters in a pocket; on hover they come out, one after the other. It leads to the extension, with a line on what it does and where Cursor installs it.

### Changed

- A smaller package: a page that compiles GSS downloads 87 kB gzipped instead of 130, `<gss-scene>` from jsDelivr 89 instead of 113, and a scene compiled at build time 12 instead of 16. The compiler no longer carries the documentation, `lib/` is minified, and `gss-lang/embed` shares its files with `gss-lang` instead of holding its own copy: the npm package goes from 263 to 114 kB.
- A scene drawn with WebGL2 no longer freezes the page while it compiles. On Windows, the graphics driver can take seconds to prepare a large scene; the page now goes on in the meantime, the scene before it stays on screen, and `<gss-scene>` keeps its poster until the new scene can draw. Its `load` event comes once the scene is on screen.
- The live demo of the home page and the Try it of the docs stop drawing when they are scrolled off screen, and resume where they were, like `<gss-scene>` and `mount()` already did.
- Every scene starts at a density of 0.5, then climbs to its `dpr` in under a second while the frames keep up, and lowers it while they are slow: in `mount()`, `<gss-scene>`, the home page and the showcase too, not only in the docs and the playground. A weak graphics card no longer draws the first frames of a heavy scene at full density, which froze some browsers on the home page.
- The site on small screens: the side padding follows the width (56, 32, then 16 pixels), the top bars and the footers with it. The bars shrink in steps: the gaps first, then the GitHub and X links keep their mark and lose their text (under 800 pixels), then, on a phone, the home bar is two rows and the footers stack. A link never breaks on two lines.
- The eight studies render at a pixel density of 1.5 (`dpr: 1.5`), in the showcase and in the playground: sharper than before on a standard screen, lighter than before on a high-density one.

### Fixed

- Docs search: a result whose title holds a tag, like the chapter "From <gss-scene>", shows the tag as text; it was drawn as a real element in the list.

## [0.0.5] — 2026-10-04

### Added

- `lathe`, a new shape: a contour turned around the vertical axis, like clay on a potter's wheel, where a `prism` pushes it into a flat plate. Draw half the outline right of the axis x = 0, with `d: polygon(…)` or `d: path("…")`: a vase, a bottle, a bowl that is hollow, a chess piece, or a ring when the contour does not touch the axis. `view-box` centers its height.
- `floor` takes an image, like `color` on an object: a gradient, a `noise()`, or one of them moved by `displace()`. `floor: noise(2 2, #10182b, #273d62 55%, #0b1020)` is stone; `floor: radial-gradient(circle, #4a4f6a, #0b1020 12%)` is a pool of light under the scene. A gradient covers a square of 40 units centered under the scene, seen from above; a `noise()` is read at each point of the floor. A value `floor` cannot take now says so, instead of an error about `color`.
- `@property-panel { display: open | folded | none; }`: the playground and Try it in the docs show a panel at the top left of the render, with a control for each variable of `@property`: a slider and its number, or a color picker for a color. It sets the variable as it moves, without compiling the scene again; a number typed past the end of a slider widens it. A start value changed in the code gives the variable back to the code, and a button resets a moved one. `folded` starts with only its title. A page that embeds the scene shows no panel. The VS Code grammar colors `@property-panel` and `@property`.
- `view: distance` on the scene: the isolines of the distance to the objects, one every 0.25 and fainter as they go away, drawn over the scene on the plane that faces the camera through `camera-target`, the field the shader marches through. `view: shaded` is the default. In the playground and in Try it, the chips `view: shaded` and `view: distance` at the top left of the render switch it without touching the code; when the code changes its `view`, the code wins again.
- Playground: a "New features" group in the examples menu. Astral Greenhouse shows the ten latest additions in one scene; Property Control Room has three variables for the panel; Noise Atmosphere, Mask & Displacement and an HTML card shown with `element()` show one feature each.
- Playground: a separator between the editor and the scene. Drag it to resize the editor (its height on a phone), double-click it for the default size, move it with the arrow keys, or fold the editor into a thin rail by dragging it to the edge; a click opens it again. The size is kept in this browser.
- Playground and docs: a dpr menu at the top right of the render. `auto`, the default, lowers the pixel density while the frames are slow and raises it back when they are fast, never above the scene's `dpr`; a number fixes it. The choice is kept in the browser.
- Seven studies open the showcase, one at a time in a viewer: Glass Circuit, Soft Relic, Candy Garden, Chromatic Bloom, the Zdog character and burger reconstructions, and a Nikon F exterior with an illustrative exploded lens. A study driven by `scroll()` has a slider. Each one opens in the playground, where they have their own group, "Studies".
- Docs search: a wider window in three columns. On the left, the contents of the docs; on the right, four drawings that explain GSS: objects in `@scene`, the cascade, space, and how the shader draws the scene. In the middle, before a word is typed: where to start, the pages the latest version added ("New in 0.0.5"), and, once there are enough searches, the ones people make the most; a click on one types it.
- Docs: an icon for each group of the sidebar, before its title: a cube for Shapes and groups, a drop for Colors, a camera for Camera. They take the colour of the title, and the accent on the page being read. On hover, each one moves in its own way: the arrow drops into the tray, the camera's shutter closes, a dot rides the easing curve. The brand page shows all of them and offers each one as an SVG file.

### Changed

- A scene that does not move draws nothing until something changes: the mouse over an object with `:hover`, a variable set from the page, an image that arrives, the size of the canvas. The image stays on screen and the GPU rests, instead of drawing the same frame 60 or 120 times a second. A scene that moves draws every frame, as before; the performance panel, while open, too.
- Scenes with many objects draw much faster, with the same image: the shader groups the objects by where they are, whatever the groups of the code, and skips those far from each point. In the bench, a scene of 82 objects went from 75 ms to under 20 ms a frame, a field of 64 tufts of grass from 26 ms to 5 ms.
- Docs: every page of the reference is shorter and cut into parts, like the reference of a popular language: a lead of three sentences at most, a table of its values, a paragraph, then its examples, each under a heading with a sentence that says what it shows. "On this page" lists them, and the code in the text shows as code. "Embedding a scene" and "Set variables from JavaScript" have chapters.
- Docs navigation: "light (sun)" and "light (point)" instead of two "light"; Colors is split into Colors, Color functions, and Gradients and noise; Selectors into Selectors, Combinators, and Pseudo-classes. The examples of the reference have telling names, in the docs and in the Examples menu of the playground.
- Showcase: the note under "On your site" no longer says GSS has no transparency: a transparent object shows the scene behind it, not the page, so the scene still takes the background of the page.
- Docs: a callout under `element()` and `texture` says how to see `element()` today: behind `chrome://flags/#canvas-draw-element` in Chromium, or on a site with the HTML-in-Canvas origin trial and its token, until the trial ends on October 20, 2026.

### Fixed

- Docs search: every page is found again, `opacity`, `shadows`, `fog`, `mask-image` and the point light included, and a result lands on what it found: an example, the table of values or a chapter, not the top of the page. A link to a part of a page works before the page script runs.

## [0.0.4] — 2026-10-03

### Added

- Nesting, like CSS: a rule holds rules, and `&` stands for the selector around it: `#g { cube { &:hover { color: white; } } > sphere { … } }`. A nested selector without `&` is a descendant (`cube` is `#g cube`), `&` works inside `:has()` and `:not()`, and a `@media` can go inside a rule. Autocompletion and the VS Code grammar know nested rules.
- `transform-origin`, like CSS: the point an object turns and scales around. Keywords and percentages on the box of the object (`left`, `top right`, `0% 100%`), or a point from its center like `translate` (`transform-origin: 0 0.5 0`), then z. Animatable, and on groups with numbers.
- `@property` and `setProperty()`: a variable registered like CSS (`syntax`, `inherits`, `initial-value`; numbers, angles, percentages, colors) is set from the page without compiling again: `scene.setProperty("--lift", "2")`, `getPropertyValue()`, `removeProperty()`, on what `mount()` returns and on `<gss-scene>`. It goes wherever a value reaches the shader: transforms, colors, the sizes of the shapes, the numbers of a gradient, materials, the floor, the ambient light, the sun, `camera-target`, `blend`, the motion path and filters (a `"<length>"` in px for `blur()` and `bloom()`), alone or inside `calc()`, the math functions and the color functions (`hsl(var(--hue) 80% 60%)`, `color-mix()`…), which the GPU then computes at every frame.
- Docs: "Set variables from JavaScript", a page on `setProperty()`, `getPropertyValue()` and `removeProperty()` with `mount()`, `mountAsync()` and `<gss-scene>` (whose `scene` exists once it fires `load`), the values each syntax takes, and a live demo where a slider moves a sphere. `@property` links to it, and lists every property a variable can go in, `fog` and `transform-origin` included.
- Animated gradients: a gradient in `color` changes into another gradient of the same kind in `@keyframes`, on `:hover` and `:active` (with `transition`), its angle, center, stop positions and colors each moving on their own. Through a variable, like a registered `@property`: `linear-gradient(var(--angle), …)` turns when `@keyframes` changes `--angle`.
- The scene plays an animation: `scene { animation: … }` animates `background`, a color or a gradient, directly or through the scene's variables, on time or with `scroll()` and `view()`. With `@scene { }` and `floor: none`, the scene becomes a flat, moving image.
- `noise()`, wherever a gradient goes: colors placed by a smooth 3D noise, like SVG `feTurbulence`: `color: noise(4 3, #1a1d2b, #3a7bff 60%, #ffffff)`. A scale, octaves, `turbulence` for sharp creases, `seed`, and `at` to move it. On an object, the noise is cut in its own space; in the background, it follows the view. It animates like a gradient: animate `at` and it drifts.
- Layers of background, like CSS: `background: noise(…), linear-gradient(…), #102040` puts its layers over each other, the first on top. Their colors can be transparent (`transparent`, `#rrggbbaa`, `rgb(… / 50%)`, `color-mix()` under 100%), and `background-blend-mode` blends them with the 16 modes of CSS. Each layer animates like a gradient.
- `mask-image` cuts holes in an object, like a CSS mask: a gradient or a `noise()` read on the object (from the front, or in 3D for `noise()`), with transparent colors. Where it covers less than half, the surface is not there: the eye sees the inside of the object and what is behind it, in the reflections too, and the mouse goes through the holes. `mask-mode: luminance` reads its brightness. It animates like a gradient in `color`: moving the stops of a `noise()` dissolves the object.
- `displace(<image>, <map>, <amount>)` moves an image by a map, like SVG `feDisplacementMap`, wherever a gradient goes (the color of an object or a material, the background and its layers, `mask-image`): red moves the image to the right and green down, by a share of its size, and a `noise()` map gives each channel a noise of its own, like `feTurbulence`. Stripes moved by a turbulence make marble, a mask gets ragged edges, and animating the map makes the image flow.
- `opacity`, like CSS: an object covers what is behind it as much as its opacity, a number or a percentage. Behind it, the eye sees its back face, what is inside it and what is behind it; on a group, it multiplies into each object. It animates, changes on `:hover` and is set from JavaScript. With shadows, the light goes through it like through stained glass.
- Transparent colors on objects: `color: rgb(255 0 0 / 50%)`, `#ff000080`, `transparent`, or a gradient with transparent stops make the object transparent, like `opacity`; `filter: opacity()` too, on objects and groups.
- Several lights, and colored lights: `@scene { light#bulb; }` adds a point of light, placed like an object (`translate`, its groups, animations, a motion path) and set with `color` and the new `intensity`; it changes on `:hover` through its group. The sun takes a color and an intensity (`light: -45deg 54.7deg #ffd27a 0.8`), `light: none` turns it off, and the scene can animate it. `ambient` takes a color: `ambient: 0.2 #9db4ff`.
- Shadows: `scene { shadows: soft; }` lets the objects cast shadows on the floor and on each other, from the sun and from every light of `@scene`, with a penumbra (`soft`) or sharp (`hard`); `none` by default. The holes of `mask-image` let the light through. The reflections show the objects without shadows.
- `fog` on the scene: `fog: 6 18` fades each object into the background behind it, from 6 to 18 units away from the camera; with a color, `fog: #dfe7ef 4 16`, the background becomes the fog too. Animatable with the scene's animation and its variables, and readable from `@property` variables. Off by default.
- `texture: element(#card)`: a live image of an HTML element on an object, like CSS `element()`, drawn by the browser with the page's CSS and fonts, and shown again each time it changes. The element goes inside `<gss-scene>`, or inside the canvas given to `mount()`. Chromium only for now (HTML-in-Canvas); elsewhere the object keeps its color. A scene with an element is drawn with WebGL2. The docs have an `element()` page, and their examples can carry the HTML they show. The playground has an `html` tab for the elements of the scene, and a share link carries them.

### Fixed

- A value computed by `calc()` or `sibling-index()` that goes out of its range is clamped to it, like CSS, instead of being an error: `color-mix(in oklab, #ff5a36, #3a7bff calc(sibling-index() * 40% - 20%))` holds the last copies at 100%. The same goes for filter amounts, the x of `cubic-bezier()`, a transition duration, `animation-iteration-count`, `blend`, `ambient`, `corner-radius`, the radii of a cone, the frost of `glass()` and `dpr`. A value written as is outside its range is still an error.

## [0.0.3] — 2026-10-02

### Changed

- The screen is no longer mirrored: +x is on the right, like CSS, and `rotate-y` and `rotate-z` now turn like CSS `rotateY()` and `rotate()` (clockwise). Gradients, conic gradients, textures, `path` and `prism` shapes and motion paths now appear as written, no longer flipped left to right. The default `light` becomes `-45deg 54.7deg`, so a scene without `light` is lit as before, from the upper left. Every scene, example and showcase of the site was mirrored to keep its look. **A scene written for an earlier version** shows mirrored: negate the x of `translate` and `camera-target`, the angles of `rotate-y` and `rotate-z`, and the first angle of `light` and `camera-angle`.

- A misspelled function inside math names the function it was meant to be: `Unknown function slibling-index(): did you mean sibling-index()?`
- The playground's performance panel is closed by default; the `perf` button or Alt+P opens it, and that choice is remembered.

### Added

- `conic-gradient()` and `repeating-conic-gradient()`, like CSS: `from <angle>`, `at <position>`, stops placed with angles or percentages; in backgrounds, on objects and in materials.

- Motion path, like CSS: `offset-path: path("…")` or `ray(<angle>)`, `offset-distance` (a length or a percentage, animatable with `@keyframes`, `:hover` and the scroll) and `offset-rotate` (`auto`, `reverse`, an angle). The path stands in the object's xy plane like the `path` shape, so a tube and an object following it share the same `d`.

- Scroll-driven animations, like CSS: `animation-timeline: scroll()` (the scroll of the page or of the nearest scroll container, any axis) and `view()` (the scene crossing the screen). The progress of the scroll replaces the time; iterations, direction and easing still apply. In the playground and the docs, a slider over the scene stands in for the scroll.

- `:active`, like CSS: the object pressed with the mouse or a finger, until the button goes up. It goes wherever `:hover` goes (groups, combinators, `:has()`), is drawn over the hovered state, and takes `transition`. On WebGL2 and WebGPU; scenes without `:active` compile as before.

- `currentColor`: the object's own color wherever a color is expected, like CSS: in `color-mix()`, `light-dark()`, gradient stops, a material (`metal(currentColor, 0.2)` follows the animated or hovered color) and variables, read with the color of the object that uses them.

- `:not(<selector list>)`, like CSS: any selector inside, complex ones, `:nth-child()` and `:has()` included (`cube:not(#g cube)`, `group:not(:has(sphere))`); it weighs like its most specific selector. Resolved at compile time.

- Structural pseudo-classes, like CSS: `:nth-child(An+B [of S])`, `:nth-last-child()`, `:nth-of-type()`, `:nth-last-of-type()` (`odd`, `even`, `3`, `2n+1`, `-n+3`…), and `:first-child`, `:last-child`, `:only-child`, `:first-of-type`, `:last-of-type`, `:only-of-type`. The copies of a `* n` are siblings one by one, so `:nth-child()` counts like `sibling-index()`: in `@scene { cube * 4; sphere; }`, `cube:nth-child(odd)` is cubes 1 and 3. Resolved at compile time, at no rendering cost.

- Performance panel for WebGPU: FPS, frame/CPU percentiles, resolution and shader/pipeline preparation time, plus asynchronous GPU timestamps spanning picking, scene rendering and post-processing when `timestamp-query` is available. Profiling remains lazy until the panel is opened and works with automatic backend selection.

- Dual GLSL/WGSL compilation for scenes, filter passes and media variants. Native WebGPU runtime with textures, camera controls, animation, hover picking and post-processing; `mountAsync()` selects WebGPU with a WebGL2 fallback or forces either backend. Existing synchronous APIs retain WebGL2. The playground includes backend selection and a WGSL tab; `<gss-scene backend="auto">` opts into WebGPU.

- The editor of the playground and of the reference suggests property names while you type, only those the rule can take (the scene, a shape, a group, `:hover`, a face, a `@keyframes` frame), each with its syntax and description.

- Every error of a compile is reported at once, not only the first: after an error, the tokenizer and the parser go on reading (to the end of the declaration, the element or the rule), then, once the text reads, every wrong property, value, variable or object is reported. The playground and every "Try it" underline each one and write it under its line, the status bar counts them, and the Vite plugin lists each error with its line and column. One error is still thrown as a `GssError`; several as a `GssErrors`, a `GssError` whose `errors` lists them in the order of the text.

### Fixed

- A scene with a `filter` on an object and a metal, jelly or glass material no longer fails to compile on WebGL2 (it rendered on WebGPU only). Reflections still show the object's filters.

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
