<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Motion

# Animation and transitions

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#animations).

<a name="animation"></a>

## `animation`

Plays a `@keyframes` animation on the object, like CSS. After its name come the duration, then if needed an easing, a delay, a number of iterations, a direction and a fill mode, in any order.

- **Syntax:** `<keyframes-name> <time> [<easing>] [<time>] [<number> | infinite] [normal | reverse | alternate | alternate-reverse] [none | forwards | backwards | both]`
- **Initial value:** `none`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Values

- **<time>:** The first time is the duration of one iteration, in `s` or `ms`; the second one, the delay: the animation starts after it, or partway with a negative delay.
- **<easing>:** `linear` (the default), `ease`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier()`, `linear()` or `steps()`.
- **<number> | infinite:** How many times it plays: `1.5` stops halfway through the second time. `infinite` is the default.
- **normal, reverse, alternate, alternate-reverse:** The direction: forward, backward, forward then backward, or backward first.
- **none, forwards, backwards, both:** The fill mode: what the object shows outside the animation.

Unlike CSS, an animation loops forever unless it has a number of iterations. Each part also has a property of its own, like `animation-duration`, which wins over what `animation` says. On an object, it animates `translate`, the rotations, `scale`, `color` (a gradient too), `opacity`, `mask-image` and `offset-distance`; on a group, its transforms. On the scene, it animates the properties of the scene, like `background`, `light` or `fog`, and the variables they use: the objects do not follow the variables a scene animates. In a `:hover` or `:active` rule, the animation starts with the state and plays to its end, once unless it says how many times, like a button that fires: see `:active`.

### up and down

`alternate` plays the frames forward, then backward.

```css
@scene {
  sphere;
}

sphere {
  animation: float 2s ease-in-out alternate;
}

@keyframes float {
  from {
    translate: 0 1 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

### a bounce

Up at `50%`, and back down, in a loop of 1 s.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  animation: bounce 1s;
}

@keyframes bounce {
  0%, 100% {
    translate: 0 0.5 0;
  }
  50% {
    translate: 0 1.5 0;
    scale: 1.2;
  }
}
```

### a full turn

`linear` keeps a constant speed while the cube turns and changes color.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  color: #ff5a36;
  animation: turn 4s linear;
}

@keyframes turn {
  to {
    rotate-y: -1turn;
    color: #3a7bff;
  }
}
```

### an overshoot

A `cubic-bezier()` that goes past the top before it settles.

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

### a drop, once

After 0.5 s, one iteration; `both` shows the first frame before it and the last one after.

```css
@scene {
  cube;
}

cube {
  translate: 0 3 0;
  color: #ff5a36;
  animation: drop 1s ease-in 0.5s 1 both;
}

@keyframes drop {
  to {
    translate: 0 0.5 0;
    rotate-y: -90deg;
  }
}
```

### animation on the scene

The background of the scene darkens to dusk.

```css
@scene {
  sphere;
}

sphere {
  translate: 0 1 0;
  color: #ff5a36;
}

scene {
  floor: none;
  background: #101018;
  animation: dusk 4s ease-in-out alternate;
}

@keyframes dusk {
  to {
    background: #3a1f4a;
  }
}
```

<a name="animation-delay"></a>

## `animation-delay`

How long the animation waits before it starts, in `s` or `ms`; a negative delay starts it partway, as if it had begun earlier. It wins over the delay written in `animation`.

- **Syntax:** `<time>`
- **Initial value:** `0s`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### a second of wait

```css
@scene {
  sphere;
}

sphere {
  radius: 0.5;
  color: #3a7bff;
  animation: rise 1.5s ease-in-out;
  animation-delay: 1s;
}

@keyframes rise {
  from {
    translate: 0 0.5 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

<a name="animation-direction"></a>

## `animation-direction`

The way the animation plays, like CSS. It wins over the direction written in `animation`.

- **Syntax:** `normal | reverse | alternate | alternate-reverse`
- **Initial value:** `normal`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Values

- **normal:** Forward: the default.
- **reverse:** Backward.
- **alternate:** Forward, then backward.
- **alternate-reverse:** Backward, then forward.

### back and forth

```css
@scene {
  sphere;
}

sphere {
  radius: 0.5;
  color: #3a7bff;
  animation: rise 1.5s ease-in-out;
  animation-direction: alternate;
}

@keyframes rise {
  from {
    translate: 0 0.5 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

<a name="animation-duration"></a>

## `animation-duration`

The duration of one iteration of the animation, in `s` or `ms`. It wins over the duration written in `animation`.

- **Syntax:** `<time>`
- **Initial value:** `0s`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### 3 s instead of 1.5 s

```css
@scene {
  sphere;
}

sphere {
  radius: 0.5;
  color: #3a7bff;
  animation: rise 1.5s ease-in-out;
  animation-duration: 3s;
}

@keyframes rise {
  from {
    translate: 0 0.5 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

<a name="animation-fill-mode"></a>

## `animation-fill-mode`

What the object shows outside the animation, like CSS. It matters only with a delay or a number of iterations.

- **Syntax:** `none | forwards | backwards | both`
- **Initial value:** `none`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Values

- **none:** Its own value: the default.
- **backwards:** The first frame, during the delay.
- **forwards:** The last frame, once the animation is over.
- **both:** The two.

### staying at the top

One iteration, and `forwards` keeps the last frame.

```css
@scene {
  sphere;
}

sphere {
  radius: 0.5;
  color: #3a7bff;
  animation: rise 1.5s ease-in-out;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
}

@keyframes rise {
  from {
    translate: 0 0.5 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

<a name="animation-iteration-count"></a>

## `animation-iteration-count`

How many times the animation plays: a number, where `1.5` stops halfway through the second time, or `infinite`. Unlike CSS, where an animation plays once, a GSS animation loops forever by default. It wins over the count written in `animation`.

- **Syntax:** `<number> | infinite`
- **Initial value:** `infinite`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### twice

```css
@scene {
  sphere;
}

sphere {
  radius: 0.5;
  color: #3a7bff;
  animation: rise 1.5s ease-in-out;
  animation-iteration-count: 2;
}

@keyframes rise {
  from {
    translate: 0 0.5 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

<a name="animation-range"></a>

## `animation-range`

The part of a scroll timeline the animation plays on, like CSS: `entry` while the scene comes into view, `exit` while it leaves, or percentages of the whole scroll. It goes with `animation-timeline`.

- **Syntax:** `[ normal | <range-name> <percentage>? | <percentage> | <length> ]{1,2}`
- **Initial value:** `normal`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Values

- **normal:** The whole timeline, the default.
- **cover:** From the moment the scene starts to enter its scroll container to the moment it has left: the whole of `view()`.
- **contain:** While the scene is all inside its scroll container, or, when it is larger, while it fills it.
- **entry:** While the scene comes in, from its first pixel to all of it. `entry-crossing`: while its start edge crosses its whole height.
- **exit:** While the scene goes out, from its first pixel out to all of it. `exit-crossing`: from its end edge leaving to its start edge leaving.
- **<percentage>:** A share of the named range before it, or of the whole timeline alone: `entry 50%`, `20% 80%`.
- **<length>:** Pixels from the start of the named range before it, or of the whole timeline: `100px`.

It takes a start, then an end: `entry 10% exit 90%`. A name alone is the whole of that range, `animation-range: entry`; a name alone at the end is its end, `contain exit`. `animation-range-start` and `animation-range-end` set one side each, and win over `animation-range` wherever they are written, like the other longhands of `animation`. Before the range the animation shows its first frame, past it its last. The named ranges belong to `view()`: `scroll()` takes percentages and pixels. Unlike CSS, which ignores it there, a range on an animation that plays in time is an error.

### rise while it comes in

The spheres rise while the scene enters the page, then stay up.

```css
@scene {
  sphere * 3;
}

sphere {
  --x: calc(2 - sibling-index());
  radius: 0.35;
  translate: var(--x) 0.35 0;
  color: #3a7bff;
  animation: rise 1s ease-out;
  animation-timeline: view();
  animation-range: entry;
}

@keyframes rise {
  to {
    translate: var(--x) 1.6 0;
    color: #3ad16b;
  }
}
```

### the middle of the scroll

The cube turns between 25% and 75% of the scroll of the page, and holds before and after.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  corner-radius: 0.1;
  color: #ff5a36;
  animation: turn 1s linear;
  animation-timeline: scroll();
  animation-range: 25% 75%;
}

@keyframes turn {
  to {
    rotate-y: -360deg;
  }
}
```

<a name="animation-range-end"></a>

## `animation-range-end`

Where on the timeline the animation ends, like CSS: the second half of `animation-range`. A name alone is the end of that range.

- **Syntax:** `normal | <range-name> <percentage>? | <percentage> | <length>`
- **Initial value:** `normal`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### done once it is in

The cube grows until the scene is all in view.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  color: #3a7bff;
  scale: 0.3;
  animation: grow 1s ease-out;
  animation-timeline: view();
  animation-range-end: entry;
}

@keyframes grow {
  to {
    scale: 1;
  }
}
```

<a name="animation-range-start"></a>

## `animation-range-start`

Where on the timeline the animation starts, like CSS: the first half of `animation-range`. A name alone is the start of that range.

- **Syntax:** `normal | <range-name> <percentage>? | <percentage> | <length>`
- **Initial value:** `normal`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### from the middle of the entry

The torus starts turning when half of the scene is in view.

```css
@scene {
  torus;
}

torus {
  translate: 0 0.8 0;
  radius: 0.6;
  thickness: 0.2;
  color: #ff5a36;
  animation: tilt 1s;
  animation-timeline: view();
  animation-range-start: entry 50%;
}

@keyframes tilt {
  to {
    rotate-x: 90deg;
  }
}
```

<a name="animation-timeline"></a>

## `animation-timeline`

Drives the animation with the scroll of the page instead of time, like CSS scroll-driven animations. The whole timeline is the whole animation, so the duration and the delay do not count.

- **Syntax:** `auto | scroll([root | nearest] || [block | inline | x | y]) | view([block | inline | x | y])`
- **Initial value:** `auto`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Values

- **auto:** The default: the animation plays in time.
- **scroll():** A scroll container, from its start (0%) to its end (100%): `nearest` (the default) is the closest one around the scene, `root` the page. The axis is `block` (the default), `inline`, `y` or `x`.
- **view():** The scene crossing its scroll container: 0% when it enters at the bottom, 100% when it leaves at the top.

Write it after `animation`, which still needs a name and a duration: `animation: spin 1s linear; animation-timeline: scroll();`. The number of iterations and the direction still count, an animation without a count plays once along the scroll, and scrolling back plays it backward. A scene takes up to 4 different timelines. In the playground, which does not scroll, a slider stands in for the scroll.

### turn with the page

The cube turns and rises as the page scrolls.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  corner-radius: 0.1;
  color: #ff5a36;
  animation: turn 1s linear;
  animation-timeline: scroll();
}

@keyframes turn {
  from {
    rotate-y: 0deg;
  }
  to {
    rotate-y: -360deg;
    translate: 0 1.6 0;
  }
}
```

### rise into view

The spheres rise as the scene comes into view; the second one goes up and back.

```css
@scene {
  sphere * 3;
}

sphere {
  --x: calc(2 - sibling-index());
  radius: 0.35;
  translate: var(--x) 0.35 0;
  color: #3a7bff;
  animation: rise 1s ease-out;
  animation-timeline: view();
}

sphere:nth-child(2) {
  animation-iteration-count: 2;
  animation-direction: alternate;
}

@keyframes rise {
  to {
    translate: var(--x) 1.6 0;
    color: #3ad16b;
  }
}
```

<a name="animation-timing-function"></a>

## `animation-timing-function`

The easing of each step of the animation, like CSS. It wins over the easing written in `animation`.

- **Syntax:** `<easing>`
- **Initial value:** `linear`
- **Applies to:** the scene, objects and groups
- **Animatable:** no

### Values

- **linear:** A constant speed: the default.
- **ease:** Speeds up quickly, then slows down.
- **ease-in, ease-out, ease-in-out:** Starts slowly, ends slowly, or both.
- **step-start, step-end:** One jump, at the start or at the end.
- **cubic-bezier(), linear():** A curve of your own.
- **steps():** Moves by equal jumps.

### slowing down at the end

```css
@scene {
  sphere;
}

sphere {
  radius: 0.5;
  color: #3a7bff;
  animation: rise 1.5s ease-in-out;
  animation-timing-function: ease-out;
}

@keyframes rise {
  from {
    translate: 0 0.5 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

<a name="transition"></a>

## `transition`

Glides the object to its `:hover` state and back, instead of jumping, like CSS. One transition covers every property that `:hover` changes on the object.

- **Syntax:** `none | [all] <time> [<easing>] [<time>]`
- **Initial value:** `none`
- **Applies to:** objects
- **Animatable:** no

### Values

- **<time>:** The first time is the duration, the second one the delay.
- **<easing>:** `ease` by default, or any easing: a keyword, `cubic-bezier()`, `linear()` or `steps()`.

Like CSS, the object enters `:hover` with the transition of its `:hover` rule, if it has one, and leaves it with the transition written at rest. Leaving halfway goes back from where it is, in the time already spent.

### a hover that glides

Scale, turn and color glide in 0.4 s.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  color: #ff5a36;
  transition: 0.4s ease-out;
}

cube:hover {
  scale: 1.3;
  rotate-y: -45deg;
  color: #3a7bff;
}
```

### one way in, another out

The spheres rise quickly with `ease-out`, and fall back with an overshoot.

```css
@scene {
  sphere * 5;
}

sphere {
  radius: 0.35;
  translate: calc(2.7 - sibling-index() * 0.9) 0.4 0;
  color: #3ad16b;
  transition: 0.8s cubic-bezier(0.3, -0.4, 0.7, 1.4);
}

sphere:hover {
  translate: calc(2.7 - sibling-index() * 0.9) 1.4 0;
  transition: 0.4s ease-out;
}
```

---

Next: [Easings](easings.md)
