# ROADMAP — GSS

Liste vivante des prochaines features. Cocher ou déplacer vers **Fait récemment** quand c’est livré.

**Principe :** toute nouvelle feature / entrée doit être ajoutée au **registry** (au bon endroit) **et** à la **doc** (syntaxe, exemple, etc.).

## Déjà dans GSS (29 sept. 2026)

Inventaire de ce que le langage et les outils savent faire aujourd’hui. Le détail de chaque feature est dans le registry (donc dans la doc), le « pourquoi » dans `DECISIONS.md` (colonne *Déc.*).

### Langage

| Feature | Syntaxe | Déc. |
| --- | --- | --- |
| Structure de la scène | `@scene { cube.corner * 4; torus#hero; }`, `;` facultatif entre éléments | 2, 11, 46 |
| Multiplication | `cube * 12` ; ids numérotés : `cube#petal * 12` → `#petal-1` … `#petal-12` | 3 |
| Groupes | `group#g { … }` : transforms et animation appliqués aux enfants, positions relatives | 45, 48 |
| Style de la scène | `scene { floor; background; light; ambient; camera-* }` | 11, 15, 16 |
| Sélecteurs | `<shape>`, `.class`, `#id`, `*`, listes `a, b`, descendant `a b` | 4, 37, 47 |
| Cascade | spécificité (id 10 000, classe 100, tag 1), dernier gagne, `!important` en 2 passes | 4, 38 |
| Animation | `@keyframes` (`from`, `to`, `%`), `animation: nom durée [linear \| ease-in-out] [alternate]`, calculée dans le shader | 21, 22, 23, 24 |
| Calculs | `calc()`, `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()`, `sin()`, `cos()`, `tan()`, `pi`, `e` | 52 |
| Boucles « à la CSS » | `sibling-index()`, `sibling-count()` : chaque copie d’un `* n` a sa valeur | 52 |
| Unités | angles `deg` `rad` `turn` (toujours une unité), durées `s` `ms`, `%` | 9, 17, 20 |
| Fonctions CSS modernes | virgules ou espaces : `metal(#d4af37, 0.2)`, `polygon(0 1, 1 0, -1 0)` | 28 |

### Formes (10)

| Forme | Propriétés propres | Déc. |
| --- | --- | --- |
| `cube` | `size` (1 ou 3 valeurs), `corner-radius` | 14, 36 |
| `sphere` | `radius` | 14 |
| `torus` | `radius`, `thickness` | 14 |
| `cylinder`, `capsule` | `radius`, `height` | 36 |
| `cone` | `radius` (bas, haut), `height` | 36 |
| `plane` | `size` (1 ou 2 valeurs) | 40 |
| `path` | tube le long d’un chemin SVG : `d: path("M… C… A…")`, `stroke-width`, `view-box` | 35, 49 |
| `prism` | contour rempli puis épaissi : `d: polygon(…)` ou `d: path(…)` (trous en pair-impair), `depth`, `view-box` | 41, 50 |
| `group` | ne dessine rien, contient les autres | 45 |

Toutes centrées sur leur origine, dimensions en tailles complètes (déc. 36).

### Propriétés des objets

| Famille | Propriétés | Déc. |
| --- | --- | --- |
| Transformations | `translate`, `rotate-x`, `rotate-y`, `rotate-z`, `scale` (uniforme) | 13 |
| Apparence | `color`, `material` | 26 |
| Combinaisons | `operation: union \| subtract \| intersect`, `blend` (union lisse) | 18, 19 |
| Animation | `animation` ; animables : `translate`, `rotate-*`, `scale`, `color` | 24 |

### Matériaux

| Matériau | Syntaxe | Déc. |
| --- | --- | --- |
| Mat | `matte([couleur])` (défaut) | 27 |
| Métal | `metal([couleur,] [rugosité])` ; raccourcis `gold`, `chrome` | 27, 29 |
| Gelée | `jelly([couleur,] [densité])` ; raccourci `jelly` | 27 |
| Verre | `glass([teinte,] [indice] [, frosted \| wavy \| hammered \| blurred givre])` ; raccourcis `glass`, `ice` | 27, 31, 32 |

### Scène

| Propriété | Rôle |
| --- | --- |
| `floor` | couleur du sol, ou `none` |
| `background` | couleur du fond |
| `light`, `ambient` | direction du soleil, lumière ambiante |
| `camera-target`, `camera-distance`, `camera-angle`, `camera-spin` | caméra (orbite à la souris, rotation auto en durée) |

### Rendu

| Feature | Déc. |
| --- | --- |
| Tout compilé en **un seul fragment shader** GLSL, raymarching de SDF, WebGL2, sans Three.js | 1, 5, 30 |
| Un reflet (1 rebond), réfraction du verre (entrée + sortie), givre procédural | 29, 31 |
| Pas de textures : tout est calculé | 1 |

### Outils

| Outil | Où | Déc. |
| --- | --- | --- |
| Page d’accueil | `/` (`index.html`), démo live, chiffres lus dans le registry | 51 |
| Playground | `playground.html` : CodeMirror, code dans l’URL (partage), exemples, onglet GLSL | 34 |
| Barre d’état | `ok · 3 objects · glsl 412 lines · compiled in 4 ms · 60 fps` | 42 |
| Erreurs situées | soulignées, et écrites sous leur ligne (`15:3 …`) | 43 |
| Doc générée | `docs.html`, une page par entrée, depuis le registry, « Try it » live partout | 12, 39, 44 |
| Export Shadertoy | bouton `→ shadertoy` du playground | – |
| Formateur | `formatGss`, `Shift+Alt+F` dans le playground | 33 |
| Extension VS Code / Cursor | coloration, formateur, icône des fichiers `.gss` | 33 |
| Design | `DESIGN.md` « Distance field », tokens `src/styles/tokens.css` | – |
| Tests | Vitest (CPU) + compilation GPU de chaque exemple du registry (Chromium) | 12, 25 |

## Ordre de priorité

1. [x] Boucles : **option B retenue** (décision 52) : `* n` + `calc(sibling-index())`, comme en CSS. `@for` / `@each` plus tard, seulement pour changer de forme à chaque tour ou parcourir une liste
2. [ ] `var()` (+ `calc()` ✅ décision 52, avec `min()`, `max()`, `clamp()`, `abs()`, `sqrt()`, `pow()`, `sin()`, `cos()`, `tan()`)
3. [ ] Couleurs fonctionnelles
4. [ ] Contrôles d’animation (delay / iteration-count / reverse)
5. [ ] `@media` + `prefers-reduced-motion`
6. [ ] Sélecteurs / nesting (combinateurs `>` `+` `~`, etc.)
7. [ ] `:hover` + `transition`
8. [ ] `transform-origin`
9. [ ] Fog
10. [x] `sibling-index()` + `sibling-count()` (décision 52)
11. [ ] Motion path

## Plus tard

### Produit / surface

- [x] Landing page (`/`, décision 51)
- [ ] README racine
- [ ] Rename dossier/package public `csl` → `gss` (quand prêt)
- [ ] Remote git / publication npm (package encore `0.0.0`)

### Playground

- [ ] `view: distance` / `view: shaded` (promis dans le design, absents)

### Formes / rendu

- [x] Remplissage plein d’un path : `prism` avec `d: path(…)`, trous compris (décision 50)
- [ ] `lathe` (mentionné comme forme future)

### Backend

- [ ] WGSL / WebGPU (`"later"` dans les docs)

### Qualité / DX

- [ ] Compilation multi-erreurs (aujourd’hui s’arrête à la première)
- [x] Documenter `floor: none` dans le registry
- [x] Mettre à jour `DECISIONS.md` (groupes : décisions 45 à 48)
- [ ] Aligner highlighting TextMate extension vs `classifyGss` web

## Hors scope

- GLTF, mesh classique — volontairement hors scope pour l’instant
- Scale non uniforme (hors scope SDF exactes aujourd’hui — voir En discussion)

## En discussion

- Scale non uniforme : garder le scope SDF exactes, ou accepter une approximation ?
- Timing d’un rename public `csl` → `gss` (breaking pour consumers éventuels).

## Fait récemment

- Groupes styles / transforms
- Path arcs SVG
- Design Distance field
- Prism rempli avec `path()` (décision 50)
- Page d’accueil, playground → `playground.html` (décision 51)
- `calc()`, `sibling-index()`, `sibling-count()` et fonctions mathématiques CSS (décision 52)


## Fit CSS → GSS (0–1)

Score d’adéquation CSS → GSS (langage style → shader SDF / scène). **1.0** = déjà dans GSS ou priorité directe du roadmap (`@for`, `var`, `calc`, couleurs, anim delay, `@media`, `:hover`, etc.). **0.8–0.9** = fort mapping compile-time ou shader/scène (`transform-origin`, `sibling-index`, nesting, `:nth-child`, `@import`, easings, `color-mix`, trig dans `calc`, `opacity` objet, `filter` post, fog-like, motion path, `@property` plus tard). **0.5–0.7** = partiel / possible plus tard (layers, `@supports`, `@container`, `random`, `:is`/`:where`/`:not`, `@scope`, mixins/`@function`, `backdrop-filter` post, mask/CSG-adjacent, scroll timelines reframés…). **0.2–0.4** = faible / stretch. **0.0–0.1** = mauvais fit (flex/grid/box flow, fonts/texte, scroll chrome, forms, page-break, float, `z-index` painter, view transitions DOM, shadow DOM, counters/listes, `@charset`/`@namespace`, la plupart des `-moz-`/`-webkit-` UI).

### Properties by theme

#### Animation & transitions

| Feature | Score | Note courte |
| --- | ---: | --- |
| `animation` (shorthand) | 1.0 | Déjà en GSS |
| `animation-name` | 1.0 | Lié à `@keyframes` |
| `animation-duration` | 1.0 | Priorité contrôles anim |
| `animation-timing-function` | 0.9 | Easings → courbe compacte |
| `animation-delay` | 1.0 | Priorité roadmap #4 |
| `animation-iteration-count` | 1.0 | Priorité roadmap #4 |
| `animation-direction` | 1.0 | reverse prévu |
| `animation-fill-mode` | 0.8 | Mappe au hold fin/début |
| `animation-play-state` | 0.7 | Pause runtime possible |
| `animation-composition` | 0.5 | Blend de tracks plus tard |
| `animation-timeline` | 0.5 | Si reframé (temps/scroll scène) |
| `animation-range` / `-start` / `-end` | 0.5 | Idem timelines |
| `transition` (shorthand) | 1.0 | Avec `:hover` (prio #7) |
| `transition-property` | 1.0 | Idem |
| `transition-duration` | 1.0 | Idem |
| `transition-delay` | 1.0 | Idem |
| `transition-timing-function` | 0.9 | Easings |
| `transition-behavior` | 0.4 | Peu pertinent SDF |
| `timeline-scope` | 0.4 | DOM-centric |
| `interpolate-size` | 0.2 | Box layout |

#### Transforms & motion path

| Feature | Score | Note courte |
| --- | ---: | --- |
| `transform` | 0.9 | Déjà décomposé (translate/rotate/scale) |
| `transform-origin` | 1.0 | Priorité roadmap #8 |
| `transform-style` | 0.6 | Groupes 3D déjà ; preserve-3d limité |
| `transform-box` | 0.3 | Box CSS |
| `translate` | 1.0 | Déjà en GSS |
| `rotate` | 0.9 | Proche `rotate-x/y/z` |
| `scale` | 1.0 | Déjà (uniforme SDF) |
| `perspective` / `perspective-origin` | 0.7 | Caméra scène plutôt |
| `backface-visibility` | 0.3 | Raster faces |
| `offset` / `offset-path` / `offset-distance` | 0.9 | Motion path prio #11 |
| `offset-rotate` / `offset-anchor` / `offset-position` | 0.8 | Suite motion path |

#### Colors, opacity, compositing

| Feature | Score | Note courte |
| --- | ---: | --- |
| `color` | 1.0 | Déjà en GSS |
| `opacity` | 0.85 | Objet / volume avec soin |
| `color-scheme` | 0.4 | UI chrome |
| `print-color-adjust` / `forced-color-adjust` | 0.1 | Print / a11y UA |
| `dynamic-range-limit` | 0.2 | HDR display |
| `mix-blend-mode` | 0.5 | Post / blend SDF limité |
| `background-blend-mode` | 0.3 | Layers 2D |
| `isolation` | 0.3 | Stacking context |

#### Backgrounds & borders (surface / décor)

| Feature | Score | Note courte |
| --- | ---: | --- |
| `background` (shorthand) | 0.6 | → `background` scène / mat |
| `background-color` | 0.7 | Scène déjà |
| `background-image` | 0.4 | Textures plus tard |
| `background-position` / `-size` / `-repeat` / `-clip` / `-origin` / `-attachment` | 0.2 | Box painting |
| `background-position-x/y` / `background-repeat-x/y` | 0.1 | Idem |
| `border` (+ longhands color/style/width/sides) | 0.2 | Box model |
| `border-radius` (+ corners) | 0.7 | Proche `corner-radius` cube |
| `border-image` (+ longhands) | 0.2 | 2D image border |
| `border-collapse` / `border-spacing` | 0.0 | Tables |
| `border-block*` / `border-inline*` / logical radii | 0.1 | Logical box |
| `border-shape` / `corner-shape` (+ corner-*-shape) | 0.5 | Forme coin → SDF stretch |
| `box-shadow` | 0.5 | Soft shadow / AO-like |
| `box-decoration-break` | 0.1 | Fragmentation |
| `outline` (+ longhands) | 0.1 | Focus UI |
| `-webkit-border-before` | 0.0 | Vendor UI |

#### Filter, mask, clip

| Feature | Score | Note courte |
| --- | ---: | --- |
| `filter` | 0.85 | Post-process shader |
| fog (GSS / atmosphère, hors propriété CSS stricte) | 1.0 | Priorité roadmap #9 ; fog-like post |
| `backdrop-filter` | 0.6 | Post derrière objet |
| `mask` (+ clip/composite/image/mode/origin/position/repeat/size/type) | 0.55 | CSG / alpha mask adjacent |
| `mask-border` (+ longhands) | 0.2 | Box mask image |
| `-webkit-mask-*` | 0.1 | Vendor |
| `clip-path` | 0.6 | Découpe → SDF / CSG |
| `clip` / `clip-rule` | 0.3 | Legacy / SVG rule |
| `-webkit-box-reflect` | 0.3 | Mirror stretch |

#### Box model, display, sizing, position, float, z

| Feature | Score | Note courte |
| --- | ---: | --- |
| `display` | 0.1 | Box tree |
| `width` / `height` / `min-*` / `max-*` | 0.3 | Taille objet ≠ box ; `height` GSS = forme |
| `block-size` / `inline-size` / logical min/max | 0.1 | Logical box |
| `aspect-ratio` | 0.4 | Contrainte taille forme |
| `box-sizing` | 0.0 | Box model |
| `margin` (+ longhands / logical / trim) | 0.1 | Flow |
| `padding` (+ longhands / logical) | 0.1 | Flow |
| `inset` / `top` / `right` / `bottom` / `left` (+ logical) | 0.2 | Positionnement CSS |
| `position` | 0.2 | Containing block |
| `position-anchor` / `position-area` / `position-try*` / `position-visibility` | 0.2 | Anchor positioning DOM |
| `anchor-name` / `anchor-scope` | 0.2 | Idem |
| `float` / `clear` | 0.0 | Flow |
| `z-index` | 0.1 | Painter order ≠ SDF |
| `visibility` / `content-visibility` / `overlay` | 0.3 | Show/hide objet faible |
| `overflow` (+ x/y/block/inline/clip-margin/wrap) | 0.1 | Scrollport |
| `overflow-anchor` | 0.0 | Scroll anchoring |
| `resize` | 0.0 | UI |
| `contain` / `contain-intrinsic-*` | 0.2 | Perf layout |
| `container` / `container-name` / `container-type` | 0.5 | Avec `@container` |

#### Flexbox, grid, alignment, multi-column, gaps

| Feature | Score | Note courte |
| --- | ---: | --- |
| `flex` / `flex-*` / `order` | 0.0 | Layout 1D |
| `grid` / `grid-*` | 0.0 | Layout 2D |
| `place-*` / `align-*` / `justify-*` | 0.1 | Box alignment |
| `gap` / `row-gap` / `column-gap` | 0.2 | Espacement layout |
| `columns` / `column-*` / `column-rule*` / `column-wrap` / `column-height` | 0.0 | Multi-col |
| `row-rule*` / `rule*` | 0.0 | Gap decorations |
| Legacy `box-*` (flexbox old) | 0.0 | Deprecated |

#### Fonts, text, lists, counters, ruby, math

| Feature | Score | Note courte |
| --- | ---: | --- |
| `font` / `font-*` (family, size, weight, style, variant*, stretch, width, kerning, …) | 0.05 | Texte hors scope SDF |
| `font-smooth` / `font-synthesis*` / `font-palette` / `font-language-override` / `font-optical-sizing` / `font-size-adjust` / `font-variation-settings` / `font-feature-settings` | 0.05 | Idem |
| `letter-spacing` / `word-spacing` / `word-break` / `line-break` / `line-height` / `line-clamp` / `line-height-step` | 0.05 | Text layout |
| `text-align*` / `text-indent` / `text-justify` / `text-transform` / `text-wrap*` / `text-overflow` / `text-orientation` / `text-combine-upright` / `text-autospace` / `text-spacing-trim` / `text-fit` / `text-size-adjust` / `text-box*` | 0.05 | Idem |
| `text-decoration*` / `text-emphasis*` / `text-underline-*` / `text-shadow` / `text-rendering` / `text-anchor` | 0.1 | Déco texte |
| `-webkit-text-fill-color` / `-webkit-text-stroke*` / `-webkit-text-security` | 0.0 | Vendor text |
| `white-space` / `white-space-collapse` / `tab-size` / `hyphens` / `hyphenate-*` / `hanging-punctuation` / `quotes` / `unicode-bidi` / `direction` / `writing-mode` | 0.05 | Texte / bidi |
| `vertical-align` / `initial-letter` | 0.05 | Inline layout |
| `list-style*` | 0.0 | Listes |
| `counter-increment` / `counter-reset` / `counter-set` | 0.1 | Counters |
| `ruby-*` / `math-*` | 0.0 | Ruby / MathML |
| `speak-as` | 0.0 | Aural |

#### Images, object-fit, SVG presentation

| Feature | Score | Note courte |
| --- | ---: | --- |
| `object-fit` / `object-position` / `object-view-box` | 0.2 | Replaced content |
| `image-orientation` / `image-rendering` / `image-resolution` | 0.3 | Texture sampling faible |
| `fill` / `fill-opacity` / `fill-rule` | 0.5 | Path fill / extrusion |
| `stroke` / `stroke-*` | 0.7 | Proche `stroke-width` path GSS |
| `paint-order` / `vector-effect` / `shape-rendering` | 0.3 | SVG paint |
| `marker` / `marker-*` | 0.2 | SVG markers |
| `stop-color` / `stop-opacity` | 0.4 | Gradients stops |
| `flood-color` / `flood-opacity` / `lighting-color` / `color-interpolation*` | 0.3 | SVG filters |
| `cx` / `cy` / `r` / `rx` / `ry` / `x` / `y` / `d` | 0.6 | Géométrie ; `d` déjà path |
| `path-length` | 0.5 | Motion / dash |

#### Shapes (float area) & tables & fragmentation & pages

| Feature | Score | Note courte |
| --- | ---: | --- |
| `shape-outside` / `shape-margin` / `shape-image-threshold` | 0.2 | Float shapes |
| `table-layout` / `caption-side` / `empty-cells` / `border-collapse` | 0.0 | Tables |
| `break-before` / `break-after` / `break-inside` | 0.0 | Fragmentation |
| `page-break-*` / `page` / `orphans` / `widows` | 0.0 | Pages |
| `box-decoration-break` | 0.1 | Fragments |

#### Scroll, scrollbars, overscroll, snap, scroll-driven

| Feature | Score | Note courte |
| --- | ---: | --- |
| `scroll-behavior` / `scroll-margin*` / `scroll-padding*` | 0.1 | Scroll UI |
| `scroll-snap-*` / `scroll-initial-target` / `scroll-target-group` / `scroll-marker-group` | 0.1 | Snap chrome |
| `scrollbar-*` | 0.0 | Scrollbar styling |
| `overscroll-behavior*` | 0.0 | Overscroll |
| `scroll-timeline*` / `view-timeline*` | 0.5 | Timelines reframées scène |
| `touch-action` / `-webkit-touch-callout` / `-webkit-tap-highlight-color` | 0.0 | Input chrome |

#### UI, forms, caret, cursor, appearance, interactivity

| Feature | Score | Note courte |
| --- | ---: | --- |
| `appearance` | 0.0 | Widget UA |
| `cursor` | 0.1 | Pointer host |
| `caret` / `caret-*` | 0.0 | Forms |
| `accent-color` | 0.1 | Form controls |
| `pointer-events` | 0.4 | Pick 3D limité |
| `user-select` / `user-modify` / `-moz-user-*` | 0.0 | Selection |
| `field-sizing` / `interactivity` / `interest-delay*` | 0.0 | UI experiments |
| `will-change` | 0.3 | Hint perf faible |
| `zoom` | 0.2 | Viewport zoom |
| `reading-flow` / `reading-order` | 0.0 | A11y order |

#### View transitions & misc longhands

| Feature | Score | Note courte |
| --- | ---: | --- |
| `view-transition-name` / `view-transition-class` / `view-transition-scope` | 0.1 | DOM VT |
| `all` | 0.4 | Reset cascade compile-time |
| Custom properties `--*` | 1.0 | Avec `var()` prio #2 |
| `-moz-float-edge` / `-moz-force-broken-image-icon` / `-moz-orient` | 0.0 | Vendor |
| Non-standard `-webkit-*` restants (slider, meter, search, … via sélecteurs) | 0.0 | UI vendor |

### At-rules

| Feature | Score | Note courte |
| --- | ---: | --- |
| `@keyframes` | 1.0 | Déjà en GSS |
| `@media` | 1.0 | Priorité #5 |
| `prefers-reduced-motion` (media feature) | 1.0 | Explicitement prévu |
| `prefers-color-scheme` / `prefers-contrast` / `prefers-reduced-transparency` / `prefers-reduced-data` | 0.7 | Variantes utiles scène/UI |
| `hover` / `any-hover` / `pointer` / `any-pointer` (MF) | 0.6 | Capacité input |
| `width` / `height` / `aspect-ratio` / `orientation` / `resolution` (MF) | 0.7 | Viewport → qualité/LOD |
| Autres media features (`color-gamut`, `dynamic-range`, `display-mode`, `forced-colors`, `scripting`, `update`, `scan`, `shape`, `grid`, device-*, overflow-*, viewport-segments, video-dynamic-range, inverted-colors, monochrome, color-index, `-webkit-*`/`-moz-*` MF) | 0.35 | Niche / vendor |
| `@import` | 0.85 | Compose modules GSS |
| `@supports` | 0.6 | Feature flags compile |
| `@container` | 0.55 | Queries taille parent scène |
| `@layer` | 0.55 | Ordre cascade compile |
| `@property` | 0.85 | Types vars / anim ; plus tard |
| `@scope` | 0.55 | Portée sélecteurs |
| `@starting-style` | 0.5 | Entrée transition |
| `@function` | 0.55 | Mixins / fn custom |
| `@for` / `@each` (Sass-like, hors MDN strict) | 1.0 | Priorité #1 roadmap |
| `@charset` | 0.0 | Encoding fichier |
| `@namespace` | 0.0 | XML NS |
| `@font-face` / `@font-feature-values` / `@font-palette-values` | 0.05 | Fonts |
| `@counter-style` (+ descriptors) | 0.05 | List markers |
| `@page` (+ `size`, `page-orientation`) | 0.0 | Print |
| `@color-profile` | 0.4 | Espaces couleur avancés |
| `@custom-media` | 0.6 | Alias media |
| `@document` | 0.1 | Deprecated |
| `@position-try` | 0.2 | Anchor pos |
| `@view-transition` | 0.1 | DOM VT |

### Selectors

| Feature | Score | Note courte |
| --- | ---: | --- |
| Type / `<shape>` | 1.0 | Déjà |
| `.class` / `#id` / `*` | 1.0 | Déjà |
| Selector list `a, b` | 1.0 | Déjà |
| Descendant `a b` | 1.0 | Déjà |
| Child `>` / adjacent `+` / sibling `~` | 1.0 | Nesting prio #6 |
| Column `\|\|` | 0.0 | Tables |
| `&` nesting | 0.9 | Nesting fort |
| Attribute selectors | 0.4 | Peu d’attrs en GSS |
| `:hover` | 1.0 | Priorité #7 |
| `:active` / `:focus` / `:focus-visible` / `:focus-within` | 0.5 | Interaction host |
| `:nth-child()` / `:nth-of-type()` / `:nth-last-*` | 0.85 | Compile-time index |
| `:first-child` / `:last-child` / `:only-child` / `:first-of-type` / `:last-of-type` / `:only-of-type` / `:empty` | 0.8 | Structure scène |
| `:is()` / `:where()` / `:not()` | 0.6 | Utilitaires sélecteur |
| `:has()` | 0.5 | Parent query coûteux mais utile |
| `:root` / `:scope` | 0.6 | Racine / scope |
| `:lang()` / `:dir()` | 0.2 | I18n DOM |
| Link/visited/any-link/local-link/target* | 0.1 | Navigation HTML |
| Form (`:checked`, `:disabled`, `:enabled`, `:valid`, `:invalid`, `:required`, `:optional`, `:read-*`, `:placeholder-shown`, `:autofill`, `:default`, `:indeterminate`, `:in-range`, `:out-of-range`, `:user-valid/invalid`) | 0.0 | Forms |
| Media (`:playing`, `:paused`, `:muted`, `:seeking`, `:buffering`, `:stalled`, `:volume-locked`, `:picture-in-picture`) | 0.1 | Media elements |
| Shadow (`:host`, `:host()`, `:host-context()`, `:has-slotted`, `:state()`, `::part()`, `::slotted()`) | 0.05 | Shadow DOM |
| View-transition pseudos (`:active-view-transition*`, `::view-transition*`) | 0.1 | DOM VT |
| `::before` / `::after` | 0.4 | Pseudo contenu → clones ? |
| `::first-letter` / `::first-line` / `::selection` / `::marker` / `::placeholder` / `::backdrop` / `::file-selector-button` / `::grammar-error` / `::spelling-error` / `::highlight()` / `::search-text` / `::target-text` / `::details-content` / `::column` / `::cue` / `::checkmark` / `::picker*` / `::scroll-*` | 0.1 | Chrome / texte |
| Vendor `:-moz-*` / `::-moz-*` / `::-webkit-*` | 0.0 | UI vendor |
| Keyframe selectors (`from`/`to`/`%`) | 1.0 | Déjà via `@keyframes` |
| Namespace separator `|` | 0.0 | XML |

### Functions

| Feature | Score | Note courte |
| --- | ---: | --- |
| `var()` | 1.0 | Priorité #2 |
| `calc()` | 1.0 | Priorité #2 |
| `min()` / `max()` / `clamp()` | 0.9 | Suite calc |
| `abs()` / `sign()` / `mod()` / `rem()` / `round()` / `pow()` / `sqrt()` / `hypot()` / `log()` / `exp()` / `progress()` | 0.85 | Math compile / shader |
| `sin()` / `cos()` / `tan()` / `asin()` / `acos()` / `atan()` / `atan2()` | 0.85 | Trig dans calc |
| `random()` | 0.55 | Seed compile ou runtime |
| `calc-size()` | 0.2 | Intrinsic box |
| `rgb()` / `hsl()` / `hwb()` / `lab()` / `lch()` / `oklab()` / `oklch()` / `color()` | 1.0 | Couleurs fonctionnelles prio #3 |
| `color-mix()` | 0.85 | Mix espaces |
| `alpha()` / `light-dark()` / `contrast-color()` | 0.7 | Utilitaires couleur |
| `device-cmyk()` / `dynamic-range-limit-mix()` / `palette-mix()` | 0.2 | Niche print/HDR/fonts |
| `cubic-bezier()` / `linear()` / `steps()` | 0.9 | Easings anim |
| `blur()` / `brightness()` / `contrast()` / `grayscale()` / `hue-rotate()` / `invert()` / `opacity()` / `saturate()` / `sepia()` / `drop-shadow()` | 0.8 | `filter` post |
| `translate*()` / `rotate*()` / `scale*()` | 0.9 | Déjà concepts GSS |
| `skew()` / `skewX()` / `skewY()` | 0.4 | Skew ≠ SDF exact |
| `matrix()` / `matrix3d()` / `perspective()` | 0.5 | Matrice générique |
| `sibling-index()` | 1.0 | Priorité #10 |
| `sibling-count()` | 0.9 | Même famille |
| `path()` / `circle()` / `ellipse()` / `polygon()` / `inset()` / `rect()` / `xywh()` / `shape()` / `ray()` | 0.7 | Shapes / motion path |
| `superellipse()` | 0.5 | Corner shape |
| `url()` | 0.4 | Assets / `@import` |
| `attr()` / `env()` | 0.4 | Host / env |
| `if()` | 0.55 | Cond compile |
| `layer()` | 0.5 | Avec `@layer` |
| `type()` / `param()` | 0.5 | `@function` / `@property` |
| `anchor()` / `anchor-size()` | 0.2 | Anchor pos DOM |
| `scroll()` / `view()` | 0.5 | Timelines |
| `counter()` / `counters()` / `symbols()` | 0.05 | Counters |
| Gradients (`linear-` / `radial-` / `conic-` + repeating-*) | 0.5 | Matériau / fond |
| `image()` / `image-set()` / `cross-fade()` / `element()` / `paint()` | 0.2 | Images CSS |
| `-moz-image-rect()` | 0.0 | Vendor |
| `fit-content()` / `minmax()` / `repeat()` | 0.0 | Grid |
| Font variant fns (`stylistic`, `styleset`, …) | 0.0 | Fonts |

### Concepts

| Feature | Score | Note courte |
| --- | ---: | --- |
| Cascade & specificity | 0.9 | Déjà (dont `!important`) |
| Inheritance | 0.7 | Props scène/groupe |
| Nesting | 0.9 | Priorité #6 |
| Custom properties / variables | 1.0 | `var` prio |
| Shorthand properties | 0.8 | Pattern GSS |
| Values & units | 0.9 | Nombres, angles, couleurs |
| Functional notations | 0.9 | Calculs / couleurs |
| At-rules (concept) | 0.9 | `@scene`, `@keyframes`, … |
| Selectors (concept) | 0.9 | Cœur du langage |
| Box model / formatting contexts / margin collapse / containing block | 0.05 | Layout CSS |
| Stacking context / painting order | 0.2 | ≠ ordre SDF |
| Flex / Grid / Multi-column / Float layout | 0.0 | Hors scope |
| Scroll containers / overflow | 0.1 | Host UI |
| Shadow DOM / scoping encapsulation | 0.1 | Web components |
| View Transitions | 0.1 | Document transitions |
| Media / container queries (concept) | 0.7 | Adaptabilité |
| Motion path (concept) | 0.9 | Prio #11 |
| Filter effects (concept) | 0.85 | Post shader |
| Masking / clipping (concept) | 0.55 | CSG-adjacent |
| Compositing & blending | 0.5 | `operation`/`blend` GSS proches |
| Scroll-driven animations | 0.5 | Reframe possible |
| Generated content | 0.3 | Pseudos limité |
| Lists & counters | 0.05 | Hors scope |
| Fonts & text layout | 0.05 | Hors scope |
| Paged media / fragmentation | 0.0 | Print |
| CSSOM / style sheets API | 0.3 | Runtime host, pas cœur |
| Houdini (`@property`, paint worklet) | 0.5 | `@property` utile ; paint non |
| Anchor positioning | 0.2 | DOM layout |
| Environment variables | 0.4 | `env()` host |
| Mixins / custom functions | 0.55 | DX compile |
