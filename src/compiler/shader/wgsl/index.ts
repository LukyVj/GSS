// Lower the restricted shader language emitted by GSS to WGSL. This is a typed
// parser, not a GLSL text substitution: expressions retain their types through
// scalar/vector promotion, comparisons, constructors and control flow. Arbitrary
// user GLSL is deliberately not accepted. Both targets share GSS's scene lowering.
type Expr = { code: string; type: string };
type Field = { name: string; type: string };
const TYPES: Record<string, string> = {
  void: "void", float: "f32", int: "i32", bool: "bool",
  vec2: "vec2<f32>", vec3: "vec3<f32>", vec4: "vec4<f32>",
  ivec2: "vec2<i32>", ivec3: "vec3<i32>", ivec4: "vec4<i32>",
  bvec2: "vec2<bool>", bvec3: "vec3<bool>", bvec4: "vec4<bool>",
  mat2: "mat2x2<f32>", sampler2D: "texture_2d<f32>",
};
const PRECEDENCE: Record<string, number> = {
  "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, ">": 4, "<=": 4, ">=": 4,
  "+": 5, "-": 5, "*": 6, "/": 6, "%": 6,
};
const scalar = (type: string) => type.match(/<(\w+)>/)?.[1] ?? type;
const vector = (type: string) => type.startsWith("vec");
const nameOf = (name: string) => `g_${name}`; // avoids WGSL's reserved identifiers

export const WGSL_VERTEX = `@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  let p = vec2<f32>(f32((index << 1u) & 2u), f32(index & 2u));
  return vec4<f32>(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Stable, portable uniform layout. Each hover scalar occupies one 16-byte slot.
// Runtime code consumes this contract without importing the compiler.
export function generateWGSL(source: string): string {
  return new Lowering(source).run();
}

class Lowering {
  private tokens: string[];
  private pos = 0;
  private symbols = new Map<string, string>();
  private functions = new Map<string, { result: string; args: string[] }>();
  private structs = new Map<string, Field[]>();
  private uniforms = new Map<string, string>();
  private hover = 0;
  private properties = 0;
  private starts = 0; // uStart[]: the states that start an animation (decision 141)
  private serial = 0;

  constructor(source: string) {
    // GSS emits object-like macros only: BACKGROUND background(rd) for a background that is
    // computed (decision 81), LIGHT_DIR lightDirection() for a sun set from JS (decision 105).
    // Each one is replaced by its value, word by word, before the source is read.
    for (const [, name, value] of source.matchAll(/^#define (\w+) (.+)$/gm))
      source = source.replace(new RegExp(`(?<!#define )\\b${name}\\b`, "g"), value);
    const clean = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|^#[^\n]*/gm, " ");
    const pattern = /\s+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|\+\+|--|\+=|-=|\*=|\/=|==|!=|<=|>=|&&|\|\||[{}()[\],;.?:+\-*/%!=<>]/gy;
    this.tokens = [];
    let at = 0;
    while (at < clean.length) {
      pattern.lastIndex = at;
      const match = pattern.exec(clean);
      if (!match) throw new Error(`WGSL lowering: unsupported shader token at ${clean.slice(at, at + 40)}`);
      at = pattern.lastIndex;
      if (!/^\s+$/.test(match[0])) this.tokens.push(match[0]);
    }
    // Signatures are known before expressions are lowered (forward calls included).
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] === "struct") this.structs.set(this.tokens[i + 1], []);
      // type name ( : not vec3((…) inside an expression, which calc() can write (decision 105)
      if (this.tokens[i + 2] === "(" && this.isType(this.tokens[i]) && /^[A-Za-z_]\w*$/.test(this.tokens[i + 1])) {
        const args: string[] = [];
        let j = i + 3;
        while (this.tokens[j] !== ")") {
          args.push(this.type(this.tokens[j]));
          j += 2;
          if (this.tokens[j] === ",") j++;
        }
        if (this.tokens[j + 1] === "{") this.functions.set(this.tokens[i + 1], { result: this.type(this.tokens[i]), args });
      }
    }
    this.symbols.set("gl_FragCoord", "vec4<f32>");
  }
  private peek() { return this.tokens[this.pos]; }
  private take() { return this.tokens[this.pos++]; }
  private accept(token: string) { if (this.peek() !== token) return false; this.pos++; return true; }
  private expect(token: string) {
    if (!this.accept(token)) throw new Error(`WGSL lowering: expected ${token}, got ${this.peek()} near ${this.tokens.slice(this.pos - 6, this.pos + 6).join(" ")}`);
  }
  private isType(token: string) { return token in TYPES || this.structs.has(token); }
  private type(token: string) {
    const type = TYPES[token] ?? (this.structs.has(token) ? nameOf(token) : undefined);
    if (!type) throw new Error(`WGSL lowering: unknown type ${token}`);
    return type;
  }

  run(): string {
    const declarations: string[] = [];
    while (this.pos < this.tokens.length) {
      if (this.accept("precision")) { while (!this.accept(";")) this.take(); continue; }
      if (this.accept("uniform")) {
        const type = this.type(this.take());
        const name = this.take();
        this.uniforms.set(name, type);
        this.symbols.set(name, type);
        if (this.accept("[")) {
          const size = Number(this.take());
          if (name === "uProperties") this.properties = size; // @property (decision 105)
          else if (name === "uStart") this.starts = size; // decision 141
          else this.hover = size;
          this.expect("]");
        }
        this.expect(";");
        continue;
      }
      if (this.accept("out")) {
        this.symbols.set(this.take() === "vec4" ? this.take() : "", "vec4<f32>");
        this.expect(";");
        continue;
      }
      if (this.accept("struct")) {
        const name = this.take();
        const fields: Field[] = [];
        this.expect("{");
        while (!this.accept("}")) {
          const type = this.type(this.take()); const field = this.take(); this.expect(";");
          fields.push({ name: field, type });
        }
        this.expect(";"); this.structs.set(name, fields);
        declarations.push(`struct ${nameOf(name)} {\n${fields.map(f => `  ${nameOf(f.name)}: ${f.type},`).join("\n")}\n}`);
        continue;
      }
      const constant = this.accept("const");
      const type = this.type(this.take());
      const name = this.take();
      if (this.accept("(")) declarations.push(this.function(type, name));
      else declarations.push(this.declaration(type, name, constant, true));
    }
    const textures = [...this.uniforms].filter(([, type]) => type === TYPES.sampler2D);
    return [
      // scroll() and view() (decision 96): after hover, so that no other offset moves;
      // @property (decision 105) after them
      `struct GssUniforms {\n  resolutionTime: vec4<f32>,\n  cameraDistanceRatio: vec4<f32>,\n  pick: vec4<f32>,\n  hover: array<vec4<f32>, ${Math.max(1, this.hover)}>,\n${this.uniforms.has("uTimeline") ? "  timeline: vec4<f32>,\n" : ""}${this.properties ? `  properties: array<vec4<f32>, ${this.properties}>,\n` : ""}${this.starts ? `  start: array<vec4<f32>, ${this.starts}>,\n` : ""}}`,
      "@group(0) @binding(0) var<uniform> gss: GssUniforms;",
      ...(textures.length ? ["@group(0) @binding(1) var gssSampler: sampler;"] : []),
      ...textures.map(([name], i) => `@group(0) @binding(${i + 2}) var ${nameOf(name)}: texture_2d<f32>;`),
      "var<private> g_gl_FragCoord: vec4<f32>;",
      "var<private> g_outColor: vec4<f32>;",
      ...declarations,
      WGSL_VERTEX,
      `@fragment\nfn fragmentMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {\n  g_gl_FragCoord = vec4<f32>(position.x, gss.resolutionTime.y - position.y, position.zw);\n  g_main();\n  return g_outColor;\n}`,
      "",
    ].join("\n\n");
  }

  private function(type: string, name: string): string {
    const outer = new Map(this.symbols);
    const params: string[] = [], copies: string[] = [];
    if (!this.accept(")")) {
      do {
        const t = this.type(this.take()); const n = this.take();
        this.symbols.set(n, t);
        // WGSL parameters are immutable; GLSL parameters are mutable local copies.
        if (t === TYPES.sampler2D) params.push(`${nameOf(n)}: ${t}`);
        else { params.push(`${nameOf(n)}_arg: ${t}`); copies.push(`var ${nameOf(n)} = ${nameOf(n)}_arg;`); }
      } while (this.accept(","));
      this.expect(")");
    }
    this.expect("{");
    const body: string[] = [...copies];
    while (!this.accept("}")) body.push(this.statement());
    this.symbols = outer;
    return `fn ${nameOf(name)}(${params.join(", ")})${type === "void" ? "" : ` -> ${type}`} {\n${body.map(s => s.split("\n").map(l => `  ${l}`).join("\n")).join("\n")}\n}`;
  }

  private declaration(type: string, first: string, constant: boolean, global = false, end = ";"): string {
    const lines: string[] = [];
    let name = first;
    do {
      this.symbols.set(name, type);
      const value = this.accept("=") ? this.promote(this.expression(), type).code : undefined;
      lines.push(`${constant ? (global ? "const" : "let") : (global ? "var<private>" : "var")} ${nameOf(name)}: ${type}${value ? ` = ${value}` : ""};`);
      if (!this.accept(",")) break;
      name = this.take();
    } while (true);
    this.expect(end);
    return lines.join("\n");
  }
  private statement(): string {
    if (this.accept("{")) {
      const before = new Map(this.symbols); const lines: string[] = [];
      while (!this.accept("}")) lines.push(this.statement());
      this.symbols = before;
      return `{\n${lines.join("\n")}\n}`;
    }
    if (this.accept("if")) {
      this.expect("("); const condition = this.expression(); this.expect(")");
      const yes = this.blockStatement();
      return `if (${condition.code}) ${yes}${this.accept("else") ? ` else ${this.blockStatement()}` : ""}`;
    }
    if (this.accept("for")) {
      const before = new Map(this.symbols);
      this.expect("("); const type = this.type(this.take()); const name = this.take();
      const init = this.declaration(type, name, false);
      const condition = this.expression(); this.expect(";"); const increment = this.assignment(false); this.expect(")");
      const body = this.blockStatement(); this.symbols = before;
      return `for (${init.slice(0, -1)}; ${condition.code}; ${increment}) ${body}`;
    }
    if (this.accept("return")) {
      const value = this.peek() === ";" ? "" : ` ${this.expression().code}`;
      this.expect(";"); return `return${value};`;
    }
    if (this.peek() === "break" || this.peek() === "continue") { const s = this.take(); this.expect(";"); return `${s};`; }
    const constant = this.accept("const");
    if (this.isType(this.peek()) && this.tokens[this.pos + 2] !== "(") {
      const type = this.type(this.take()); const name = this.take();
      return this.declaration(type, name, constant);
    }
    if (constant) throw new Error("WGSL lowering: malformed constant");
    return this.assignment();
  }
  private blockStatement() { const s = this.statement(); return s.startsWith("{") ? s : `{ ${s} }`; }

  private assignment(semicolon = true): string {
    const left = this.expression();
    let result = left.code;
    if (this.peek() === "++" || this.peek() === "--") result += this.take();
    else if (["=", "+=", "-=", "*=", "/="].includes(this.peek())) {
      const operator = this.take(); const right = this.expression();
      const value = operator === "=" ? this.promote(right, left.type) : this.binary(operator[0], left, right);
      result = `${left.code} = ${value.code}`;
      // Portable WGSL cannot write multi-component swizzles. Evaluate once, then
      // scatter components, including row-vector × matrix rotations.
      const swizzle = left.code.match(/^(.*)\.([xyzwrgba]{2,4})$/);
      if (swizzle) {
        const temp = `gssTemp${this.serial++}`;
        result = `let ${temp} = ${value.code};\n${[...swizzle[2]].map((c, i) => `${swizzle[1]}.${c} = ${temp}[${i}];`).join("\n")}`;
        if (semicolon) { this.expect(";"); return result; }
      }
    }
    if (semicolon) this.expect(";");
    return result + (semicolon ? ";" : "");
  }

  private expression(min = 0): Expr {
    let left = this.primary();
    while (PRECEDENCE[this.peek()] !== undefined && PRECEDENCE[this.peek()] >= min) {
      const operator = this.take(); const right = this.expression(PRECEDENCE[operator] + 1);
      left = this.binary(operator, left, right);
    }
    if (min === 0 && this.accept("?")) {
      const yes = this.expression(); this.expect(":"); const no = this.expression();
      const type = this.common(yes.type, no.type);
      // Generated ternaries are side-effect-free numeric/bool expressions.
      left = { code: `select(${this.promote(no, type).code}, ${this.promote(yes, type).code}, ${left.code})`, type };
    }
    return left;
  }
  private primary(): Expr {
    const token = this.take();
    let expr: Expr;
    if (["-", "+", "!"].includes(token)) {
      const inner = this.primary(); expr = { code: token === "+" ? inner.code : `(${token}${inner.code})`, type: inner.type };
    } else if (token === "(") { expr = this.expression(); this.expect(")"); expr = { ...expr, code: `(${expr.code})` }; }
    else if (/^(\d|\.)/.test(token)) expr = { code: token, type: /[.eE]/.test(token) ? "f32" : "abstract-int" };
    else if (token === "true" || token === "false") expr = { code: token, type: "bool" };
    else if (this.accept("(")) {
      const args: Expr[] = [];
      if (!this.accept(")")) { do { args.push(this.expression()); } while (this.accept(",")); this.expect(")"); }
      expr = this.call(token, args);
    } else {
      {
        const type = this.symbols.get(token);
        if (!type) throw new Error(`WGSL lowering: unknown identifier ${token}`);
        const uniform: Record<string, string> = {
          iResolution: "gss.resolutionTime.xyz", iTime: "gss.resolutionTime.w",
          uCamera: "gss.cameraDistanceRatio.xy", uDist: "gss.cameraDistanceRatio.z", uRatio: "gss.cameraDistanceRatio.w",
          uPick: "gss.pick.xy", uPicking: "(gss.pick.z != 0.0)", uHover: "gss.hover", uTimeline: "gss.timeline", uProperties: "gss.properties", uStart: "gss.start",
        };
        expr = { code: this.uniforms.has(token) ? uniform[token] ?? nameOf(token) : nameOf(token), type };
      }
    }
    while (true) {
      if (this.accept(".")) {
        const field = this.take();
        const struct = [...this.structs].find(([name]) => nameOf(name) === expr.type)?.[1];
        const type = struct ? struct.find(f => f.name === field)?.type : (field.length === 1 ? scalar(expr.type) : `vec${field.length}<${scalar(expr.type)}>`);
        if (!type) throw new Error(`WGSL lowering: unknown field ${field}`);
        expr = { code: `${expr.code}.${struct ? nameOf(field) : field}`, type };
      } else if (this.accept("[")) {
        const index = this.expression(); this.expect("]");
        const hover = expr.code === "gss.hover" || expr.code === "gss.start"; // one float per 16-byte slot
        expr = { code: `${expr.code}[${index.code}]${hover ? ".x" : ""}`, type: hover ? "f32" : scalar(expr.type) };
      } else break;
    }
    return expr;
  }
  private common(a: string, b: string): string {
    if (a === b) return a;
    if (vector(a)) return a;
    if (vector(b)) return b;
    if (a === "abstract-int") return b;
    if (b === "abstract-int") return a;
    return a;
  }
  private promote(expr: Expr, type: string): Expr {
    if (expr.type === type || expr.type === "abstract-int") return { ...expr, type };
    if (vector(type) && !vector(expr.type)) return { code: `${type}(${expr.code})`, type };
    return { code: `${type}(${expr.code})`, type };
  }
  private binary(op: string, left: Expr, right: Expr): Expr {
    if (op === "&&" || op === "||") return { code: `(${left.code} ${op} ${right.code})`, type: "bool" };
    const comparison = ["==", "!=", "<", ">", "<=", ">="].includes(op);
    const matrix = left.type.startsWith("mat") || right.type.startsWith("mat");
    const type = matrix ? (vector(left.type) ? left.type : right.type) : this.common(left.type, right.type);
    const a = matrix ? left.code : this.promote(left, type).code;
    const b = matrix ? right.code : this.promote(right, type).code;
    let code = `(${a} ${op} ${b})`;
    if (comparison && vector(type)) code = `${op === "!=" ? "any" : "all"}(${code})`;
    return { code, type: comparison ? "bool" : type };
  }
  private call(name: string, args: Expr[]): Expr {
    const codes = () => args.map(a => a.code).join(", ");
    if (name in TYPES) {
      const type = this.type(name);
      if (type.startsWith("mat")) return { code: `${type}(vec2<f32>(${args[0].code}, ${args[1].code}), vec2<f32>(${args[2].code}, ${args[3].code}))`, type };
      return { code: `${type}(${codes()})`, type };
    }
    if (this.structs.has(name)) {
      const fields = this.structs.get(name)!;
      return { code: `${nameOf(name)}(${args.map((a, i) => this.promote(a, fields[i].type).code).join(", ")})`, type: nameOf(name) };
    }
    const signature = this.functions.get(name);
    if (signature) return { code: `${nameOf(name)}(${args.map((a, i) => this.promote(a, signature.args[i]).code).join(", ")})`, type: signature.result };
    if (name === "texture") {
      const uv = args[0].code.startsWith("g_uInput") ? `vec2<f32>(${args[1].code}.x, 1.0 - ${args[1].code}.y)` : args[1].code;
      return { code: `textureSampleLevel(${args[0].code}, gssSampler, ${uv}, 0.0)`, type: "vec4<f32>" };
    }
    if (name === "textureSize") return { code: `vec2<i32>(textureDimensions(${codes()}))`, type: "vec2<i32>" };
    if (name === "texelFetch") {
      const coord = args[0].code.startsWith("g_uInput")
        ? `vec2<i32>(${args[1].code}.x, i32(textureDimensions(${args[0].code}).y) - 1 - ${args[1].code}.y)` : args[1].code;
      return { code: `textureLoad(${args[0].code}, ${coord}, ${args[2].code})`, type: "vec4<f32>" };
    }
    if (name === "not") return { code: `(!${args[0].code})`, type: args[0].type };
    if (["all", "any"].includes(name)) return { code: `${name}(${codes()})`, type: "bool" };
    if (["length", "dot", "distance"].includes(name)) return { code: `${name}(${codes()})`, type: "f32" };
    if (["min", "max", "clamp", "mix", "smoothstep", "step", "pow", "mod"].includes(name)) {
      const type = args.reduce((t, a) => this.common(t, a.type), args[0].type);
      args = args.map(a => this.promote(a, type));
      if (name === "mod") return { code: `(${args[0].code} - ${args[1].code} * floor(${args[0].code} / ${args[1].code}))`, type };
      return { code: `${name}(${codes()})`, type };
    }
    // atan(y, x) in GLSL is atan2(y, x) in WGSL (conic-gradient(), decision 98)
    if (name === "atan") return { code: `${args.length === 2 ? "atan2" : "atan"}(${codes()})`, type: args[0].type };
    if (["abs", "sign", "floor", "ceil", "round", "trunc", "fract", "sqrt", "exp", "log", "sin", "cos", "tan", "asin", "acos", "degrees", "radians", "normalize", "reflect", "refract", "cross"].includes(name))
      return { code: `${name}(${codes()})`, type: args[0].type };
    throw new Error(`WGSL lowering: unsupported function ${name}`);
  }
}
