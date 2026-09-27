import gssSource from "./scene.gss?raw";
import { compileScene } from "./compiler";
import type { CameraSettings } from "./compiler/camera";

// --- 1. The vertex shader: a giant triangle that covers the whole screen ---
// The real work is done in the fragment shader, pixel by pixel.
const vertSource = `#version 300 es
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

// --- 2. Prepare WebGL ---
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const gl = canvas.getContext("webgl2")!;
gl.bindVertexArray(gl.createVertexArray());

function compileShader(type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log ?? "Shader compilation error");
  }
  return shader;
}

// A scene ready on the GPU: the program and the "addresses" of its uniforms
type GpuScene = {
  program: WebGLProgram;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uCamera: WebGLUniformLocation | null;
  uDist: WebGLUniformLocation | null;
};

function createGpuScene(fragSource: string): GpuScene {
  const vertex = compileShader(gl.VERTEX_SHADER, vertSource);
  const fragment = compileShader(gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex); // the program keeps what it needs
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log ?? "Program linking error");
  }
  return {
    program,
    uResolution: gl.getUniformLocation(program, "iResolution"),
    uTime: gl.getUniformLocation(program, "iTime"),
    uCamera: gl.getUniformLocation(program, "uCamera"),
    uDist: gl.getUniformLocation(program, "uDist"),
  };
}

// --- 3. The state: this is where the memory lives ---
let scene: GpuScene | null = null; // what is on screen
let settings: CameraSettings | null = null; // the camera written in the GSS

const camera = { yaw: 0, pitch: 0, dist: 8, dragging: false };

// Only reset what the GSS changed, so that typing does not
// move the camera the user has placed with the mouse.
function applyCameraSettings(next: CameraSettings): void {
  if (!settings || next.yaw !== settings.yaw || next.pitch !== settings.pitch) {
    camera.yaw = next.yaw;
    camera.pitch = next.pitch;
  }
  if (!settings || next.distance !== settings.distance) {
    camera.dist = next.distance;
  }
  settings = next;
}

// GSS text → scene on screen. Throws on the first error, before touching
// the current scene: if the new code is invalid, the old scene stays visible.
function load(source: string): void {
  const compiled = compileScene(source); // GSS errors
  const next = createGpuScene(compiled.shader); // GLSL errors
  if (scene) gl.deleteProgram(scene.program);
  scene = next;
  applyCameraSettings(compiled.camera);
}

// --- 4. The mouse moves the camera ---
canvas.addEventListener("pointerdown", (e) => {
  camera.dragging = true;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("wheel", (e) => {
  camera.dist += e.deltaY * 0.01;
  camera.dist = Math.min(Math.max(camera.dist, 3), 15);
});

canvas.addEventListener("pointermove", (e) => {
  if (!camera.dragging) return;
  camera.yaw -= e.movementX * 0.01;
  camera.pitch += e.movementY * 0.01;
  camera.pitch = Math.min(Math.max(camera.pitch, 0.05), 1.4); // we block between the floor and the zenith
});

const stopDragging = () => {
  camera.dragging = false;
};
canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);

// --- 5. Adapt the canvas size to its box ---
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// --- 6. The editor: every change recompiles the scene ---
const editor = document.querySelector<HTMLTextAreaElement>("#code")!;
const status = document.querySelector<HTMLElement>("#status")!;
const errorBox = document.querySelector<HTMLElement>("#error")!;

function tryLoad(source: string): void {
  try {
    load(source);
    status.textContent = "OK";
    status.className = "status ok";
    errorBox.hidden = true;
  } catch (error) {
    status.textContent = "Error";
    status.className = "status error";
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : String(error);
  }
}

editor.value = gssSource;
tryLoad(gssSource);

// We wait for a short pause in the typing before recompiling
let typingTimer: number | undefined;
editor.addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = window.setTimeout(() => tryLoad(editor.value), 250);
});

// Tab inserts two spaces instead of leaving the editor
editor.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.shiftKey) return;
  e.preventDefault();
  editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
});

// --- 7. The render loop: once per image ---
let lastTime = performance.now();

function frame(now: number) {
  const dt = (now - lastTime) / 1000; // seconds elapsed since the previous image
  lastTime = now;

  // Automatic rotation, except during the drag
  if (settings && !camera.dragging) camera.yaw += dt * settings.spin;

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);

  if (scene) {
    // We send the state to the shader
    gl.useProgram(scene.program);
    gl.uniform3f(scene.uResolution, canvas.width, canvas.height, 1);
    gl.uniform1f(scene.uTime, now / 1000);
    gl.uniform2f(scene.uCamera, camera.yaw, camera.pitch);
    gl.uniform1f(scene.uDist, camera.dist);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
