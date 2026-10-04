// view: distance (decision 131): the scene, with the isolines of its distance field over it.
// The field is the one the shader marches through: map() without the floor, the bounds of
// path, prism and lathe included.

// map() becomes mapObjects(), the objects alone; map() adds the floor to them
const OBJECTS = "vec2 map(vec3 p) {\n  vec2 res = vec2(1e10, 0.0); // nothing yet";
const FLOOR = "  res = opU(res, vec2(/*@FLOOR_DISTANCE*/, 0.0)); // the floor: id 0\n  return res;\n}";

export function withObjectsAlone(template: string): string {
  return template
    .replace(OBJECTS, "vec2 mapObjects(vec3 p) {\n  vec2 res = vec2(1e10, 0.0); // nothing yet")
    .replace(
      FLOOR,
      `  return res;
}

// The scene: the objects, then the floor (view: distance measures the objects alone)
vec2 map(vec3 p) {
  return opU(mapObjects(p), vec2(/*@FLOOR_DISTANCE*/, 0.0)); // the floor: id 0
}`,
    );
}

// The isolines: one every 0.25 from the objects, fainter as they go away, like the rings
// of the GSS mark. They lie on the plane that faces the camera through its target, and are
// drawn where that plane is in front of what the ray meets (t). A pixel on that plane is
// as wide everywhere, which gives lines one pixel wide without derivatives.
export const ISOLINES = `// view: distance: the isolines of the distance to the objects, over the scene
vec3 isolines(vec3 col, vec3 ro, vec3 rd, vec3 target, vec3 forward, float t) {
  float depth = dot(target - ro, forward); // from the camera to the plane
  float along = depth / dot(rd, forward); // the same, along the ray
  if (along <= 0.0 || along >= t) return col;
  float d = mapObjects(ro + rd * along).x;
  float ring = floor(d / 0.25 + 0.5); // the nearest line: d = 0.25, 0.5, 0.75…
  if (ring < 1.0) return col;
  float pixel = depth / (1.5 * iResolution.y); // the width of a pixel on the plane
  float line = 1.0 - smoothstep(0.5 * pixel, 1.5 * pixel, abs(d - ring * 0.25));
  // Light lines on a dark scene, dark lines on a light one
  vec3 ink = dot(col, vec3(0.2126, 0.7152, 0.0722)) > 0.5 ? vec3(0.04, 0.04, 0.05) : vec3(0.91, 0.9, 0.88);
  return mix(col, ink, line * 0.34 * pow(0.75, ring - 1.0));
}`;

// In main(), after the filters of the scene: the lines are not part of the picture
export const ISOLINES_CALL = "  col = isolines(col, ro, rd, target, forward, t);\n";
