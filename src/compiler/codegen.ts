import type { Token } from "./tokenizer";
import type { StyledInstance, Styles } from "./resolve";

// La forme GLSL de chaque type d'objet. "q" est le point, déjà déplacé.
const SHAPES: Record<string, string> = {
  cube: "sdRoundBox(q, vec3(0.5), 0.08)",
  sphere: "sdSphere(q, 0.5)",
  torus: "sdTorus(q, vec2(1.0, 0.28))",
};

// GLSL exige "1.0" et refuse "1" là où il attend un float
function glslFloat(n: number): string {
  const text = String(n);
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full))
    throw new Error(`Couleur invalide : #${hex}`);
  const channel = (start: number) =>
    Math.round((parseInt(full.slice(start, start + 2), 16) / 255) * 1000) /
    1000;
  return [channel(0), channel(2), channel(4)];
}

function readTranslate(value: Token[] | undefined): string {
  if (!value) return "vec3(0.0)";
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER")
      throw new Error(
        "translate attend trois nombres, comme : translate: 0 1 0;",
      );
    return token.value;
  });
  if (numbers.length !== 3)
    throw new Error(
      "translate attend trois nombres, comme : translate: 0 1 0;",
    );
  return `vec3(${numbers.map(glslFloat).join(", ")})`;
}

function readScale(value: Token[] | undefined): string {
  if (!value) return "1.0";
  const [token] = value;
  if (token.type !== "NUMBER")
    throw new Error("scale attend un nombre, comme : scale: 2.0;");
  return glslFloat(token.value);
}

function readColor(value: Token[] | undefined, fallback = "vec3(0.9)"): string {
  if (!value) return fallback;
  const [token] = value;
  if (value.length !== 1 || token.type !== "HASH") {
    throw new Error(
      "color attend une couleur hexadécimale, comme : color: #ff5a36;",
    );
  }
  return `vec3(${hexToRgb(token.value).map(glslFloat).join(", ")})`;
}

// ⬇️ TA MISSION : convertir un angle GSS en radians
export function readAngle(value: Token[]): number {
  const [token] = value;

  // Un seul token attendu
  if (value.length !== 1) {
    throw new Error("Un angle est attendu, comme : 70deg");
  }

  // Cas spécial : 0 sans unité est accepté, comme en CSS
  if (token.type === "NUMBER" && token.value === 0) {
    return 0;
  }

  // Tout le reste doit avoir une unité
  if (token.type !== "DIMENSION") {
    throw new Error("Un angle doit avoir une unité, comme : 70deg");
  }

  // Les unités
  if (token.unit === "deg") return (token.value * Math.PI) / 180;
  if (token.unit === "rad") return token.value;
  if (token.unit === "turn") return token.value * 2 * Math.PI;

  throw new Error(
    `Unité d'angle inconnue : "${token.unit}". Utilise deg, rad ou turn.`,
  );
}

// rotate-x fait tourner y et z, rotate-y fait tourner x et z, rotate-z fait tourner x et y
const ROTATIONS: [string, string][] = [
  ["rotate-x", "yz"],
  ["rotate-y", "xz"],
  ["rotate-z", "xy"],
];

function rotationLines(instance: StyledInstance): string[] {
  const lines: string[] = [];
  for (const [property, axes] of ROTATIONS) {
    const value = instance.styles[property];
    if (!value) continue; // pas de rotation sur cet axe
    const angle = readAngle(value);
    const rounded = Math.round(angle * 10000) / 10000;
    lines.push(`  q.${axes} *= rot(${glslFloat(rounded)});`);
  }
  return lines;
}

function label(instance: StyledInstance): string {
  const id = instance.id ? `#${instance.id}` : "";
  const classes = instance.classes.map((c) => `.${c}`).join("");
  return `${instance.tag}${id}${classes}`;
}

export function generateShader(
  instances: StyledInstance[],
  sceneStyles: Styles = {},
): string {
  const mapLines = instances.map((instance) => {
    const shape = SHAPES[instance.tag];
    if (!shape) {
      throw new Error(
        `Objet inconnu : "${instance.tag}". Disponibles : ${Object.keys(SHAPES).join(", ")}`,
      );
    }
    return [
      `  // ${label(instance)}`,
      `  q = p - ${readTranslate(instance.styles["translate"])};`,
      `  q *= ${readScale(instance.styles["scale"])};`,
      ...rotationLines(instance),
      `  res = opU(res, vec2(${shape}, ${glslFloat(instance.index)}));`,
    ].join("\n");
  });

  const colorLines = instances.map(
    (instance) =>
      `  if (id == ${glslFloat(instance.index)}) return ${readColor(instance.styles["color"])};  // ${label(instance)}`,
  );

  return TEMPLATE.replace("/*@MAP*/", mapLines.join("\n\n"))
    .replace("/*@COLORS*/", colorLines.join("\n"))
    .replace(
      "/*@FLOOR*/",
      readColor(sceneStyles["floor"], "vec3(0.91, 0.89, 0.86)"),
    )
    .replace(
      "/*@BACKGROUND*/",
      readColor(sceneStyles["background"], "vec3(0.03)"),
    );
}

// Le squelette du shader. Seules les parties /*@...*/ changent d'une scène à l'autre.
const TEMPLATE = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uCamera;
uniform float uDist;

out vec4 outColor;

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

// ----- Rotations -----
mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec2 opU(vec2 a, vec2 b) {
  return (a.x < b.x) ? a : b;
}

// ----- Généré par GSS -----
vec2 map(vec3 p) {
  vec2 res = vec2(p.y, 0.0);  // le sol : id 0
  vec3 q;

/*@MAP*/

  return res;
}

vec3 getColor(float id) {
/*@COLORS*/
  return /*@FLOOR*/;  // le sol
}
// ----- Fin du code généré -----

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

  vec3 target = vec3(0.0, 0.5, 0.0);
  float yaw = uCamera.x;
  float pitch = uCamera.y;
  vec3 ro = target + uDist * vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
  vec3 forward = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * forward);

  float t = 0.0;
  float id = 0.0;
  for (int i = 0; i < 100; i++) {
    vec2 res = map(ro + rd * t);
    id = res.y;
    t += res.x;
    if (res.x < 0.001 || t > 20.0) break;
  }

  vec3 col = /*@BACKGROUND*/;
    if (t < 20.0) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
    float diff = max(dot(n, lightDir), 0.0);
    col = getColor(id) * (0.1 + 0.9 * diff);
  }

  outColor = vec4(col, 1.0);
}
`;
