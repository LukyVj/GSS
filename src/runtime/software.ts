// A machine without a GPU draws WebGL on the CPU (SwiftShader, llvmpipe, WARP): a
// raymarched scene there takes seconds a frame and freezes the page (decision 137).
// The browser says so when asked for a context that fails on a major performance caveat;
// a renderer named after a software rasterizer says it too (a browser can be told to allow it).
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

let known: boolean | undefined;

export function softwareRendering(): boolean {
  if (known !== undefined) return known;
  if (typeof document === "undefined") return (known = false);
  const strict = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
  const gl = strict ?? document.createElement("canvas").getContext("webgl2");
  if (!gl) return (known = false); // no WebGL2 at all: mount() says so
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  known = !strict || SOFTWARE.test(renderer);
  gl.getExtension("WEBGL_lose_context")?.loseContext(); // a browser keeps about 16 contexts
  return known;
}

// What the reader is told, over the poster of a scene or in the place of its canvas
export const SOFTWARE_NOTICE = "No graphics card found: the processor would draw this scene, slowly, and the page could freeze.";
export const SOFTWARE_PLAY = "Draw it anyway";
// A GPU too slow for the scene: it stopped after a second or two of frozen frames (decision 142)
export const HEAVY_NOTICE = "This scene is too heavy for this computer: drawing it could freeze the page.";
