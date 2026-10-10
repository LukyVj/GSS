<p align="center">
  <a href="https://www.gss-lang.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://www.gss-lang.dev/marks/lockup-dark.svg" />
      <img src="https://www.gss-lang.dev/marks/lockup-light.svg" alt="GSS" height="56" />
    </picture>
  </a>
</p>

<p align="center"><strong>Style sheets for the GPU.</strong><br />
3D scenes written in CSS, compiled into a single shader for WebGL2 and WebGPU.</p>

<p align="center">
  <a href="https://www.gss-lang.dev">Website</a> ·
  <a href="https://www.gss-lang.dev/playground">Playground</a> ·
  <a href="https://www.gss-lang.dev/docs">Reference</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gss-lang"><img src="https://img.shields.io/npm/v/gss-lang" alt="npm version" /></a>
</p>

<p align="center">
  <a href="https://www.gss-lang.dev/playground"><img src="https://www.gss-lang.dev/marks/social-playground.png" alt="A GSS scene next to its render" width="720" /></a>
</p>

---

GSS (GPU Style Sheets) is a 3D language for people who already speak CSS. Declare shapes in a
`@scene`, style them with selectors, and the compiler turns it all into one raymarched shader.
No Three.js, no meshes.

```css
@scene {
  torus#ring;
  sphere#ball;
}

#ring {
  translate: 0 1.2 0;
  rotate-x: 70deg;
  radius: 1.1;
  thickness: 0.14;
  color: #e8e6e1;
}

#ball {
  translate: 0 1.2 0;
  radius: 0.55;
  color: #ff5a36;
  material: jelly(0.6);
  animation: float 2s ease-in-out alternate;
}

@keyframes float {
  from { translate: 0 1.2 0; }
  to   { translate: 0 1.5 0; }
}
```

## What it can do

- **Selectors and the cascade**: classes, ids, combinators, `:hover`, `:has()`, `:nth-child()`, nesting.
- **Shapes**: `cube`, `sphere`, `torus`, `cylinder`, `cone`, `capsule`, `path`, `prism`, `lathe` and more.
- **Materials**: `matte()`, `metal()`, `glass()`, `jelly()`, `emissive()`, `iridescent()`, and textures.
- **Motion**: `@keyframes`, `transition`, scroll-driven animations, `offset-path`.
- **Values**: `calc()`, `var()`, `@property`, `random()` and the CSS color functions.
- **Effects**: gradients, noise, masks, blur, bloom and grain.
- **The scene**: floor, background, lights, fog, shadows and an orbit camera.
- **Responsive**: `@media`, `light-dark()` and `if()`.

Every property has its page in the [reference](https://www.gss-lang.dev/docs), with a live example.

## Install

**A tag**, no build step:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/gss-lang@0.0.6/lib/embed.js"></script>
<gss-scene src="logo.gss"></gss-scene>
```

**npm**:

```sh
npm install gss-lang@0.0.6
```

```js
import { mount } from "gss-lang";
mount(canvas, "@scene { sphere; }");
```

**Vite**, compiled at build time:

```js
// vite.config.ts
import gss from "gss-lang/vite";
export default { plugins: [gss()] };

// main.ts
import { mount } from "gss-lang/runtime";
import logo from "./logo.gss";
mount(canvas, logo);
```

WebGPU and TypeScript: see the [installation guide](https://www.gss-lang.dev/docs#installation).

## Tools

- **[Playground](https://www.gss-lang.dev/playground)**: a live editor, errors under their line, the generated GLSL and WGSL, export to Shadertoy.
- **[Reference](https://www.gss-lang.dev/docs)**: searchable, one live example per entry.
- **VS Code**: highlighting, formatting and snippets. `code --install-extension lukyvj.gss-language`

## Status

0.0.6, early: the syntax may still change. See the [changelog](https://github.com/LukyVj/GSS/blob/main/CHANGELOG.md).

## Contribute

Bugs and ideas: [issues](https://github.com/LukyVj/GSS/issues) or [@GSS_lang](https://x.com/GSS_lang).
Pull requests are welcome.

```sh
npm install
npm run dev   # the site, the playground and the reference
npm test
```

Before a pull request, read the [contributing guide](https://github.com/LukyVj/GSS/blob/main/CONTRIBUTING.md): where things live, and which branch to start from.

## License

[Apache 2.0](LICENSE).
