---
name: GSS — Distance field
version: 0.1.0
updated: 2026-09-28
references:
  - design/reference/png/01-home.png
  - design/reference/png/02-playground.png
  - design/reference/png/03-docs.png
  - design/reference/png/04-marks.png
colors:
  void: "#0A0A0C" # page background, render viewport
  surface: "#111114" # editor, code blocks, secondary panels
  raised: "#16161B" # active tab, selected nav item, hovered row
  line: "#202026" # hairline dividers between regions
  isoline: "#2A2A31" # control borders, inactive outlines
  bone: "#E8E6E1" # primary text, the braces of the logo
  ash: "#A09E99" # secondary text, nav links, lead paragraphs
  dim: "#807F88" # labels, captions, metadata (≥ 4.5:1 on every surface)
  signal: "#FF5A36" # the one accent: primary action, active state, the dot
  signal-hover: "#FF7A5C"
  error-text: "#FF9A80" # error message text, on signal at 10% opacity
syntax: # same values as src/styles/gss-code.css (.gss-dark)
  text: "#e6e6e6"
  comment: "#6e6e7a"
  at-rule: "#ff7aa8"
  selector: "#7cb4ff"
  id: "#d29bff"
  property: "#6fe0cf"
  number: "#ffb86b"
  unit: "#ffcf99"
  color: "#ff9a6b"
  function: "#d29bff"
  keyword: "#a8e070"
  punct: "#8a8a96"
  string: "#c3e88d"
typography:
  display: "Martian Mono, ui-monospace, monospace" # 600–800
  body: "Geist, system-ui, sans-serif" # 400–600
  code: "JetBrains Mono, ui-monospace, monospace" # 400–500
radius:
  control: 2px
  panel: 0px
spacing:
  unit: 4px
  scale: [4, 8, 12, 16, 24, 32, 40, 56, 96]
---

# GSS design language — "Distance field"

GSS compiles style sheets into a raymarching shader. Everything on screen is measured
by a **signed distance field**: for each point, how far is the nearest surface?
The visual identity makes that idea visible. Its signature is the **isoline**, the
concentric contour lines of a distance field, radiating from the `{ ● }` mark.

This file is the source of truth for every GSS surface: the playground, the docs,
the landing page, the README, social cards and slides. Humans and coding agents
read it before designing or building anything for GSS.

Reference renders live in `design/reference/`. The `.html` files open in a browser
and the `.png` files are 2× captures of them.

| File            | Shows                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `01-home`       | Landing page: hero, three pillars, palette and type                         |
| `02-playground` | Editor + viewport, `view: distance`, a located error, status bar            |
| `03-docs`       | A property page (`material`): nav, value table, example + render, cost note |
| `04-marks`      | Primary mark, mark on signal, wordmark, app icon and favicons, social card  |

## 1. Visual theme and atmosphere

- **An instrument, not a toy.** Dark, precise, quiet. It feels like a shader editor,
  an oscilloscope or a spec sheet printed on black. Never "gamer", neon or glossy.
- **The render is the hero.** Chrome recedes into near-black; the only saturated
  colour on screen is the orange dot and whatever the user's scene draws.
- **Monospace carries the voice.** Headlines, navigation and labels are set in
  monospace, like code. Only running prose switches to a sans.
- **Honest numbers.** Show real figures: compile time, GLSL line count, fps, error
  line:column. Never decorative stats.
- **Lowercase UI.** Buttons, tabs and nav are lowercase, like CSS keywords
  (`open the playground →`, `share`, `examples ▾`). Headlines use sentence case.

## 2. Colour palette and roles

The ground is a four-step ladder of near-blacks: **void** (#0A0A0C) for the page and
the render, **surface** (#111114) for the editor and code, **raised** (#16161B) for
active or selected items, and **line** (#202026) for dividers. Colour appears only
where it means something.

| Token        | Hex     | Role                                                                     |
| ------------ | ------- | ------------------------------------------------------------------------ |
| void         | #0A0A0C | Page background, 3D viewport, default `scene { background }` of examples |
| surface      | #111114 | Code editor, code blocks, secondary bands                                |
| raised       | #16161B | Active tab, selected nav item, hovered row                               |
| line         | #202026 | 1px dividers between regions (header, columns, footer)                   |
| isoline      | #2A2A31 | Borders of secondary buttons and chips                                   |
| bone         | #E8E6E1 | Primary text, logo braces, headlines                                     |
| ash          | #A09E99 | Secondary text: lead paragraphs, nav links                               |
| dim          | #807F88 | Labels, captions, metadata, section eyebrows                             |
| **signal**   | #FF5A36 | The one accent: primary button, active state, the dot, links             |
| signal-hover | #FF7A5C | Hover state of signal elements                                           |
| error-text   | #FF9A80 | Error messages, on `signal` at 10% alpha with a 2px signal left rule     |

**Rules**

- **One accent.** `signal` is the only UI accent. No second brand colour, no
  gradients in the chrome. Syntax colours live only inside code.
- **Signal is scarce.** At most one filled signal element per view (the primary
  action). Everything else uses signal as a 1px outline or text.
- **Text on signal is void**, never white (6.4:1).
- Text must reach 4.5:1 on the surface it sits on. `dim` passes on every surface;
  the darker #6E6E7A is only for code comments and decorative isoline labels.
- Syntax highlighting uses the existing `.gss-dark` palette in
  `src/styles/gss-code.css` (listed in the front matter). Don't invent a new one.

## 3. Typography

| Role                    | Face           | Weight  | Size / line height | Tracking |
| ----------------------- | -------------- | ------- | ------------------ | -------- |
| Display (hero)          | Martian Mono   | 800     | 64–72px / 1.02     | −0.05em  |
| H1 (doc page)           | Martian Mono   | 800     | 48–52px / 1.05     | −0.05em  |
| H2, card title          | Martian Mono   | 600     | 18–24px / 1.2      | −0.03em  |
| Lead paragraph          | Geist          | 400     | 18–19px / 1.5      | 0        |
| Body                    | Geist          | 400     | 15–16px / 1.55     | 0        |
| UI (buttons, tabs, nav) | JetBrains Mono | 400–500 | 13–14px            | 0        |
| Code                    | JetBrains Mono | 400     | 13px / 1.6–1.75    | 0        |
| Eyebrow / label         | JetBrains Mono | 400     | 11–12px, UPPERCASE | +0.08em  |

- **Three faces, three jobs**: Martian Mono speaks (titles), Geist explains (prose),
  JetBrains Mono does the work (code, UI, numbers). Don't swap them.
- Inline code inside prose is JetBrains Mono in `bone`, or in its syntax colour when
  it names a property (`material` in #6fe0cf).
- Numbers in UI (fps, ms, line:column) are always monospace.
- All three faces are free (Google Fonts / Fontsource).

## 4. The mark

- **Primary mark: `{ ● }`**, bone braces and a signal dot. In code it is the logo
  scene `src/playground/logo.gss`. Keep them in sync.
- **Wordmark: `gss.`** in Martian Mono 800, lowercase, with the period in signal.
- **Header lockup**: the small `{●}` then `gss` in Martian Mono 600, 15px.
- **App icon / favicon**: the signal dot on a `raised` rounded square (radius ~22%),
  with two faint isoline rings at 64px and above. At 16px, the dot only.
- **On signal**: void braces and a void dot on a signal field. No other colourways.
- Never outline, gradient, rotate or re-colour the braces; never add a drop shadow.

## 5. The isoline motif

The motif is the distance field around the dot: concentric rings, 1px `bone`
strokes whose opacity falls off with distance (≈ 0.34 → 0.02 over 8–10 rings,
evenly spaced). Optional tiny `d = 0.4` labels in JetBrains Mono 11px.

- Use it **once per view**, behind the hero render or the logo. Never as a tiled
  pattern or a background texture on text.
- The rings are centred on a real object (the dot, a shape), never floating.
- In the product it is a real feature, not decoration: the playground's
  `view: distance` toggle draws the scene's actual isolines.

## 6. Components

**Buttons** (height 44px on touch screens, 34px in the dense desktop toolbar of the playground; radius 2px, JetBrains Mono 13–14px, lowercase)

- _Primary_: signal fill, void text, weight 500. One per view.
- _Secondary_: transparent, 1px `isoline` border, `ash` text; hover → `bone` text.
- _Command chip_: like secondary, holds a shell line (`$ npm i gss-lang`).
- _Signal outline_: 1px signal border and text, for "try it" links in the docs.

**Tabs / segmented control**: a `raised` track with 3px padding; the active tab is
`isoline` fill + `bone` text, inactive tabs are `dim` text (`gss | glsl`).

**Code block**: `surface` fill, 1px `line` border, 16–20px padding, no radius, no
shadow. Line numbers in #3A3A42, 28px gutter.

**Located error**: sits under the faulty line. Background signal at 10%, 2px signal
left rule, `error-text`, prefixed by `line:col` (e.g. `15:3 radius only applies to …`).
The same message appears in the status bar count (`● 1 error`).

**Status bar**: 32px, `line` top border, JetBrains Mono 11px in `dim`:
`● n errors · n objects · glsl n lines · compiled in n ms … 60 fps`.

**Docs value table**: two columns (key in `dim` mono, value in `bone` mono), 1px
`line` rows, no fills. Keys: `value`, `initial`, `applies to`, `animatable`.

**Notes**: a 1px dashed `isoline` box with a mono keyword in signal
(`cost`, `note`, `since`). No coloured fills, no left-border cards.

**Nav (docs)**: mono 13px, section eyebrows in uppercase `dim`; the current page is
`bone` on `raised` with a 2px signal left rule.

**Icons (docs nav)**: one per group of the sidebar, before its title
(`src/docs/nav-icons.ts`). The 16px grid of the chevron, a 1.25 stroke in
`currentColor` with round caps and joins, a face or a part filled at 35%, no
other colour: an icon is `ash` at rest, `bone` on hover or open, signal on the
group being read. On hover each one plays its own short motion, once (the
arrow drops into the tray, the shutter closes), 0.4–0.8s; none with reduced
motion. At the same time a thin signal glint, faded at both ends, runs over its
strokes only, from top left to bottom right, easing in (0.7s); none with
reduced motion. Line drawings of the subject (a cube, a drop, a camera);
Rendering borrows the isoline motif. The brand page shows them all and offers
each as a file.

**Chips on the viewport** (`view: shaded`, `view: distance`): mono 11px,
1px `line` border; active = signal border and text.

## 7. Layout

- Regions are separated by **1px hairlines**, not by cards or shadows. Panels are
  flush and square.
- Page margins 56px on desktop, 16px on mobile. Content blocks use a 4px unit.
- Landing: headline left (≤ 680px), render / isolines right, three pillar columns
  below, divided by hairlines.
- Playground: 52px header, editor docked left (≈ 480px, `surface`), viewport fills
  the rest (`void`), 32px status bar. The hairline between them is a separator: a
  9px hit area (44px to a finger), a grip of three `dim` dots on hover, the line in
  signal while dragged or focused. Folded, the editor is a 12px `surface` rail.
- Docs: three columns: nav 260px, content (max ~720px of text), on-this-page 240px.

## 8. Depth and elevation

Flat. No drop shadows, no blur, no glassmorphism in the UI. Hierarchy comes from the
background ladder (void → surface → raised) and from hairlines. The only depth on
screen is the 3D render itself.

## 9. Motion

- UI transitions are short (120–160ms, ease-out) and only on colour/opacity.
- The render is the only thing that moves continuously. Respect
  `prefers-reduced-motion`: stop auto-rotation and `@keyframes` previews.

## 10. Do and don't

**Do**

- Let the scene carry the colour; keep the chrome near-black.
- Show GSS code next to every render. The language is the product.
- Use real, current numbers and real error messages from the compiler.
- Reuse the syntax palette from `gss-code.css` everywhere code appears.

**Don't**

- Add a second accent, gradients, glows or neon.
- Use rounded "SaaS" cards, pill buttons or drop shadows.
- Use Inter, Roboto or a serif.
- Put the isoline motif behind body text or repeat it on the same screen.
- Mention Three.js as if GSS used it (it doesn't).

## 11. Responsive

- ≥ 1024px: layouts as above.
- < 1024px: playground stacks: viewport on top (16:10), editor below, status bar
  fixed at the bottom. Docs hide the on-this-page column.
- < 640px: hero headline 40px; pillars stack; nav collapses to a `menu` button.
  Touch targets ≥ 44px everywhere.

## 12. Agent prompt guide

When generating any GSS surface:

> Dark, instrument-like UI for GSS (GPU Style Sheets). Background #0A0A0C, panels
> #111114, dividers 1px #202026, text #E8E6E1 / #A09E99 / #807F88. One accent,
> #FF5A36, for the primary action and active states only; text on it is #0A0A0C.
> Titles in Martian Mono 800 with −0.05em tracking, prose in Geist, UI and code in
> JetBrains Mono, UI labels lowercase. Square corners (2px on controls), no shadows,
> no gradients. Code uses the `.gss-dark` syntax palette. The logo is `{ ● }`: bone
> braces, orange dot, optionally surrounded once by fading concentric isolines.

Example scene background for demos: `scene { background: #0a0a0c; }`.
