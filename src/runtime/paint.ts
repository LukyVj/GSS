// texture: paint(name) (decision 151): the fragment shader of a @paint, drawn into a texture
// the object samples like an image. Each @paint has its own program: its names never meet
// those of the scene's shader, and its errors stay its own.

// The size of the texture a @paint draws, in pixels, for now
export const PAINT_SIZE = 512;

export type PaintSource = { name: string; code: string; line: number };

// The giant triangle, in the GLSL of the fragment shader: a program takes one version
const VERTEX_300 = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
const VERTEX_100 = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

// A shader as written for the web, made complete: GLSL ES 1.00 when it writes gl_FragColor,
// 3.00 otherwise; the #version and a precision added when it has none. added: the lines put
// before its first line, to give an error the line of the code.
export function completeShader(code: string): { source: string; version: 100 | 300; added: number } {
  const precision = /\bprecision\s+\w+\s+float\b/.test(code) ? "" : "precision highp float;\n";
  const written = /^\s*#version\s+(\d+)/.exec(code);
  if (written) {
    // #version must stay first: the precision goes on the line after it
    const end = code.indexOf("\n", written.index + written[0].length);
    const head = end === -1 ? code : code.slice(0, end + 1);
    const rest = end === -1 ? "" : code.slice(end + 1);
    return { source: head + (end === -1 ? "\n" : "") + precision + rest, version: written[1] === "300" ? 300 : 100, added: 0 };
  }
  const version = /\bgl_Frag(Color|Data)\b/.test(code) ? 100 : 300;
  const header = (version === 300 ? "#version 300 es\n" : "") + precision;
  return { source: header + code, version, added: header.split("\n").length - 1 };
}

// "ERROR: 0:5: 'nope' : undeclared identifier" → "@paint fill, line 9: 'nope' : undeclared
// identifier", the line in the .gss file
export function paintError(log: string, paint: PaintSource, added: number): string {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && line !== "\0")
    .map((line) =>
      line.replace(/^(?:ERROR|WARNING):\s*\d+:(\d+):\s*/, (_, n: string) => {
        const codeLine = Math.max(1, Number(n) - added);
        return `line ${paint.line + codeLine - 1}: `;
      }),
    );
  return `@paint ${paint.name}, ${lines.join("\n")}`;
}

// The uniforms GSS fills, by the names shaders use on the web
const TIME = new Set(["time", "u_time"]);
const RESOLUTION = new Set(["resolution", "u_resolution"]);
const MOUSE = new Set(["mouse", "u_mouse"]);

type Filled = { location: WebGLUniformLocation; type: number };

type Painter = {
  name: string;
  program: WebGLProgram;
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  time: Filled[];
  resolution: Filled[];
  mouse: Filled[];
  drawn: boolean; // drawn at least once: a shader without time or mouse is drawn once
};

// The @paint of one scene, ready on the GPU
export type PaintSet = {
  texture(name: string): WebGLTexture | undefined;
  readonly animated: boolean; // a shader reads time: it is drawn at every frame
  readonly pointer: boolean; // a shader reads mouse: it is drawn when the pointer moves
  // Draws the textures that need it, before the scene samples them. mouse: in the pixels
  // of the texture, from its bottom left. Leaves the framebuffer of the canvas bound.
  draw(seconds: number, mouse: [number, number]): void;
  destroy(): void;
};

export function createPaints(gl: WebGL2RenderingContext, restoreVertexArray: () => void) {
  // The triangle of the paints, in a buffer: GLSL ES 1.00 has no gl_VertexID
  const vertexArray = gl.createVertexArray()!;
  gl.bindVertexArray(vertexArray);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  restoreVertexArray();

  function shader(type: number, source: string, paint: PaintSource, added: number): WebGLShader {
    const compiled = gl.createShader(type)!;
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(compiled) ?? "";
      gl.deleteShader(compiled);
      throw new Error(paintError(log || "the shader does not compile", paint, added));
    }
    return compiled;
  }

  // One @paint: its program, and the texture it draws into. Throws its GLSL errors.
  function painter(paint: PaintSource): Painter {
    const { source, version, added } = completeShader(paint.code);
    const vertex = shader(gl.VERTEX_SHADER, version === 300 ? VERTEX_300 : VERTEX_100, paint, 0);
    let fragment: WebGLShader;
    try {
      fragment = shader(gl.FRAGMENT_SHADER, source, paint, added);
    } catch (error) {
      gl.deleteShader(vertex);
      throw error;
    }
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "position");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? "";
      gl.deleteProgram(program);
      throw new Error(paintError(log || "the shader does not link", paint, added));
    }
    // The uniforms it declares and GSS knows, with their type
    const time: Filled[] = [];
    const resolution: Filled[] = [];
    const mouse: Filled[] = [];
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      const location = info && gl.getUniformLocation(program, info.name);
      if (!info || !location) continue;
      const filled = { location, type: info.type };
      if (TIME.has(info.name)) time.push(filled);
      else if (RESOLUTION.has(info.name)) resolution.push(filled);
      else if (MOUSE.has(info.name)) mouse.push(filled);
    }
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PAINT_SIZE, PAINT_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // Like the images: clamped at the edges, smooth (textures.ts)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { name: paint.name, program, texture, framebuffer, time, resolution, mouse, drawn: false };
  }

  // A value for a uniform of any float type: x, then y, the rest 0 (1 for the z of resolution)
  function fill(uniforms: Filled[], x: number, y: number, z = 0): void {
    for (const { location, type } of uniforms) {
      if (type === gl.FLOAT) gl.uniform1f(location, x);
      else if (type === gl.FLOAT_VEC2) gl.uniform2f(location, x, y);
      else if (type === gl.FLOAT_VEC3) gl.uniform3f(location, x, y, z);
      else if (type === gl.FLOAT_VEC4) gl.uniform4f(location, x, y, z, 0);
    }
  }

  function free(painters: Painter[]): void {
    for (const p of painters) {
      gl.deleteProgram(p.program);
      gl.deleteTexture(p.texture);
      gl.deleteFramebuffer(p.framebuffer);
    }
  }

  return {
    // The @paint of a scene, compiled. Throws the first GLSL error, named and placed.
    prepare(paints: PaintSource[]): PaintSet {
      const painters: Painter[] = [];
      try {
        for (const paint of paints) painters.push(painter(paint));
      } catch (error) {
        free(painters);
        throw error;
      }
      let lastMouse: [number, number] | null = null;
      return {
        texture: (name) => painters.find((p) => p.name === name)?.texture,
        animated: painters.some((p) => p.time.length > 0),
        pointer: painters.some((p) => p.mouse.length > 0),
        draw(seconds, mouse) {
          const moved = !lastMouse || lastMouse[0] !== mouse[0] || lastMouse[1] !== mouse[1];
          lastMouse = mouse;
          const due = painters.filter((p) => !p.drawn || p.time.length > 0 || (moved && p.mouse.length > 0));
          if (due.length === 0) return;
          gl.bindVertexArray(vertexArray);
          gl.viewport(0, 0, PAINT_SIZE, PAINT_SIZE);
          for (const p of due) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, p.framebuffer);
            gl.useProgram(p.program);
            fill(p.time, seconds, 0);
            fill(p.resolution, PAINT_SIZE, PAINT_SIZE, 1);
            fill(p.mouse, mouse[0], mouse[1]);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            p.drawn = true;
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          restoreVertexArray();
        },
        destroy: () => free(painters),
      };
    },
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vertexArray);
    },
  };
}
