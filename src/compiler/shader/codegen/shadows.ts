import type { Token } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";

// shadows (decision 115): scene { shadows: none | hard | soft }. Each point that main()
// shades sends a ray toward each light, the sun and the lights of @scene; an object on the
// way keeps that light from it. soft draws a penumbra that grows with the distance to the
// object that casts it (Inigo Quilez's soft shadows); hard cuts it sharp. The reflections
// and the refractions do without (diffuseOpen(), lights.ts).

export type Shadows = "hard" | "soft" | null;

export function readShadows(value: Token[] | undefined): Shadows {
  if (!value) return null;
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && ["none", "hard", "soft"].includes(token.value))
    return token.value === "none" ? null : (token.value as "hard" | "soft");
  throw errorAt(value, "shadows expects none, hard or soft, like: shadows: soft;");
}

// How sharp the penumbra of soft shadows is: higher is sharper
const SOFTNESS = "12.0";

// shadow(): how much of a light reaches ro along rd, up to far, from 0 behind an object to 1.
// holes: the scene has holes (mask-image), which let the light through; the objects with
// holes are skins on the way (shell(), masks.ts).
export function shadowFunction(mode: "hard" | "soft", holes: boolean): string {
  const soft = mode === "soft";
  const head = soft
    ? [
        "// shadows: soft: how much of a light reaches ro along rd, up to far, from 0 behind an",
        "// object to 1; the penumbra grows with the distance to the object that casts it",
      ]
    : ["// shadows: hard: whether a light reaches ro along rd, up to far: 0 behind an object, 1 if not"];
  if (!holes)
    return [
      ...head,
      "float shadow(vec3 ro, vec3 rd, float far) {",
      ...(soft ? ["  float lit = 1.0;"] : []),
      "  float t = 0.02;",
      "  for (int i = 0; i < 64; i++) {",
      "    float h = map(ro + rd * t).x;",
      ...(soft
        ? [`    lit = min(lit, ${SOFTNESS} * h / t);`, "    t += clamp(h, 0.01, 0.5);", "    if (lit < 0.001 || t > far) break;"]
        : ["    if (h < 0.001) return 0.0;", "    t += h;", "    if (t > far) break;"]),
      "  }",
      soft ? "  return clamp(lit, 0.0, 1.0);" : "  return 1.0;",
      "}",
    ].join("\n");
  // Through the holes, like march(): a surface stops the light if the mask covers it
  return [
    ...head,
    "// The holes of mask-image let the light through, and an object with holes casts a sharp",
    "// shadow: a ray through a hole passes right by its skin.",
    "float shadow(vec3 ro, vec3 rd, float far) {",
    "  float lit = 1.0;",
    "  float t = 0.02;",
    "  throughHoles = true;",
    "  for (int i = 0; i < 100; i++) {",
    "    vec3 p = ro + rd * t;",
    "    vec2 res = map(p);",
    "    float h = abs(res.x);",
    "    if (h < 0.001) {",
    "      if (maskAlpha(res.y, p) >= 0.5) {  // the surface is there",
    "        lit = 0.0;",
    "        break;",
    "      }",
    "      h = 0.002;  // a hole: the light goes through",
    // A ray through a hole passes right by the skin: an object with holes casts a sharp shadow
    ...(soft ? ["    } else if (!hasHoles(res.y)) {", `      lit = min(lit, ${SOFTNESS} * h / t);`, "    }"] : ["    }"]),
    "    t += h;",
    "    if (lit < 0.001 || t > far) break;",
    "  }",
    "  throughHoles = false;",
    "  return clamp(lit, 0.0, 1.0);",
    "}",
  ].join("\n");
}
