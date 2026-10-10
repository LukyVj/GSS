<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Structure

# Combinations

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#combinations).

<a name="blend"></a>

## `blend`

Smooths the junction between the object and the objects declared before it, over the given distance. 0 keeps a sharp junction; it works with every `operation`.

- **Syntax:** `<number>`
- **Initial value:** `0`
- **Applies to:** objects
- **Animatable:** no

### two spheres that melt together

```css
@scene {
  sphere#a;
  sphere#b;
}

#a {
  translate: 0.4 1 0;
}

#b {
  translate: -0.4 1 0;
  blend: 0.4;
}
```

<a name="operation"></a>

## `operation`

Sets how the object combines with the objects declared before it in `@scene`. The floor is never affected.

- **Syntax:** `union | subtract | intersect`
- **Initial value:** `union`
- **Applies to:** objects
- **Animatable:** no

### Values

- **union:** Adds the object: the default.
- **subtract:** Carves it out of them.
- **intersect:** Keeps only their common part.

### a sphere carved out of a cube

```css
@scene {
  cube;
  sphere;
}

cube {
  translate: 0 1 0;
}

sphere {
  translate: 0 1 0;
  radius: 0.65;
  operation: subtract;
}
```

---

Next: [Colors](colors.md)
