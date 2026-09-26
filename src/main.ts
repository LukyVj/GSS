import gssSource from "./scene.gss?raw";
import { compileGSS } from "./compiler";

const fragSource = compileGSS(gssSource);
console.log(fragSource); // pour voir le shader généré dans la console

// --- 1. Le vertex shader : un triangle géant qui couvre tout l'écran ---
// Le vrai travail se fait dans le fragment shader, pixel par pixel.
const vertSource = `#version 300 es
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

// --- 2. Préparer WebGL ---
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const gl = canvas.getContext("webgl2")!;

function compileShader(type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Erreur de compilation du shader",
    );
  }
  return shader;
}

const program = gl.createProgram()!;
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(
    gl.getProgramInfoLog(program) ?? "Erreur de liaison du programme",
  );
}
gl.useProgram(program);
gl.bindVertexArray(gl.createVertexArray());

// Les "adresses" des uniforms dans le shader
const uResolution = gl.getUniformLocation(program, "iResolution");
const uTime = gl.getUniformLocation(program, "iTime");
const uCamera = gl.getUniformLocation(program, "uCamera");
const uDist = gl.getUniformLocation(program, "uDist");

// --- 3. L'état de la caméra : c'est ici que vit la mémoire ---
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
  camera.pitch = Math.min(Math.max(camera.pitch, 0.05), 1.4); // on bloque entre le sol et le zénith
});

const stopDragging = () => {
  camera.dragging = false;
};
canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);

// --- 4. Adapter la taille du canvas à l'écran ---
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// --- 5. La boucle de rendu : une fois par image ---
let lastTime = performance.now();

function frame(now: number) {
  const dt = (now - lastTime) / 1000; // secondes écoulées depuis l'image précédente
  lastTime = now;

  // Rotation automatique, sauf pendant le drag
  if (!camera.dragging) camera.yaw += dt * 0.3;

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);

  // On envoie l'état au shader
  gl.uniform3f(uResolution, canvas.width, canvas.height, 1);
  gl.uniform1f(uTime, now / 1000);
  gl.uniform2f(uCamera, camera.yaw, camera.pitch);
  gl.uniform1f(uDist, camera.dist);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
