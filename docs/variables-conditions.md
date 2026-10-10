<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Language

# Variables and conditions

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#variables-conditions).

<a name="fn-if"></a>

## `if()`

Picks a value by condition, like CSS: the first branch whose condition is true gives its value. End with `else`: when no branch is true, it is an error.

- **Syntax:** `if(<condition>: <value>; …; else: <value>)`
- **Computed:** at compile time, once per object

### Conditions

- **media(<query>):** True when the screen matches the query, like `@media`.
- **style(--x):** True when the custom property is set on the object, or inherited.
- **style(--x: <value>):** True when it has that value.
- **else:** Always true.
- **not, and, or:** Combine conditions; `and` and `or` cannot be mixed without parentheses.

A `media()` condition makes a version of the scene for its query, like `@media`, and counts as one of its queries.

### if() with style()

Each group sets `--theme`, and its spheres pick their color from it.

```css
@scene {
  group#warm {
    sphere * 3
  }
  group#cool {
    sphere * 3
  }
}

#warm {
  --theme: warm;
  translate: 1 0 0;
}

#cool {
  --theme: cool;
  translate: -1 0 0;
}

sphere {
  radius: 0.3;
  translate: 0 calc(sibling-index() * 0.7) 0;
  color: if(style(--theme: warm): #ff5a36;
  else: #3a7bff);
}
```

### if() with media()

A smaller sphere on a narrow screen, and a blue one in dark mode.

```css
@scene {
  sphere;
}

sphere {
  radius: if(media(width < 600px): 0.4;
  else: 0.8);
  translate: 0 1 0;
  color: if(media(prefers-color-scheme: dark): #7cb4ff;
  else: #ff5a36);
}
```

<a name="fn-var"></a>

## `var()`

Reads a custom property, like CSS. A property whose name starts with `--` is a variable: declared on the scene (like `:root`), on a group or on an object, it is inherited down to the object, and the closest one wins.

- **Syntax:** `var(--<name>) | var(--<name>, <fallback>)`
- **Computed:** at compile time, once per object

### Forms

- **var(--name):** The value of the variable. A missing variable is an error, so a typo is never ignored.
- **var(--name, fallback):** The fallback, when the variable is not defined.

A variable can hold several values (`translate: var(--pos)`), use another one (`--big: calc(var(--size) * 2)`), and go inside `calc()`. A frame of `@keyframes` can set a variable: every animatable property that uses it moves with it. The compiler replaces the variables with their values, unless `@property` registers them: the shader receives only numbers.

### a color and a radius

`#b` overrides the `--r` of the scene.

```css
@scene {
  sphere#a;
  sphere#b;
}

scene {
  --accent: #ff5a36;
  --r: 0.4;
}

sphere {
  radius: var(--r);
  color: var(--accent);
}

#a {
  translate: 0.8 0.5 0;
}

#b {
  --r: 0.6;
  translate: -0.8 0.6 0;
}
```

### inherited from a group

The cones read `--green` from their group, and each computes its own `--size`.

```css
@scene {
  group#tree {
    cone.level * 5;
  }
}

#tree {
  --green: #3ad16b;
}

.level {
  --size: calc(sibling-index() * 0.12);
  radius: var(--size);
  height: var(--size);
  translate: 0 calc(1.3 - sibling-index() * 0.18) 0;
  color: var(--green);
}
```

### set by @keyframes

The frame sets `--lift`, and the `translate` of each sphere moves with it.

```css
@scene {
  sphere * 3;
}

sphere {
  --lift: 0;
  radius: 0.3;
  translate: calc(1.8 - sibling-index() * 0.9) calc(0.4 + var(--lift) * sibling-index()) 0;
  color: #ff5a36;
  animation: rise 2s ease-in-out alternate;
}

@keyframes rise {
  to {
    --lift: 0.4;
  }
}
```

---

Next: [Math](values.md)
