<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Motion

# Easings

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#easings).

<a name="fn-cubic-bezier"></a>

## `cubic-bezier()`

An easing curve, like CSS, for `animation` and `transition`. The curve goes from (0, 0) to (1, 1), pulled by two handles: x is the time, from 0 to 1, and y the progress, which can go below 0 or above 1 to overshoot.

- **Syntax:** `cubic-bezier(<x1>, <y1>, <x2>, <y2>)`
- **Computed:** at compile time, once per object

### Keywords

- **ease:** `cubic-bezier(0.25, 0.1, 0.25, 1)`
- **ease-in:** `cubic-bezier(0.42, 0, 1, 1)`
- **ease-out:** `cubic-bezier(0, 0, 0.58, 1)`
- **ease-in-out:** `cubic-bezier(0.42, 0, 0.58, 1)`

### an overshoot

y goes below 0, then above 1: the sphere crouches, then jumps past the top.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 0.5 0;
  radius: 0.5;
  color: #ff5a36;
  animation: jump 1.2s cubic-bezier(0.3, -0.4, 0.7, 1.4) alternate;
}

@keyframes jump {
  to {
    translate: 0 2 0;
  }
}
```

<a name="fn-linear"></a>

## `linear()`

An easing drawn as straight segments, like CSS: each number is the progress at one moment, a percentage of the duration. With enough points, it draws bounces and springs.

- **Syntax:** `linear(<number> [<percentage>{0,2}], …)`
- **Computed:** at compile time, once per object

A missing moment is spread evenly between its neighbours; the first point is at 0% and the last one at 100%. Two percentages on one number hold it still between them, and two points at the same moment jump. The keyword `linear` is `linear(0, 1)`: a constant speed.

### a bounce

The sphere falls and bounces twice before it rests.

```css
@scene {
  sphere;
}

sphere {
  radius: 0.4;
  color: #3a7bff;
  animation: drop 2s linear(0, 1 40%, 0.75 55%, 1 70%, 0.95 80%, 1);
}

@keyframes drop {
  from {
    translate: 0 3 0;
  }
  to {
    translate: 0 0.4 0;
  }
}
```

<a name="fn-steps"></a>

## `steps()`

An easing that moves by equal jumps instead of gliding, like CSS: `steps(4)` holds still, then jumps, four times. Good for ticking hands, sprites and anything mechanical.

- **Syntax:** `steps(<integer>, [jump-start | jump-end | jump-none | jump-both | start | end]?) | step-start | step-end`
- **Computed:** at compile time, once per object

### Positions

- **jump-end, end:** The default: a jump at the end of each step, so the last value comes only at the very end.
- **jump-start, start:** A jump at the start of each step.
- **jump-both:** A jump at both ends.
- **jump-none:** The first and the last values each hold for a whole step.
- **step-start, step-end:** `steps(1, jump-start)` and `steps(1, jump-end)`.

### a ticking hand

Twelve jumps per turn, like the hand of a clock.

```css
@scene {
  cube;
}

cube {
  size: 1.2 0.15 0.15;
  translate: 0 0.6 0;
  color: #ff5a36;
  animation: tick 6s steps(12);
}

@keyframes tick {
  from {
    rotate-y: 0deg;
  }
  to {
    rotate-y: -360deg;
  }
}
```

### step-start and step-end

The same blink, jumping at the start or at the end.

```css
@scene {
  sphere#a;
  sphere#b;
}

sphere {
  radius: 0.4;
}

#a {
  translate: 0.8 0.5 0;
  color: #3a7bff;
  animation: blink 1s step-start;
}

#b {
  translate: -0.8 0.5 0;
  color: #3ad16b;
  animation: blink 1s step-end;
}

@keyframes blink {
  50% {
    scale: 1.6;
  }
}
```

---

Next: [Camera](camera.md)
