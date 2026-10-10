<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Language

# Math

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#values).

<a name="fn-calc"></a>

## `calc()`

Computes a value, like CSS `calc()`: `+ - * /` and parentheses, with numbers, angles (`deg`, `rad`, `turn`) and durations (`s`, `ms`). Like CSS, `+` and `-` need a space on each side.

- **Syntax:** `calc(<expression>)`
- **Computed:** at compile time, once per object

The compiler computes it once per object: the shader receives only the result, so the math costs nothing on the GPU. `calc()` and the other math functions work in any value, even inside another function: `metal(#fff, calc(0.1 * 2))`.

### a staircase

Each copy climbs a step higher, with `sibling-index()`.

```css
@scene {
  cube.step * 5;
}

.step {
  size: 0.4;
  translate: calc(1.8 - sibling-index() * 0.6) calc(sibling-index() * 0.25) 0;
  color: #ff5a36;
}
```

<a name="fn-abs-sqrt-pow"></a>

## `abs(), sqrt(), pow()`

Like CSS: `abs()` drops the sign, `sqrt()` is the square root, and `pow(a, b)` is `a` to the power `b`. `pow()` grows fast: good for sizes that double.

- **Syntax:** `abs(<value>) | sqrt(<number>) | pow(<number>, <number>)`
- **Computed:** at compile time, once per object

### abs()

A V: the bars grow away from the middle.

```css
@scene {
  cube.v * 9;
}

.v {
  --h: calc(0.3 + abs(sibling-index() - 5) * 0.25);
  size: 0.3 var(--h) 0.3;
  translate: calc(2.25 - sibling-index() * 0.45) calc(var(--h) / 2) 0;
  color: #7cb4ff;
}
```

### sqrt()

Sizes that grow slower and slower.

```css
@scene {
  sphere.dot * 6;
}

.dot {
  --r: calc(sqrt(sibling-index()) * 0.15);
  radius: var(--r);
  translate: calc(2.45 - sibling-index() * 0.7) var(--r) 0;
  color: #3ad16b;
}
```

### pow()

Each sphere 1.4 times bigger than the one before.

```css
@scene {
  sphere.dot * 5;
}

.dot {
  radius: calc(pow(1.4, sibling-index()) * 0.08);
  translate: calc(2.4 - sibling-index() * 0.8) 0.6 0;
  color: #ff5a36;
}
```

### abs(), sqrt() and pow() together

A sunflower head of 24 seeds.

```css
@scene {
  sphere.seed * 24;
}

.seed {
  --d: calc(sqrt(sibling-index()) * 0.4);
  radius: calc(0.06 + pow(sibling-index() / 24, 2) * 0.14);
  translate: calc(-1 * cos(sibling-index() * 137.5deg) * var(--d)) calc(0.25 + abs(sibling-index() - 12) * 0.03) calc(sin(sibling-index() * 137.5deg) * var(--d));
  color: hsl(calc(sibling-index() * 15) 80% 60%);
}
```

<a name="fn-inverse-trig"></a>

## `asin(), acos(), atan(), atan2()`

The inverse trigonometric functions of CSS: they take a number and return an angle, in `deg`. `atan2(y, x)` gives the angle of the point (x, y), whatever its quarter: the way to turn an object toward a point. Its two values must share a unit.

- **Syntax:** `asin(<number>) | acos(<number>) | atan(<number>) | atan2(<y>, <x>)`
- **Computed:** at compile time, once per object

### asin()

Bars tilted by `asin()`.

```css
@scene {
  cube.tilt * 5;
}

.tilt {
  size: 0.2 0.9 0.2;
  translate: calc(1.8 - sibling-index() * 0.6) 0.45 0;
  rotate-z: asin(calc(0.6 - sibling-index() * 0.2));
  color: #ff5a36;
}
```

### acos()

A fan opened by `acos()`.

```css
@scene {
  cube.fan * 5;
}

.fan {
  size: 0.9 0.1 0.2;
  translate: 0 calc(sibling-index() * 0.3) 0;
  rotate-y: acos(calc(1.2 - sibling-index() * 0.4));
  color: #7cb4ff;
}
```

### atan()

Ramps that tilt more and more, toward 90°.

```css
@scene {
  cube.ramp * 5;
}

.ramp {
  size: 0.8 0.08 0.3;
  translate: calc(2.7 - sibling-index() * 0.9) 0.5 0;
  rotate-z: atan(calc(sibling-index() * -0.4));
  color: #3ad16b;
}
```

### atan2()

Needles turned along the ring by `atan2()`.

```css
@scene {
  cube.needle * 8;
}

.needle {
  --a: calc(sibling-index() * 45deg);
  size: 0.5 0.08 0.08;
  translate: calc(cos(var(--a)) * -1.4) 0.5 calc(sin(var(--a)) * 1.4);
  rotate-y: atan2(sin(var(--a)), cos(var(--a)));
  color: #ff5a36;
}
```

### asin(), acos(), atan() and atan2() together

A curve drawn with all four.

```css
@scene {
  sphere.dot * 10;
}

.dot {
  --x: calc(sibling-index() * 0.2 - 1.1);
  radius: 0.12;
  translate: calc(var(--x) * -2) calc(1 + sin(asin(var(--x)) + acos(var(--x))) * 0.4) calc(atan(var(--x)) / 90deg);
  rotate-y: atan2(var(--x), 1);
  color: hsl(calc(sibling-index() * 36) 80% 60%);
}
```

<a name="fn-exponential"></a>

## `hypot(), log(), exp()`

The exponential functions of CSS, for sizes and distances that grow fast or slowly.

- **Syntax:** `hypot(<value>, …) | log(<number>, <base>?) | exp(<number>)`
- **Computed:** at compile time, once per object

### Functions

- **hypot(<value>, …):** The length of a vector: `hypot(3, 4)` is 5, the distance from the center to the point (3, 4).
- **log(<number>, <base>):** The natural logarithm, or the logarithm in a base: `log(8, 2)` is 3.
- **exp(<number>):** `e` to a power. `e` is also a constant.

### hypot()

Bigger and bigger away from the center.

```css
@scene {
  sphere.dot * 9;
}

.dot {
  --x: calc(mod(sibling-index() - 1, 3) - 1);
  --z: calc(round(down, calc((sibling-index() - 1) / 3)) - 1);
  radius: calc(0.12 + hypot(var(--x), var(--z)) * 0.1);
  translate: calc(var(--x) * -0.9) 0.4 calc(var(--z) * 0.9);
  color: #7cb4ff;
}
```

### log()

Bars that grow slower and slower.

```css
@scene {
  cube.bar * 8;
}

.bar {
  --h: calc(0.2 + log(sibling-index(), 2) * 0.4);
  size: 0.3 var(--h) 0.3;
  translate: calc(2 - sibling-index() * 0.45) calc(var(--h) / 2) 0;
  color: #3ad16b;
}
```

### exp()

Spheres that grow faster and faster.

```css
@scene {
  sphere.dot * 6;
}

.dot {
  radius: calc(exp(sibling-index() / 3) * 0.06);
  translate: calc(2.45 - sibling-index() * 0.7) 0.6 0;
  color: #ff5a36;
}
```

### hypot(), log() and exp() together

A spiral of seeds that shrink outward.

```css
@scene {
  sphere.seed * 12;
}

.seed {
  --a: calc(sibling-index() * 30deg);
  --d: calc(log(sibling-index() + 1) * 0.8);
  radius: calc(exp(0 - sibling-index() / 8) * 0.25);
  translate: calc(-1 * cos(var(--a)) * var(--d)) calc(0.3 + hypot(cos(var(--a)), 1) * 0.2) calc(sin(var(--a)) * var(--d));
  color: hsl(calc(sibling-index() * 30) 80% 60%);
}
```

<a name="fn-min-max-clamp"></a>

## `min(), max(), clamp()`

The smallest or the largest of their values, or a value kept between two bounds, like CSS. The values must share a unit: `max(10deg, 20deg)`, not `max(10deg, 2)`.

- **Syntax:** `min(<value>, …) | max(<value>, …) | clamp(<min>, <value>, <max>)`
- **Computed:** at compile time, once per object

### Functions

- **min(<value>, …):** The smallest.
- **max(<value>, …):** The largest.
- **clamp(<min>, <value>, <max>):** The value, kept between `min` and `max`.

### min()

Bars that grow, up to 1.2.

```css
@scene {
  cube.bar * 6;
}

.bar {
  --h: min(sibling-index() * 0.35, 1.2);
  size: 0.3 var(--h) 0.3;
  translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0;
  color: #ff5a36;
}
```

### max()

Bars never shorter than 0.6.

```css
@scene {
  cube.bar * 6;
}

.bar {
  --h: max(0.6, sibling-index() * 0.3);
  size: 0.3 var(--h) 0.3;
  translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0;
  color: #3a7bff;
}
```

### clamp()

Bars kept between 0.5 and 1.4.

```css
@scene {
  cube.bar * 6;
}

.bar {
  --h: clamp(0.5, sibling-index() * 0.35, 1.4);
  size: 0.3 var(--h) 0.3;
  translate: calc(1.75 - sibling-index() * 0.5) calc(var(--h) / 2) 0;
  color: #3ad16b;
}
```

### min(), max() and clamp() together

Heights and widths, each one bounded.

```css
@scene {
  cube.bar * 8;
}

.bar {
  --h: max(0.3, min(sibling-index() * 0.3, 1.5));
  --w: clamp(0.15, sibling-index() * 0.05, 0.35);
  size: var(--w) var(--h) var(--w);
  translate: calc(2.25 - sibling-index() * 0.5) calc(var(--h) / 2) 0;
  color: hsl(calc(sibling-index() * 40) 80% 60%);
}
```

<a name="fn-progress"></a>

## `progress()`

Where a value sits between a start and an end, from 0 to 1, like the CSS function: `progress(sibling-index(), 1, sibling-count())` goes from 0 for the first copy to 1 for the last. The result is kept between 0 and 1, and the three values must share a unit.

- **Syntax:** `progress(<value>, <start>, <end>)`
- **Computed:** at compile time, once per object

### a ramp of heights and hues

Each bar grows and changes hue with its progress.

```css
@scene {
  cube.fade * 8;
}

.fade {
  --p: progress(sibling-index(), 1, sibling-count());
  size: 0.35 calc(0.2 + var(--p)) 0.35;
  translate: calc(2.25 - sibling-index() * 0.5) calc(0.1 + var(--p) / 2) 0;
  color: hsl(calc(200 + var(--p) * 160) 80% 60%);
}
```

<a name="fn-random"></a>

## `random()`

A random value between a minimum and a maximum, like CSS: `random(0.2, 1.4)`, `random(0deg, 360deg)`. The value is chosen once, when the scene compiles, and stays the same at every reload.

- **Syntax:** `random([--<name> || element-shared | fixed <number>,]? <min>, <max>, <step>?)`
- **Computed:** at compile time, once per object

### Forms

- **random(<min>, <max>):** Any value between them. Each object, property and call gets its own, so one rule scatters every copy.
- **random(<min>, <max>, <step>):** One of `min`, `min + step`… up to `max`: `random(0deg, 180deg, 45deg)`.
- **random(--<name>, …):** One value shared by the calls of an object that use this name: the same number for x and z.
- **random(element-shared, …):** The same value for every object.
- **random(fixed <number>, …):** The random number set by hand, from 0 to just below 1.

The values must share a unit.

### a sky of stars

Thirty stars, each with its own size, place and hue.

```css
@scene {
  sphere.star * 30;
}

.star {
  radius: random(0.05, 0.2);
  translate: random(-2.5, 2.5) random(0.3, 2.2) random(-2, 1);
  color: hsl(random(180, 260) 80% 70%);
}
```

### random() with a step and --name

`--size` gives each block one size for its width and its height, and its turn goes by steps of 15°.

```css
@scene {
  cube.block * 16;
}

.block {
  --s: random(--size, 0.2, 0.5);
  size: var(--s);
  translate: calc(1.2 - mod(sibling-index() - 1, 4) * 0.8) calc(var(--s) / 2) calc(round(down, calc((sibling-index() - 1) / 4)) * 0.8 - 1.2);
  rotate-y: random(0deg, 90deg, 15deg);
  color: oklch(70% 0.15 random(0, 360, 60));
}
```

<a name="fn-sibling-count"></a>

## `sibling-count()`

How many siblings the object has, itself included, like the CSS function. Divided into a full turn, it spreads objects evenly, whatever their number: change `* 8` into `* 20`, and the ring follows.

- **Syntax:** `sibling-count()`
- **Computed:** at compile time, once per object

### beads in a ring

```css
@scene {
  sphere.bead * 8;
}

.bead {
  radius: 0.2;
  translate: calc(cos(sibling-index() * 1turn / sibling-count()) * -1.4) 0.5 calc(sin(sibling-index() * 1turn / sibling-count()) * 1.4);
  material: jelly(0.6);
  color: #ff5a36;
}
```

<a name="fn-sibling-index"></a>

## `sibling-index()`

The position of the object among its siblings, from 1, like the CSS function: `cube * 12` makes 12 siblings numbered 1 to 12. With `calc()`, one rule gives each copy its own place, angle or size: no loop needed.

- **Syntax:** `sibling-index()`
- **Computed:** at compile time, once per object

Siblings are the objects of the same `@scene` block or group. A group is a sibling too, and the count starts again inside each group. It means nothing in `scene { }` or in `@keyframes`, shared by every object.

### a ring of petals

Twelve copies, each placed and turned 30° further than the one before.

```css
@scene {
  cube.petal * 12;
}

.petal {
  size: 0.25 0.6 0.25;
  translate: calc(cos(sibling-index() * 30deg) * -1.6) 0.5 calc(sin(sibling-index() * 30deg) * 1.6);
  rotate-y: calc(sibling-index() * 30deg);
  color: #ff5a36;
}
```

<a name="fn-stepped"></a>

## `sign(), round(), mod(), rem()`

The stepped functions of CSS. Their values must share a unit: `round(37deg, 15deg)` is `30deg`.

- **Syntax:** `sign(<value>) | round([nearest | up | down | to-zero,]? <value>, <step>?) | mod(<value>, <value>) | rem(<value>, <value>)`
- **Computed:** at compile time, once per object

### Functions

- **sign(<value>):** -1, 0 or 1.
- **round(<value>, <step>):** The value snapped to a multiple of its step (1 by default): `nearest` (halfway goes up), `up`, `down` or `to-zero`, written first.
- **mod(<value>, <value>):** The rest of a division, with the sign of the divisor: `mod(-7, 3)` is 2.
- **rem(<value>, <value>):** The rest, with the sign of the value: `rem(-7, 3)` is -1.

### sign()

Above or below, by the sign of each position.

```css
@scene {
  cube.side * 9;
}

.side {
  size: 0.3;
  translate: calc(2.25 - sibling-index() * 0.45) calc(0.6 + sign(sibling-index() - 5) * 0.4) 0;
  color: #7cb4ff;
}
```

### round()

Stairs that climb by steps of 0.5.

```css
@scene {
  cube.stair * 9;
}

.stair {
  --h: round(down, calc(sibling-index() * 0.3), 0.5);
  size: 0.4 calc(var(--h) + 0.1) 0.4;
  translate: calc(2.25 - sibling-index() * 0.45) calc(var(--h) / 2 + 0.05) 0;
  color: #ff5a36;
}
```

### mod()

A grid: `mod()` gives the column of each copy.

```css
@scene {
  cube.row * 12;
}

.row {
  size: 0.3;
  translate: calc(0.75 - mod(sibling-index() - 1, 4) * 0.5) 0.15 calc(round(down, calc((sibling-index() - 1) / 4)) * 0.5 - 0.5);
  color: #3ad16b;
}
```

### rem()

A pattern that repeats every 3.

```css
@scene {
  sphere.ball * 9;
}

.ball {
  radius: 0.18;
  translate: calc(2.25 - sibling-index() * 0.45) calc(0.3 + rem(sibling-index(), 3) * 0.4) 0;
  color: #ff5a36;
}
```

### sign(), round(), mod() and rem() together

A grid of tiles, of three heights.

```css
@scene {
  cube.tile * 16;
}

.tile {
  --col: mod(sibling-index() - 1, 4);
  --row: round(down, calc((sibling-index() - 1) / 4));
  size: 0.4 calc(0.2 + rem(sibling-index(), 3) * 0.2) 0.4;
  translate: calc(0.75 - var(--col) * 0.5) 0.2 calc(var(--row) * 0.5 - 0.75);
  rotate-y: calc(sign(var(--col) - 1.5) * -15deg);
  color: hsl(calc(sibling-index() * 22) 80% 60%);
}
```

<a name="fn-trig"></a>

## `sin(), cos(), tan()`

The trigonometric functions of CSS: they take an angle (`deg`, `rad`, `turn`) or a number of radians, and return a number. `cos()` and `sin()` of the same angle give a point on a circle: the way to place objects in a ring, a spiral or a wave. `pi` is known too: `cos(pi)` is -1.

- **Syntax:** `sin(<angle> | <number>)`
- **Computed:** at compile time, once per object

### sin()

A wave: the height of each sphere follows `sin()`.

```css
@scene {
  sphere.wave * 9;
}

.wave {
  radius: 0.18;
  translate: calc(2 - sibling-index() * 0.4) calc(0.8 + sin(sibling-index() * 40deg) * 0.5) 0;
  color: #7cb4ff;
}
```

### cos()

Columns whose heights follow `cos()`.

```css
@scene {
  cube.col * 9;
}

.col {
  --h: calc(0.9 + cos(sibling-index() * 40deg) * 0.6);
  size: 0.25 var(--h) 0.25;
  translate: calc(2 - sibling-index() * 0.4) calc(var(--h) / 2) 0;
  color: #ff5a36;
}
```

### tan()

Steps that climb faster and faster with `tan()`.

```css
@scene {
  cube.step * 7;
}

.step {
  --h: calc(tan(sibling-index() * 10deg) * 1.2);
  size: 0.35 var(--h) 0.35;
  translate: calc(2 - sibling-index() * 0.5) calc(var(--h) / 2) 0;
  color: #3ad16b;
}
```

### sin(), cos() and tan() together

A ring of beads that rises and falls.

```css
@scene {
  sphere.bead * 12;
}

.bead {
  radius: calc(0.1 + tan(sibling-index() * 5deg) * 0.2);
  translate: calc(cos(sibling-index() * 30deg) * -1.5) calc(0.6 + sin(sibling-index() * 60deg) * 0.3) calc(sin(sibling-index() * 30deg) * 1.5);
  color: hsl(calc(sibling-index() * 30) 85% 60%);
}
```

---

Next: [Shapes and groups](shapes.md)
