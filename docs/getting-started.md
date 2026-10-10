<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Start here

# Getting started

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#getting-started).

<a name="why-gss"></a>

## Why GSS

Front-end developers already describe how things look with selectors, properties, the cascade and `@keyframes`. To go 3D, they meet GLSL, the language of the GPU: powerful, but written in distance functions, vectors and math, far from the way they think about design.

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

Shapes are declared in `@scene`, then styled with the rules of a web page: selectors, specificity, units like `deg` and `s`, `@keyframes`. The compiler turns the whole stylesheet into one shader that runs on the GPU.

Next, put the scene on a page with [Embedding a scene](installation.md#embedding), or read the reference: each page describes one at-rule, selector, property or function, with examples to try.

---

Next: [Installation](installation.md)
