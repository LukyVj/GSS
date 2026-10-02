// filter in the shader: the filters that read only their own pixel end the shader
// (decision 83); on objects, on their own pixels, and their layer in the alpha for
// the passes (decision 84)
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { buildPasses, objectFilters, readSteps } from "../../features/filter";
import { glslFloat, label } from "./glsl";

export function filterCode(instances: StyledInstance[], sceneStyles: Styles) {
  const objects = objectFilters(instances);
  const { sceneLines } = buildPasses(
    objects.layers,
    sceneStyles["filter"] ? readSteps(sceneStyles["filter"]) : [],
  );
  const byIndex = new Map(instances.map((instance) => [instance.index, instance]));
  const objectFilter =
    objects.pixel.size > 0
      ? [
          "// filter on objects: the filters that read only their own pixel, on the pixels of each object",
          "vec3 objectFilter(float id, vec3 c) {",
          ...[...objects.pixel].flatMap(([index, lines]) => [
            `  if (id == ${glslFloat(index)}) {  // ${label(byIndex.get(index)!)}`,
            ...lines.map((l) => `    ${l}`),
            "    return c;",
            "  }",
          ]),
          "  return c;",
          "}",
        ].join("\n")
      : "";
  const objectLayer =
    objects.layers.length > 0
      ? [
          "// filter on objects: the layer of each object with a blur() or a bloom(), carried in the alpha",
          "float objectLayer(float id) {",
          ...[...objects.layerOf].map(
            ([index, layer]) => `  if (id == ${glslFloat(index)}) return ${glslFloat(layer)} / 255.0;  // ${label(byIndex.get(index)!)}`,
          ),
          "  return 0.0;",
          "}",
        ].join("\n")
      : "";
  const filterLines = [
    ...(objectFilter ? ["  if (t < MAX_DIST) col = objectFilter(id, col);"] : []),
    ...(sceneLines.length
      ? ["  // filter: the pixel filters, before the passes (if any)", "  vec3 c = col;", ...sceneLines.map((l) => `  ${l}`), "  col = c;"]
      : []),
    "",
  ].join("\n");
  const alpha = objectLayer ? "t < MAX_DIST ? objectLayer(id) : 0.0" : "1.0";
  const filterFunctions = [objectFilter, objectLayer].filter(Boolean).join("\n\n");
  return { objectFilter, filterLines, alpha, filterFunctions };
}
