# GSS — GPU Style Sheets

Colors and formats `.gss` files in VS Code, and in the editors built on it: Cursor, VSCodium, Windsurf.

[GSS](https://www.gss-lang.dev) is a CSS-like language for 3D scenes: selectors, properties, `@keyframes` and `@media`, compiled to one shader that runs on the GPU. This extension is not needed to run a scene: to put GSS on a page (npm, the Vite plugin or a `<script>` tag), see the [installation guide](https://www.gss-lang.dev/docs#installation).

- **Highlighting**: selectors, properties, values, colors, numbers and units, `@scene`, `@keyframes`, `@media`, `@property` and `@property-panel`, `@mixin`, `@apply` and `@contents`, nested rules and `&`; the GLSL of a `@paint` block, as GLSL.
- **Formatting**: *Format Document* (or saving the file) rewrites the code in the GSS style: one shape per line in `@scene`, one declaration per line, two-space indentation, comments kept. It is the same formatter as the docs and the playground.
- **File icon**: `.gss` files get the GSS icon in the explorer.
- **HTML snippets**: `gss-scene` inserts a scene loaded from a `.gss` file; `gss-scene-inline` inserts the documented inline `<script type="text/gss">` form.

## Install

Search for *GSS* in the Extensions view, or run:

```sh
code --install-extension lukyvj.gss-language
```

Cursor, VSCodium and Windsurf install it from [Open VSX](https://open-vsx.org/extension/lukyvj/gss-language).

## Format on save

Formatting on save is on by default for `.gss` files. To turn it off, add this to your `settings.json`:

```json
"[gss]": { "editor.formatOnSave": false }
```

## Links

- [Documentation](https://www.gss-lang.dev/docs)
- [Playground](https://www.gss-lang.dev/playground)
