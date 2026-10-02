// The code generator: a styled scene → one GLSL fragment shader.
// generateShader() fills TEMPLATE; each part of the shader comes from its own file:
//   glsl.ts        numbers, vectors, labels, used() (only the GLSL a scene calls)
//   read.ts        GSS values → GLSL (translate, size, color, light, rotations)
//   library.ts     the GLSL functions of shapes, paths, easings, operations, materials
//   shading.ts     the lighting of metal, jelly and glass
//   template.ts    the skeleton of the shader, and the picking pass
//   shapes.ts      the shapes and their bounding radius
//   operations.ts  union, subtract, intersect, blend
//   materials.ts   material: matte(), metal(), jelly(), glass() and their keywords
//   animation.ts   @keyframes, easings and :hover as GLSL expressions
//   transforms.ts  the moves into a node's space, and animate() (decision 75)
//   bounds.ts      the sphere of the scene and bounds on groups (decisions 76, 77)
//   textures.ts    texture, ::face() (decision 59)
//   gradients.ts   gradients in the background and on objects (decisions 81, 82)
//   filters.ts     filter on the scene and on objects (decisions 83, 84)
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { readNumber } from "../../values/values";
import { sceneTextures } from "../../features/textures";
import { isGradient } from "../gradient";
import { glslFloat, moreLines, round, section, used, label, vec3, type Hover } from "./glsl";
import { EASINGS, MAP_HELPERS, MATERIALS, PATH_HELPERS, SHADE_CALLS, SHAPE_FUNCTIONS } from "./library";
import { SHADING } from "./shading";
import { PICK_OUTPUT, PICK_PIXEL, TEMPLATE } from "./template";
import { readColor, readLight, readScale, readTranslate } from "./read";
import { readOperation, SMOOTH } from "./operations";
import { BOUNDED, SHAPES, type ShapeContext } from "./shapes";
import { textureCode } from "./textures";
import { backgroundCode, gradientCode, objectGradient } from "./gradients";
import { readMaterial } from "./materials";
import { activeSlots, hoverSlots, hoverValue, useTimelines } from "./animation";
import { sceneTimelines } from "../../features/timeline";
import { animateCode, createHoisted, hoist, rotationLines, transformLines } from "./transforms";
import { enclosing, groupBounds, objectSphere, sceneMiss, type Sphere } from "./bounds";
import { GRAIN } from "../../features/filter";
import { filterCode } from "./filters";

export { activeSlots, hoverSlots } from "./animation";
export { shapeNames, shapeRadius } from "./shapes";

export function generateShader(
  instances: StyledInstance[],
  sceneStyles: Styles = {},
  keyframes: Keyframes[] = [],
): string {
  // scroll() and view(): one component of uTimeline each (decision 96)
  const timelines = sceneTimelines(
    instances.flatMap((instance) => [...instance.groupStyles, instance.styles]),
  );
  useTimelines(timelines);
  const hovers = hoverSlots(instances);
  const actives = activeSlots(instances);
  // uHover[]: the hover slots, then the :active ones (decision 95)
  const slots = [...hovers, ...actives];
  // The hover and pressed states of one object, or undefined when it has neither
  const hoverOf = (instance: StyledInstance): Hover | undefined => {
    const hover = hovers.indexOf(instance);
    const active = actives.indexOf(instance);
    const layers: Hover = [
      ...(hover === -1 ? [] : [{ styles: instance.hoverStyles, slot: hover, state: ":hover" as const }]),
      ...(active === -1
        ? []
        : [{ styles: instance.activeStyles, slot: hovers.length + active, state: ":active" as const }]),
    ];
    return layers.length > 0 ? layers : undefined;
  };
  const context: ShapeContext = { functions: new Map() };
  const hoisted = createHoisted(); // the animated values of map(): computed by animate()
  const spheres: (Sphere | null)[] = []; // each object's, for the sphere of the scene

  // What an object must beat to matter. With only plain unions, map() is a plain min():
  // an object further than the floor can never be the nearest, so the floor counts
  // from the start. Otherwise the order of the operations matters, and only the
  // objects already combined count (res.x).
  const plainUnion = (instance: StyledInstance) =>
    readOperation(instance.styles["operation"]) === "opU" &&
    readNumber(instance.styles["blend"], "blend", 0, true) === 0;
  const floorStyle = sceneStyles["floor"];
  const hasFloor = !(
    floorStyle?.length === 1 &&
    floorStyle[0].type === "IDENT" &&
    floorStyle[0].value === "none"
  );
  const nearest =
    hasFloor && instances.every(plainUnion) ? "min(res.x, p.y)" : "res.x";

  const mapLines = instances.map((instance) => {
    const shape = SHAPES[instance.tag];
    if (!shape) {
      throw new Error(
        `Unknown object: "${instance.tag}". Available: ${Object.keys(SHAPES).join(", ")}`,
      );
    }
    const { code: shapeCode, radius } = shape(instance.styles, context);
    spheres.push(radius === null ? null : objectSphere(radius, instance, keyframes, hoverOf(instance)));
    // Every node from the outside in: the groups, then the object itself
    const nodes = [...instance.groupStyles, instance.styles];
    // q was divided by every scale, so the distance is multiplied back by all of them
    // :hover moves the object itself, the last node, never its groups
    const hover = hoverOf(instance);
    const last = nodes.length - 1;
    const scales = nodes.map((styles, n) =>
      hoist(
        hoisted,
        "float",
        hoverValue(
          styles,
          keyframes,
          "scale",
          readScale,
          n === last ? hover : undefined,
        ),
      ),
    );

    const operation = readOperation(instance.styles["operation"]);
    const blend = readNumber(instance.styles["blend"], "blend", 0, true);
    const shapeValue = `vec2(${shapeCode} * ${scales.join(" * ")}, ${glslFloat(instance.index)})`;

    const combine =
      blend > 0
        ? `${SMOOTH[operation]}(res, ${shapeValue}, ${glslFloat(blend)})`
        : `${operation}(res, ${shapeValue})`;

    const groupLines = instance.groupStyles.flatMap((styles) =>
      transformLines(styles, keyframes, undefined, hoisted),
    );

    // Only a costly shape is worth the test, and only a plain union can be skipped:
    // a subtraction, an intersection or a blend changes the result even when far
    if (radius === null || !BOUNDED.has(instance.tag) || !plainUnion(instance)) {
      return [
        ` // ${label(instance)}`,
        `  q = p;`,
        ...groupLines,
        ...transformLines(instance.styles, keyframes, hover, hoisted),
        ` res = ${combine};`,
      ].join("\n");
    }

    // The bounding sphere: tested after the object's own translate and before its
    // rotations (a sphere looks the same from every side), so a skipped object costs
    // neither its rotations nor its shape. Its distance, back in scene units: the
    // object's own scale grows the sphere, the groups' scales grow everything.
    const ownScale = scales[last];
    const groupScales = scales.slice(0, last);
    // A little bigger, rounded up: the GPU computes in 32-bit floats, and a sphere
    // smaller than the shape would skip an object that touches the ray
    const safeRadius = Math.ceil((radius + 0.001) * 10000) / 10000;
    const sphere = `(length(q) - ${glslFloat(safeRadius)} * ${ownScale})${groupScales.map((scale) => ` * ${scale}`).join("")}`;
    return [
      ` // ${label(instance)}`,
      `  q = p;`,
      ...groupLines,
      `  q -= ${hoist(hoisted, "vec3", hoverValue(instance.styles, keyframes, "translate", readTranslate, hover))};`,
      `  if (${sphere} <= ${nearest}) { // its bounding sphere could be the nearest`,
      ...rotationLines(instance.styles, keyframes, hover, hoisted).map((line) => `  ${line}`),
      `    q /= ${ownScale};`,
      `   res = ${combine};`,
      `  }`,
    ].join("\n");
  });

  // The objects painted with a gradient (decision 82)
  const painted: { instance: StyledInstance; gradient: Token[] }[] = [];
  const materialLines = instances.map((instance) => {
    const { gradient, styles } = objectGradient(instance, keyframes, hoverOf(instance));
    if (gradient) painted.push({ instance, gradient });
    instance = gradient ? { ...instance, styles } : instance;
    const color = hoverValue(
      instance.styles,
      keyframes,
      "color",
      readColor,
      gradient ? undefined : hoverOf(instance), // a gradient's color does not change on :hover
    );
    const material = readMaterial(instance.styles["material"], color);
    return `  if (id == ${glslFloat(instance.index)}) return ${material};  // ${label(instance)}`;
  });

  // floor: none moves the floor infinitely far away
  const floor = sceneStyles["floor"];
  const noFloor =
    floor?.length === 1 &&
    floor[0].type === "IDENT" &&
    floor[0].value === "none";

  // ambient: the share of light received in the shadow; the sun gives the rest
  const ambient = readNumber(sceneStyles["ambient"], "ambient", 0.1, true);
  if (ambient > 1) {
    throw errorAt(
      sceneStyles["ambient"],
      "ambient expects a number between 0 and 1, like: ambient: 0.3;",
    );
  }
  const direct = round(1 - ambient);

  // The functions of the shapes, each with its own name
  const functions = [...context.functions]
    .map(([code, name]) => code.replaceAll("NAME", name))
    .join("\n\n");

  const map = groupBounds(instances, mapLines, spheres, plainUnion, nearest);
  // A blend adds a fillet up to its distance around the objects it joins
  const maxBlend = Math.max(0, ...instances.map((i) => readNumber(i.styles["blend"], "blend", 0, true)));
  const known = spheres.every((s): s is Sphere => s !== null) && spheres.length > 0;
  const scene = known ? enclosing(spheres as Sphere[]) : null;
  const sceneSphereCode = scene
    ? sceneMiss(scene.center, scene.radius + maxBlend + 0.01, hasFloor)
    : "";
  const animate = animateCode(hoisted);
  const textures = textureCode(instances, keyframes, hoverOf);
  // filter on the scene (decision 83) and on objects (decision 84)
  const { objectFilter, filterLines, alpha, filterFunctions } = filterCode(instances, sceneStyles);
  const textured = new Set(
    instances.filter(
      (instance) =>
        sceneTextures([instance]).length > 0,
    ),
  );
  const gradients = gradientCode(painted, textured, keyframes, hoverOf);
  const materials = materialLines.join("\n");
  // One line in main() for each material the scene uses
  const shadeCalls = Object.entries(SHADE_CALLS)
    .filter(([kind]) => materials.includes(kind + "("))
    .map(([, line]) => line)
    .join("\n");

  return (
    TEMPLATE.replace(
      "/*@EASINGS*/",
      section(
        "// The easings of the animations: only those the scene uses",
        used(
          EASINGS,
          [map, animate, textures.functions, gradients.functions, textures.call, materials].join("\n"),
        ),
      ),
    )
      .replace("/*@SHAPE_FUNCTIONS*/", used(SHAPE_FUNCTIONS, map))
      .replace("/*@PATH_HELPERS*/", used(PATH_HELPERS, functions)) // called by the path and prism functions, not by map()
      .replace(
        "/*@MAP_HELPERS*/",
        section(
          "// Rotations and the other operations: only those map() calls",
          used(MAP_HELPERS, map + animate),
        ) + (animate ? `\n\n${animate}` : ""),
      )
      .replace(
        "/*@SHAPES*/",
        section("// Shapes written by GSS (path…)", functions),
      )
      .replace("/*@MAP*/", map)
      .replace("/*@TEXTURE_UNIFORMS*/", textures.uniforms)
      .replace(
        "/*@HOVER_UNIFORM*/",
        (timelines.length > 0
          ? `uniform vec4 uTimeline; // scroll() and view(): the progress of each, 0 to 1${slots.length > 0 ? "\n" : ""}`
          : "") +
          (slots.length > 0
            ? `uniform float uHover[${slots.length}]; // 0 at rest, 1 hovered
uniform bool uPicking; // true: draw the id of the object under uPick, not its color
uniform vec2 uPick;`
            : ""),
      )
      .replace("/*@PICK_PIXEL*/", slots.length > 0 ? PICK_PIXEL : "")
      .replace("/*@PIXEL*/", slots.length > 0 ? "pixel" : "gl_FragCoord.xy")
      .replace("/*@PICK_OUTPUT*/", slots.length > 0 ? PICK_OUTPUT : "")
      .replace(
        "/*@TEXTURES*/",
        section(
          "// Textures: each image seen from the axis the surface faces most",
          textures.functions,
        ) +
          (gradients.functions
            ? `\n\n// Gradients on objects: the color at the point that was hit\n${gradients.functions}`
            : ""),
      )
      .replace(
        "/*@TEXTURE_CALL*/",
        moreLines([gradients.call, textures.call].filter(Boolean).join("\n")),
      )
      .replace(
        "/*@MATERIALS_USED*/",
        section(
          "// The metal, jelly and glass materials: only those getMaterial() uses",
          used(MATERIALS, materials),
        ),
      )
      .replace("/*@MATERIALS*/", moreLines(materials))
      .replace(
        "/*@SHADING*/",
        section(
          "// The lighting of metal, jelly and glass, and what it calls: only what the scene uses",
          used(SHADING, shadeCalls),
        ),
      )
      .replace("/*@SHADE_CALLS*/", moreLines(shadeCalls))
      .replace(
        "/*@FLOOR*/",
        noFloor ? "vec3(0.0)" : readColor(floor, "vec3(0.91, 0.89, 0.86)"),
      )
      .replace("/*@FLOOR_DISTANCE*/", noFloor ? "1e10" : "p.y")
      .replace("/*@LIGHT*/", vec3(readLight(sceneStyles["light"])))
      .replace("/*@AMBIENT*/", glslFloat(ambient))
      .replace("/*@DIRECT*/", glslFloat(direct))
      .replace(
        "/*@CAMERA_TARGET*/",
        sceneStyles["camera-target"]
          ? readTranslate(sceneStyles["camera-target"])
          : "vec3(0.0, 0.5, 0.0)",
      )
      // A color is a constant; a gradient a function of the pixel (decision 81)
      .replace(
        "const vec3 BACKGROUND = /*@BACKGROUND*/;",
        backgroundCode(sceneStyles["background"]),
      )
      // The background gradient needs the camera, and the reflections the gradients of objects
      .replace(
        "  vec3 up = cross(forward, right);\n",
        isGradient(sceneStyles["background"])
          ? "  vec3 up = cross(forward, right);\n  camForward = forward;\n  camRight = right;\n  camUp = up;\n"
          : "  vec3 up = cross(forward, right);\n",
      )
      .replace(
        "return diffuse(n, getMaterial(hit.y).color);",
        painted.length > 0
          ? "return diffuse(n, gradientColor(hit.y, p, getMaterial(hit.y).color));"
          : "return diffuse(n, getMaterial(hit.y).color);",
      )
      .replace(
        "vec2 march(vec3 ro, vec3 rd) {\n",
        `vec2 march(vec3 ro, vec3 rd) {\n${sceneSphereCode}`,
      )
      .replace("  outColor = vec4(col, 1.0);\n}", `${filterLines}  outColor = vec4(col, ${alpha});\n}`)
      .replace(
        "void main() {",
        [
          ...((filterLines + filterFunctions).includes("grain(") ? [GRAIN] : []),
          ...(filterFunctions ? [filterFunctions] : []),
          "void main() {",
        ].join("\n\n"),
      )
      // Reflections see the filters of the objects they meet
      .replace(
        /return (diffuse\(n, .*\));  \/\/ its color, lit/,
        objectFilter ? "return objectFilter(hit.y, $1);  // its color, lit, filtered" : "return $1;  // its color, lit",
      )
      // The animations of this pixel, computed once before anything calls map()
      .replace(
        "void main() {",
        animate ? "void main() {\n  animate();" : "void main() {",
      )
      // The parts left out leave blank lines behind: never more than one in a row
      .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
  );
}
