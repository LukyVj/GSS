# Reference studies

The first section of `showcase.html` mounts these GSS scenes, one at a time
(`studies.ts`, data in `content.ts`). The host only selects the scene, links its
source, and gives the scroll-driven ones the playground's slider instead of the
page scroll. Geometry and articulation live in GSS.

## High Strut

Reference: [Dave DeSandro's Zdog modeling tutorial](https://zzz.dog/modeling#modeling-tutorial),
final `modelRotateSpine` step. Source dimensions are scaled by 0.12. The palette,
body hierarchy, 90-degree kick, opposite 45-degree standing leg, spine tilt and
opposite arm positions follow the source. Zdog's stroked lines become GSS tubes;
its rounded filled foot becomes a rounded box. Facial marks are moved onto the
sphere surface because GSS performs real depth occlusion. The camera is perspective,
whereas the original uses a flat projection: this is not a pixel-identical renderer.

## Tasty Burger

Reference: [Zdog stroke volume example](https://zzz.dog/modeling#concepts-stroke-volume),
`tastyBurger` in the site's published script. Source dimensions are scaled by 0.02.
The actual demo uses a 96-unit bun, a 92-unit cheese square with a 16-unit stroke,
a 96-unit patty with a 32-unit stroke, a 16-unit bottom cylinder and five seeds.
These differ from the abbreviated prose example. The hemisphere is carved from
an SDF sphere and its rounded lip is reconstructed as a torus. The four source
layers and palette are retained. Separation at the end of the scroll timeline is an added inspection mode.

## Nikon Study

Exterior reference: [Nikon F (1959), Nikon Camera Chronicle](https://imaging.nikon.com/imaging/information/chronicle/rhnc05f-e/).
The black/chrome exterior, raised pentaprism, front controls, top dials, bayonet,
knurled lens barrel and inscriptions are modeled as GSS solids. SVG textures
supply the two inscriptions; they are typographic approximations, not original logo artwork.
The scroll-driven lens explosion, iris blades and interior are illustrative,
not an exact reconstruction of Nikon's mechanical or optical design.

All three reference studies mount on WebGL for predictable startup. Their GLSL
and WGSL compile in the language compiler, and `gpu.test.ts` validates all eight
studies on WebGL. Soft Relic, the camera and the 0.0.5 announcement drop
SwiftShader's WebGPU instance during validation (every WebGPU test after them then
fails), so `wgsl-gpu.test.ts` skips those three; all run on WebGPU in Chrome on Metal. No compiler or shared
renderer behavior was changed for these studies.
