<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Motion

# Scroll timelines

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#timelines).

<a name="fn-scroll"></a>

## `scroll()`

A scroll progress timeline, like CSS: the scroll of a container, from its start (0%) to its end (100%), drives an animation instead of time. It is a value of `animation-timeline`.

**A page that scrolls, and the animation where the scroll is:** `0%`, `100%`

- **Syntax:** `scroll([root | nearest] || [block | inline | x | y])`
- **Computed:** by the browser, each time the page scrolls

### Arguments

- **nearest:** The default: the closest scroll container around the scene.
- **root:** The page itself.
- **block, y:** The default: the vertical scroll.
- **inline, x:** The horizontal scroll.

The two arguments come in any order, each one at most once: `scroll(root)`, `scroll(x nearest)`. The whole scroll is the whole animation; scrolling back plays it backward.

The duration and the delay of the animation do not count, its count and its direction still do. `animation-range` plays it on a part of the scroll, in percentages or pixels: the named ranges belong to `view()`. Another scroll container of the page can be named in its CSS, `scroll-timeline-name: --list`, and followed with `animation-timeline: --list`. In the playground, which does not scroll, a slider stands in for the scroll.

### the scroll of the page

The torus turns once from the top of the page to its bottom.

```css
@scene {
  torus;
}

torus {
  translate: 0 0.8 0;
  radius: 0.6;
  thickness: 0.2;
  color: #ff5a36;
  animation: roll 1s linear;
  animation-timeline: scroll(root);
}

@keyframes roll {
  to {
    rotate-x: 360deg;
  }
}
```

### there and back

Two iterations, the second backward: the sphere goes up, then down, along one scroll.

```css
@scene {
  sphere;
}

sphere {
  radius: 0.4;
  color: #3a7bff;
  animation: climb 1s ease-in-out 2 alternate;
  animation-timeline: scroll();
}

@keyframes climb {
  from {
    translate: 0 0.4 0;
  }
  to {
    translate: 0 2 0;
  }
}
```

<a name="fn-view"></a>

## `view()`

A view progress timeline, like CSS: the way of the scene across its scroll container drives an animation instead of time, from 0% when it starts to enter to 100% when it has left. It is a value of `animation-timeline`.

**The scene crossing the window, and the part of the way the animation plays on:** `entry`, `contain`, `exit`, `start`, `end`

- **Syntax:** `view([block | inline | x | y])`
- **Computed:** by the browser, each time the page scrolls

### Arguments

- **block, y:** The default: the scene crosses the container from the bottom to the top.
- **inline, x:** The scene crosses it from one side to the other.

`animation-range` plays the animation on a part of the way: `entry` while the scene comes in, `contain` while it is all in, `exit` while it leaves.

The scroll container is the closest one around the scene, or the page. The duration and the delay of the animation do not count, its count and its direction still do. Unlike CSS, `view()` takes no inset. To follow an element of the page instead of the scene, give it a name in the CSS of the page, `view-timeline-name: --intro`, and write that name: `animation-timeline: --intro`; its `view-timeline-inset` counts. In the playground, which does not scroll, a slider stands in for the scroll.

### across the page

The cube turns a full turn while the scene crosses the page.

```css
@scene {
  cube;
}

cube {
  translate: 0 0.6 0;
  corner-radius: 0.1;
  color: #3ad16b;
  animation: spin 1s linear;
  animation-timeline: view();
}

@keyframes spin {
  to {
    rotate-y: 360deg;
  }
}
```

### once it is in

The spheres gather while the scene comes in, then hold.

```css
@scene {
  sphere * 3;
}

sphere {
  --x: calc(2 - sibling-index());
  radius: 0.35;
  translate: 0 0.35 0;
  color: #ff5a36;
  animation: spread 1s ease-out;
  animation-timeline: view();
  animation-range: entry;
}

@keyframes spread {
  from {
    translate: calc(var(--x) * 2) 1.6 0;
  }
  to {
    translate: var(--x) 0.35 0;
  }
}
```

---

Next: [Camera](camera.md)
