<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Language

# Combinators

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#combinators).

<a name="selector-descendant"></a>

## `a b`

A space means "inside": `#letters cube` targets the cubes of the group `#letters`, at any depth.

- **Specificity:** The sum of its parts

Like CSS, it reads from right to left: the last part is the object, and each part before it is one of its groups, further out each time. `#letters#S` asks for one object with two ids, which never exists: it is an error.

### the cubes of a group

The two cubes inside `#letters` turn red; the one outside does not.

```css
@scene {
  cube#a;
  group#letters {
    cube#b;
    cube#c;
  }
}

cube {
  translate: 1.2 0.5 0;
}

#letters cube {
  color: #ff5a36;
}

#b {
  translate: 0 0.5 0;
}

#c {
  translate: -1.2 0.5 0;
}
```

<a name="selector-child"></a>

## `a > b`

Targets direct children: `#g > cube` is the cubes right inside `#g`, not those of a nested group.

- **Specificity:** The sum of its parts

It combines with spaces and sibling combinators: `#g > group cube`. The spaces around `>` are optional, and combinators add no specificity.

### direct children only

Only `#direct` turns red: `#nested` is inside another group.

```css
@scene {
  group#g {
    cube#direct;
    group {
      cube#nested;
    }
  }
}

cube {
  translate: 0.8 0.5 0;
}

#nested {
  translate: -0.8 0.5 0;
}

#g > cube {
  color: #ff5a36;
}
```

<a name="selector-adjacent"></a>

## `a + b`

Targets the next sibling, with the same parent: `sphere + cube` is a cube declared right after a sphere, in `@scene` or in a group.

- **Specificity:** The sum of its parts

The order is the order of declaration, copies of `* n` included, not the position in 3D. Groups count as siblings, empty ones too. `sphere:hover + cube` reacts only to the sphere right before. The spaces around `+` are optional.

### the cube right after the sphere

`#a` turns red, and grows while the sphere is hovered; `#b` does not.

```css
@scene {
  sphere;
  cube#a;
  cube#b;
}

sphere {
  translate: 1.4 0.5 0;
  radius: 0.4;
}

#a {
  translate: 0 0.5 0;
}

#b {
  translate: -1.4 0.5 0;
}

sphere + cube {
  color: #ff5a36;
}

sphere:hover + cube {
  scale: 1.2;
}
```

<a name="selector-sibling"></a>

## `a ~ b`

Targets every later sibling, with the same parent: `sphere ~ cube` is every cube after a sphere, even with other objects between them.

- **Specificity:** The sum of its parts

It never targets an earlier sibling, nor the children of a sibling. Each copy of `* n` counts, and so do groups, empty ones too. Chains can mix every combinator, and the spaces around `~` are optional.

### every cube after the sphere

Both cubes after the sphere turn red; the one before does not.

```css
@scene {
  cube#before;
  sphere;
  cube#after * 2;
}

* {
  translate: calc((sibling-index() - 2.5) * -1.3) 0.5 0;
}

sphere {
  radius: 0.4;
}

sphere ~ cube {
  color: #ff5a36;
}
```

---

Next: [Pseudo-classes and cursor](pseudo-classes.md)
