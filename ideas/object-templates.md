# `@object`: named pieces of a scene

**Status**: proposal, open for discussion. Nothing built.

**Where it comes from**: Romain Menke's feedback on the syntax for defining objects:

```css
@object --lamp {
  /* descriptors for an object */
}

@scene --scene {
  /* descriptors for a scene */
  objects: --lamp, ...;
}
```

His point: `@property --x`, `@font-palette-values --x`, `@position-try --x` all work this way. A
named at-rule defines something, a property points at it. It's the idiomatic CSS shape.

I agree with the shape. I don't think it should replace how objects are declared today. I think it
should come on top.

---

## Why not replace the selectors

**Descriptors don't cascade.** In CSS, what's inside `@property` or `@font-palette-values` is not
matched by selectors. No `:hover`, no `@media`, no `var()` per element. If an object's radius lives
in `@object --pillar { radius: 0.22; }`, there's nothing left for `.pillar:hover`, `:nth-child()`,
`sibling-index()`, `transition` or `@media` to hang on. That's most of what makes GSS feel like CSS.

**A scene is a tree, and order matters.** Groups nest, and `operation` (subtract, intersect)
combines an object with the ones before it. A flat `objects: --a, --b` list loses both, or needs an
`objects:` inside every object, which reads worse than the nested block we have.

**In CSS, what you style never comes from CSS.** It comes from HTML, and selectors find it. In GSS,
`@scene` is the HTML. That's why objects are written like elements (`cube.key * 16`) and styled with
selectors. Same for `@scene` declaring and `scene { }` styling: the scene's own settings get the
cascade too (`@media`, `var()`, animations).

## What I'd take from it

What GSS is really missing is the part Romain's syntax gives for free: **a named piece of scene you
can reuse**. Today, two lamps means writing the group twice, or `* 2` and telling them apart with
`sibling-index()`.

So, `@object` defines structure, not style:

```css
@object --lamp {
  group {
    cylinder.foot;
    sphere.shade;
    light.bulb;
  }
}

@scene {
  --lamp#left;
  --lamp#right;
  plane#table;
}

.shade { color: #f4e3c1; }
#right .shade { color: #ff5a36; }
#left .bulb { intensity: 3; }
#right:hover .bulb { intensity: 6; }
```

`--lamp#left` places the lamp in the scene, like `<use href="#lamp">` places a `<symbol>` in SVG.
It takes an id, classes, attributes and `* n`, like any object. Everything inside it is styled with
the selectors we already have. Nothing new to learn on the styling side.

### How it would work

- `@object --name { … }` at the top of the file, its body is what a `@scene` block holds. The name
  starts with `--`, like `@property` and `@mixin`.
- In `@scene`, `--name#id.class * n` is replaced by its body, wrapped in a `group` that takes the
  id, the classes and the count. Unfolded before the parser, like `@mixin` and `@for`: the shader is
  the shader of the same scene written by hand, and it costs nothing at runtime.
- An `@object` can use another one. One that uses itself is an error that shows the loop.
- Fully additive: every scene written today compiles to the same shader.

### Optional: named scenes

The second half of Romain's snippet, `@scene --scene`, could give several scenes in one file:

```css
@scene --day { … }
@scene --night { … }
```

```html
<gss-scene src="lamps.gss" scene="--night"></gss-scene>
```

A `@scene` without a name keeps working as today. Separate from `@object`, could come later.

## Open questions

1. **Selecting every instance.** `#left` and `#right` are easy. What selects all the lamps? A class
   given by default (`.--lamp`?), a new pseudo-class, or nothing and you add a class yourself.
2. **Ids inside an `@object`.** Two lamps means two `.shade`. Classes are fine. An id inside would
   exist twice: number it (`shade-1`, `shade-2`) like `* n` does, or forbid ids inside.
3. **Default styles.** Should an `@object` carry its own rules, scoped to it (like `@scope`)? Handy
   for sharing a full lamp, but it's a second place to style things.
4. **Parameters.** `--lamp(#ff5a36)`, like `@apply --name(…)`? Or keep it to `var()` set on the
   instance (`#right { --tint: #ff5a36; }`), which already works.
</content>
</invoke>
