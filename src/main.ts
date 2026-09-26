import gssSource from "./scene.gss?raw";
import { compileGSS } from "./compiler";

const fragSource = compileGSS(gssSource);
console.log(fragSource); // to see the generated shader in the console

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

function compileShader(type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compilation error");
  }
  return shader;
}

const program = gl.createProgram()!;
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(program) ?? "Program linking error");
}
gl.useProgram(program);
gl.bindVertexArray(gl.createVertexArray());

// The "addresses" of the uniforms in the shader
const uResolution = gl.getUniformLocation(program, "iResolution");
const uTime = gl.getUniformLocation(program, "iTime");
const uCamera = gl.getUniformLocation(program, "uCamera");
const uDist = gl.getUniformLocation(program, "uDist");

// --- 3. The camera state: this is where the memory lives ---
const camera = {
  yaw: 0,
  pitch: 0.4,
  dragging: false,
  dist: 8,
};

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

// --- 4. Adapt the canvas size to the screen ---
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// --- 5. The render loop: once per image ---
let lastTime = performance.now();

function frame(now: number) {
  const dt = (now - lastTime) / 1000; // seconds elapsed since the previous image
  lastTime = now;

  // Automatic rotation, except during the drag
  if (!camera.dragging) camera.yaw += dt * 0.3;

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);

  // We send the state to the shader
  gl.uniform3f(uResolution, canvas.width, canvas.height, 1);
  gl.uniform1f(uTime, now / 1000);
  gl.uniform2f(uCamera, camera.yaw, camera.pitch);
  gl.uniform1f(uDist, camera.dist);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
