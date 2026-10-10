<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Language

# Selectors

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#selectors).

<a name="selector-type"></a>

## `<shape>`

A shape name targets every object of that shape: `cube` styles every cube, and `group` every group.

- **Specificity:** 1

### every cube, every sphere

```css
@scene {
  cube;
  sphere;
}

cube {
  translate: 0.8 0.5 0;
  color: #ff5a36;
}

sphere {
  translate: -0.8 0.5 0;
}
```

<a name="selector-class"></a>

## `.class`

Targets every object that has this class in `@scene`. An object can have several classes, and a selector can ask for several at once: `.a.b`.

- **Specificity:** 100 per class

### a class on one of two cubes

```css
@scene {
  cube#a.red;
  cube#b;
}

#a {
  translate: 0.8 0.5 0;
}

#b {
  translate: -0.8 0.5 0;
}

.red {
  color: #ff5a36;
}
```

<a name="selector-id"></a>

## `#id`

Targets the object with this id. A multiplied id is numbered: `torus#hero * 3` makes `hero-1`, `hero-2` and `hero-3`.

- **Specificity:** 10000

### one sphere, by its id

```css
@scene {
  sphere#hero;
  sphere;
}

sphere {
  translate: -0.8 0.5 0;
}

#hero {
  translate: 0.8 0.5 0;
  color: #ff5a36;
}
```

<a name="selector-universal"></a>

## `*`

Targets every object, never the settings of the scene. Any other selector beats it, wherever it is written: use it for defaults.

- **Specificity:** 0

### a default for every object

Every object is red, except the sphere, whose own rule wins.

```css
@scene {
  cube;
  sphere;
}

* {
  color: #ff5a36;
}

cube {
  translate: 0.8 0.5 0;
}

sphere {
  translate: -0.8 0.5 0;
  color: #3ad16b;
}
```

<a name="selector-list"></a>

## `a, b`

A selector list gives the same declarations to each selector it names, as if the rule were written once for each.

- **Specificity:** Each selector keeps its own

### two ids, one rule

```css
@scene {
  cube#a;
  cube#b;
  sphere;
}

#a,
#b {
  color: #ff5a36;
}

#a {
  translate: 1.2 0.5 0;
}

#b {
  translate: 0 0.5 0;
}

sphere {
  translate: -1.2 0.5 0;
}
```

<a name="selector-nesting"></a>

## `&`

Nesting, like CSS: a rule can hold other rules, and `&` stands for the selector of the rule around it. In `#g { &:hover { … } }`, the nested rule is `#g:hover`.

- **Specificity:** The sum of the rule around it and of the nested selector

### Forms

- **&:hover:** Joined to the parent: `#g:hover`.
- **#g &:** The parent, placed anywhere: `.a { #g & { … } }` is `#g .a`.
- **cube:** Without `&`, the parent comes first, then a space: `#g { cube { … } }` is `#g cube`.
- **> sphere:** A leading combinator: `#g { > sphere { … } }` is `#g > sphere`.
- **@media:** A query inside a rule: its declarations apply to that rule when the query matches.

Rules nest at any depth, and `&` also works inside `:has()` and `:not()`. The declarations written after a nested rule come after it in the cascade, like CSS. With a list as the parent, `a, b { & c { … } }` gives `a c` and `b c`, each with its own specificity, where CSS gives both the specificity of the most specific selector of the list.

### a group and what it holds

One rule styles the group, its cubes, their `:hover`, and its direct sphere.

```css
@scene {
  group#row {
    cube.a * 3;
    sphere;
  }
}

#row {
  color: #e6e6e6;
  cube {
    size: 0.6;
    translate: calc((sibling-index() - 2.5) * -1) 0.3 0;
    &:hover {
      color: #ff5a36;
    }
  }
  > sphere {
    radius: 0.35;
    translate: -1.5 0.35 0;
    color: #3a7bff;
  }
}
```

### a @media inside a rule

On a narrow screen, the torus changes color.

```css
@scene {
  torus;
}

torus {
  radius: 0.8;
  thickness: 0.25;
  rotate-x: 70deg;
  color: #3a7bff;
  @media (max-width: 600px) {
    color: #ff5a36;
  }
}
```

<a name="selector-important"></a>

## `!important`

Written after a value, it makes the declaration win against every normal one, whatever their selectors. Between two `!important` declarations, specificity decides again.

- **Specificity:** Beats every declaration without it

The cascade picks one value and never combines them: `* { scale: 0.5 !important; }` gives every object a scale of 0.5; it does not halve their own.

### a default that wins

`#a` asks for green, but the `!important` red of `*` wins.

```css
@scene {
  cube#a;
  sphere;
}

* {
  color: #ff5a36 !important;
}

#a {
  translate: 0.8 0.5 0;
  color: #3ad16b;
}

sphere {
  translate: -0.8 0.5 0;
}
```

---

Next: [Combinators](combinators.md)
