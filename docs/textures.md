<!-- Generated from the reference of the site by `npm run docs:github`: do not edit by hand. -->

[Documentation](README.md) · Appearance

# Textures

Every example of this page, to edit live: [gss-lang.dev/docs](https://www.gss-lang.dev/docs#textures).

<a name="fn-element"></a>

## `element()`

A live image of an HTML element of the page, for `texture`, like CSS `element()`: a card, a form, a chart, any interface on a 3D surface. The browser draws the element with the CSS and the fonts of the page, and the object shows it again each time it changes.

> [!NOTE]
> **Behind a flag for now.** `element()` needs HTML-in-Canvas, which Chromium ships behind a flag: turn on `chrome://flags/#canvas-draw-element` to see it, and the examples of this page. On your own site, visitors see it once you register the site for the HTML-in-Canvas origin trial and add its token to the page, until the trial ends on October 20, 2026. Without it, the object keeps its color.

- **Syntax:** `element(<id>)`
- **Computed:** by the browser, each time the element changes

Put the element inside the scene: inside `<gss-scene>`, next to its script, or inside the canvas given to `mount()`. It stays in the page, so screen readers still read it, but it is seen only on the object. One image covers each face, like any texture: give the element the proportions of the face, and use `::face(front)` for one face only. A `<canvas>` inside the element is captured with it, frame after frame while the scene draws: a chart, a game, another shader. A scene with an element is drawn with WebGL2.

### an HTML card

A card of HTML that sways on the front of a thin cube.

```css
@scene {
  cube;
}

scene {
  floor: none;
  camera-angle: -20deg 10deg;
  camera-target: 0 0.8 0;
  camera-distance: 3.2;
  ambient: 0.55;
}

cube {
  translate: 0 0.8 0;
  size: 1.6 1 0.06;
  corner-radius: 0.03;
  animation: sway 6s ease-in-out infinite alternate;
}

cube::face(front) {
  texture: element(#card);
}

@keyframes sway {
  to {
    rotate-y: 25deg;
  }
}
```

```html
<article id="card" style="
  width: 320px; height: 200px; padding: 28px;
  box-sizing: border-box; border-radius: 18px;
  background: #f4f1ea; color: #1a1d2b;
  font: 600 30px/1.2 system-ui, sans-serif;">
  Hello from <em style="color: #ff5a36;">HTML</em>, on a 3D card
</article>
```

### a canvas, live

A `<canvas>` and its one-line WebGL shader inside the element: the face follows it, frame by frame. The script rides an `onerror` attribute, so it runs even where a page inserts the HTML with `innerHTML`, as the playground does; in a page of yours, a plain `<script>` works too.

```css
@scene {
  cube;
}

scene {
  floor: none;
  background: radial-gradient(#1b1f3a, #0a0c18);
  camera-angle: -18deg 8deg;
  camera-target: 0 0.8 0;
  camera-distance: 3.4;
  ambient: 0.6;
}

cube {
  translate: 0 0.8 0;
  size: 1.92 1.2 0.06;
  corner-radius: 0.03;
  animation: sway 7s ease-in-out infinite alternate;
}

cube::face(front) {
  texture: element(#screen);
}

@keyframes sway {
  from {
    rotate-y: -18deg;
  }
  to {
    rotate-y: 18deg;
  }
}
```

```html
<div id="screen" style="position: relative; width: 480px; height: 300px; border-radius: 20px; overflow: hidden; background: #0a0c18; font: 600 13px/1 system-ui, sans-serif;">
<canvas width="480" height="300" style="position: absolute; inset: 0;"></canvas>
<span style="position: absolute; left: 16px; top: 14px; color: #fff; letter-spacing: .12em; text-transform: uppercase;">a shader, in a shader</span>
<img src="data:," hidden onerror="this.remove();var c=this.parentNode.firstElementChild;var g=c.getContext('webgl',{preserveDrawingBuffer:true});function s(t,x){var h=g.createShader(t);g.shaderSource(h,x);g.compileShader(h);return h}var p=g.createProgram();g.attachShader(p,s(g.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));g.attachShader(p,s(g.FRAGMENT_SHADER,'precision highp float;uniform float t;uniform vec2 r;void main(){vec2 u=(gl_FragCoord.xy-.5*r)/r.y;gl_FragColor=vec4(.5+.5*cos(t+10.*length(u)-vec3(0.,2.,4.)),1.);}'));g.linkProgram(p);g.useProgram(p);var b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);var a=g.getAttribLocation(p,'p');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);var T=g.getUniformLocation(p,'t'),R=g.getUniformLocation(p,'r');cancelAnimationFrame(window.__gssShader);(function f(ms){window.__gssShader=requestAnimationFrame(f);g.uniform1f(T,ms/1000);g.uniform2f(R,c.width,c.height);g.drawArrays(g.TRIANGLES,0,3)})(0)">
</div>
```

<a name="image-rendering"></a>

## `image-rendering`

How the image of `texture` is drawn, like CSS.

- **Syntax:** `auto | smooth | pixelated | crisp-edges`
- **Initial value:** `auto`
- **Applies to:** objects
- **Animatable:** no

### Values

- **auto, smooth:** Blends the pixels, for photos and painted textures. `auto` is the default.
- **pixelated:** Reads the nearest pixel: each pixel stays a sharp square, the look of pixel art.
- **crisp-edges:** The same as `pixelated`.

### a pixel-art block

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  texture: url("/textures/dirt.png");
  image-rendering: pixelated;
}
```

<a name="fn-paint"></a>

## `paint()`

The texture a `@paint` draws, for `texture`, like CSS `paint()`, whose image comes from code: `texture: paint(rings);`. WebGL2 only, for now.

- **Syntax:** `paint(<name>)`
- **Computed:** on the GPU: once, or at every frame when its shader reads time

The name is that of a `@paint` of the scene. Several objects can show the same one: it is drawn once for all of them. A scene with `paint()` is drawn with WebGL2, which `<gss-scene>`, `mountAsync()` and the playground pick by themselves; with WebGPU chosen, the object shows its `color` instead.

### two objects, one shader

The cube and the sphere show the same stripes, drawn once per frame.

```css
@paint stripes {
  uniform float time;
  out vec4 color;

  void main() {
    float band = step(0.5, fract(gl_FragCoord.y / 64.0 - time * 0.5));
    color = vec4(mix(vec3(1.0, 0.35, 0.21), vec3(0.98, 0.95, 0.9), band), 1.0);
  }
}

@scene {
  cube;
  sphere;
}

cube {
  translate: -0.9 0.6 0;
  size: 1.1;
  texture: paint(stripes);
}

sphere {
  translate: 0.9 0.7 0;
  radius: 0.7;
  texture: paint(stripes);
}
```

<a name="texture"></a>

## `texture`

Projects an image onto the surface of the object: one image per face, the top, the bottom and the sides, whatever the size of the object. The image replaces the base color, and moves, turns and scales with the object.

> [!NOTE]
> **Behind a flag for now.** `element()` needs HTML-in-Canvas, which Chromium ships behind a flag: turn on `chrome://flags/#canvas-draw-element` to see it, and the examples of this page. On your own site, visitors see it once you register the site for the HTML-in-Canvas origin trial and add its token to the page, until the trial ends on October 20, 2026. Without it, the object keeps its color.

- **Syntax:** `url("<file>") | element(<id>) | paint(<name>)`
- **Initial value:** `none`
- **Applies to:** objects
- **Animatable:** no

### Values

- **url("<file>"):** An image file, read next to the `.gss` file, like `url()` in a stylesheet.
- **element(<id>):** A live image of an HTML element of the page: see `element()`.
- **paint(<name>):** A texture drawn by a fragment shader: see `@paint`.
- **none:** No image: the default.

### a block of dirt

```css
@scene {
  cube;
}

cube {
  translate: 0 0.5 0;
  texture: url("/textures/dirt.png");
}
```

### an HTML element, with element()

A card of HTML on the front face of a thin cube.

```css
@scene {
  cube;
}

scene {
  floor: none;
  camera-angle: -20deg 10deg;
  camera-target: 0 0.8 0;
  camera-distance: 3.2;
  ambient: 0.55;
}

cube {
  translate: 0 0.8 0;
  size: 1.6 1 0.06;
  corner-radius: 0.03;
}

cube::face(front) {
  texture: element(#card);
}
```

```html
<article id="card" style="
  width: 320px; height: 200px; padding: 28px;
  box-sizing: border-box; border-radius: 18px;
  background: #f4f1ea; color: #1a1d2b;
  font: 600 30px/1.2 system-ui, sans-serif;">
  Hello from <em style="color: #ff5a36;">HTML</em>, on a 3D card
</article>
```

<a name="texture-size"></a>

## `texture-size`

The size of one image on the surface, in the units of the object, like `background-size`: the image repeats to cover each face. `auto`, the default, fits one image to each face.

- **Syntax:** `<number>`
- **Initial value:** `auto`
- **Applies to:** objects
- **Animatable:** no

### a tiled slab

Images of 0.5 on a slab of 3: 6 × 6 per face.

```css
@scene {
  cube;
}

cube {
  size: 3 0.2 3;
  translate: 0 0.1 0;
  texture: url('/textures/dirt.png');
  texture-size: 0.5;
  image-rendering: pixelated;
}
```

---

Next: [Filters](filters.md)
