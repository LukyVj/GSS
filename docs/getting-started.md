<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Start here

# Getting started

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#getting-started).

<a name="why-gss"></a>

## Why GSS

Front-end developers already describe how things look with selectors, properties, the cascade and `@keyframes`. To go 3D, they meet GLSL, the language of the GPU: powerful, but written in distance functions, vectors and math, far from the way they think about design.

**How it goes, from where it is written to what the scene shows:** `scene.gss`, `one shader`, `the GPU draws it`

GSS bridges that gap. If you can write CSS, you can already read GSS:

- **Selectors:** `sphere`, `.glass`, `#ball`, `:hover`, `:has()`, the cascade and `!important`
- **Properties:** `color`, `translate`, `opacity`, `filter`, in `deg`, `s` and `%`
- **Motion:** `@keyframes`, `animation`, `transition`, `cubic-bezier()`
- **Values:** `calc()`, `var()`, `@property`, `oklch()`, `color-mix()`
- **Media queries:** `@media`, `prefers-color-scheme`, `light-dark()`

GSS does not replace GLSL. It is a way in: a familiar syntax to start creating in 3D today, and a readable path toward the shader underneath, for those who want to go further.

<a name="first-scene"></a>

## Your first scene

A glass ball that floats above the floor. Press *Try it* to edit it live.

```css
@scene {
  sphere#ball;
}

#ball {
  translate: 0 1 0;
  color: #ff5a36;
  material: glass(1.5, frosted 0.3);
  animation: float 2s ease-in-out alternate;
}

@keyframes float {
  from {
    translate: 0 1 0;
  }
  to {
    translate: 0 1.5 0;
  }
}
```

**The first scene, one declaration at a time:** `sphere#ball;`, `translate: 0 1 0;`, `color: #ff5a36;`, `material: glass(1.5, frosted 0.3);`, `animation: float 2s ease-in-out alternate;`

`@scene` lists the shapes. A rule styles them, like CSS: `#ball` lifts the sphere, colors it and turns it into glass. `@keyframes` makes it float.

Next, put the scene on a page with [Embedding a scene](installation.md#embedding), or read the reference: each page describes one at-rule, selector, property or function, with examples to try.

---

Next: [Installation](installation.md)
