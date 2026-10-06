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
//   bounds.ts      the sphere of the scene and the tree of spheres (decisions 76, 132)
//   textures.ts    texture, ::face() (decision 59)
//   gradients.ts   gradients in the background and on objects (decisions 81, 82), animated (102, 103)
//   filters.ts     filter on the scene and on objects (decisions 83, 84)
//   view.ts        view: distance, the isolines of the distance field (decision 131)
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { readNumber } from "../../values/values";
import { sceneTextures } from "../../features/textures";
import { glslFloat, moreLines, round, section, used, label, vec3, type Hover } from "./glsl";
import { EASINGS, MAP_HELPERS, MATERIALS, PATH_HELPERS, SHADE_CALLS, SHAPE_FUNCTIONS } from "./library";
import { SHADING } from "./shading";
import { MARCH_LOOP, PICK_OUTPUT, PICK_PIXEL, SURFACE, TEMPLATE } from "./template";
import { MASKED_MARCH_LOOP, SHELL, SKIN_MARCH_LOOP, holeNormal, holeNormals, maskCode, objectMask, skinFunction, type Masked } from "./masks";
import { LAYERS, PAST_SURFACE, alphaFunction, colorFunction, objectAlpha, surfaceFunction, type Transparent } from "./transparency";
import { readColor, readLight, readScale, readSurfaceColor, readTranslate } from "./read";
import { readOperation, SMOOTH } from "./operations";
import { BOUNDED, SHAPES, type ShapeContext } from "./shapes";
import { textureCode } from "./textures";
import { backgroundCode, backgroundNeedsCamera, floorGradient, gradientCode, objectGradient, paintsTransparent, type Painted } from "./gradients";
import { gradientMean } from "../gradient";
import { BLEND_LIBRARY } from "./blend-library";
import { readMaterial } from "./materials";
import { activeSlots, hoverSlots, hoverValue, useTimelines } from "./animation";
import { sceneTimelines } from "../../features/timeline";
import { offsetLines, offsetReach, useOffsetFunctions } from "./offset";
import { animateCode, createHoisted, hoist, originOf, rotationLines, transformLines } from "./transforms";
import { objectBox } from "./origin";
import { fogCode } from "./fog";
import { boundedMap, enclosing, objectSphere, sceneMiss, type Sphere } from "./bounds";
import { GRAIN } from "../../features/filter";
import { filterCode } from "./filters";
import { COLOR_LIBRARY } from "./color-library";
import { NOISE_LIBRARY } from "./noise-library";
import { isLive, liveCode, liveNumber } from "./live";
import { liveLight, liveRead } from "./properties";
import { DIFFUSE, isLight, lightingCode, splitAmbient } from "./lights";
import { readShadows } from "./shadows";
import { ISOLINES, ISOLINES_CALL, withObjectsAlone } from "./view";
import type { View } from "../../features/view";
import { readShapeRendering } from "../../features/shape-rendering";
import { precisionMarch } from "./shape-rendering";

export { activeSlots, hoverSlots } from "./animation";
export { shapeNames, shapeRadius } from "./shapes";

export function generateShader(
  everything: StyledInstance[], // the objects, and the lights of @scene (decision 110)
  sceneStyles: Styles = {},
  keyframes: Keyframes[] = [],
  properties = 0, // the variables registered with @property: uProperties[] (decision 105)
  view: View = "shaded", // distance: the isolines of the distance to the objects (decision 131)
): string {
  // scroll() and view(): one component of uTimeline each (decision 96)
  const timelines = sceneTimelines([
    sceneStyles,
    ...everything.flatMap((instance) => [...instance.groupStyles, instance.styles]),
  ]);
  useTimelines(timelines);
  // The motion paths a scene animates along: one GLSL function each (decision 97)
  const offsetFunctions = useOffsetFunctions();
  // A light of @scene can change on :hover through its group: it has its slots too
  const hovers = hoverSlots(everything);
  const actives = activeSlots(everything);
  // The lights light the objects; they are never drawn
  const lamps = everything.filter(isLight);
  const instances = everything.filter((instance) => !isLight(instance));
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
  // objects already combined count (res.x). view: distance measures the objects alone.
  const plainUnion = (instance: StyledInstance) =>
    readOperation(instance.styles["operation"]) === "opU" &&
    liveNumber(instance.styles["blend"], "blend", 0, true) === 0;
  const floorStyle = sceneStyles["floor"];
  const hasFloor = !(
    floorStyle?.length === 1 &&
    floorStyle[0].type === "IDENT" &&
    floorStyle[0].value === "none"
  );
  const distanceView = view === "distance";
  const geometricPrecision = readShapeRendering(sceneStyles) === "geometricPrecision";
  const nearest =
    hasFloor && !distanceView && instances.every(plainUnion) ? "min(res.x, p.y)" : "res.x";

  // mask-image (decision 113): the objects with holes, skins while march() looks for a surface
  const masked = instances
    .map((instance) => objectMask(instance, keyframes, hoverOf(instance)))
    .filter((mask): mask is Masked => mask !== null);
  // opacity (decision 116): the objects that cover what is behind them only in part, skins too
  // A gradient in color with transparent stops (decision 117), read once per object
  const paints = new Set(instances.filter((instance) => paintsTransparent(instance.styles, keyframes, hoverOf(instance))));
  const transparent = instances
    .map((instance) => ({ instance, alpha: objectAlpha(instance, keyframes, hoverOf(instance), paints.has(instance)) }))
    .filter((item): item is Transparent => item.alpha !== null);
  const skins = new Set([...masked.map(({ instance }) => instance), ...transparent.map(({ instance }) => instance)]);
  // Which objects are skins: those with holes, or those and the transparent ones
  const skinTest = transparent.length > 0 ? "isSkin" : "hasHoles";
  const shadows = readShadows(sceneStyles["shadows"]);

  const mapLines = instances.map((instance) => {
    const shape = SHAPES[instance.tag];
    if (!shape) {
      throw new Error(
        `Unknown object: "${instance.tag}". Available: ${Object.keys(SHAPES).join(", ")}`,
      );
    }
    const { code: shapeCode, radius: shapeRadius } = shape(instance.styles, context);
    // A motion path takes the shape away from the object's origin (decision 97)
    const reach = offsetReach(instance.styles, keyframes, hoverOf(instance));
    const radius = shapeRadius === null || reach === null ? null : shapeRadius + reach;
    spheres.push(shapeRadius === null ? null : objectSphere(shapeRadius, instance, keyframes, hoverOf(instance)));
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
    // A blend set from JS (decision 105) is always smooth, and never 0: it divides
    const blend = liveNumber(instance.styles["blend"], "blend", 0, true);
    const distance = `${shapeCode} * ${scales.join(" * ")}`;
    // A subtracted or intersected object cuts the others: it stays solid
    const skin = skins.has(instance) && operation === "opU";
    const shapeValue = `vec2(${skin ? `shell(${distance})` : distance}, ${glslFloat(instance.index)})`;

    const combine =
      isLive(blend)
        ? `${SMOOTH[operation]}(res, ${shapeValue}, max(${liveCode(instance.styles["blend"])}, 0.00001))`
        : blend > 0
          ? `${SMOOTH[operation]}(res, ${shapeValue}, ${glslFloat(blend)})`
          : `${operation}(res, ${shapeValue})`;

    const groupLines = instance.groupStyles.flatMap((styles) =>
      transformLines(styles, keyframes, undefined, hoisted),
    );
    // transform-origin (decision 107): the bounding sphere is centered on it, so it needs
    // a point known at compile time
    const box = () => objectBox(instance);
    const origin = originOf(instance.styles, keyframes, hover, hoisted, box);
    const point = origin === null ? [0, 0, 0] : origin.match(/^vec3\((.*)\)$/)?.[1].split(",").map(Number);
    const fixed = point?.length === 3 && point.every(Number.isFinite) ? point : null;

    // Only a costly shape is worth the test, and only a plain union can be skipped:
    // a subtraction, an intersection or a blend changes the result even when far
    if (radius === null || !BOUNDED.has(instance.tag) || !plainUnion(instance) || !fixed) {
      return [
        ` // ${label(instance)}`,
        `  q = p;`,
        ...groupLines,
        ...transformLines(instance.styles, keyframes, hover, hoisted, box),
        ` res = ${combine};`,
      ].join("\n");
    }

    // The bounding sphere: tested after the object's own translate and before its
    // rotations (a sphere looks the same from every side), so a skipped object costs
    // neither its rotations nor its shape. Its distance, back in scene units: the
    // object's own scale grows the sphere, the groups' scales grow everything.
    // Turned around a transform-origin, the object stays within its radius plus the
    // distance to the origin, around the origin.
    const ownScale = scales[last];
    const groupScales = scales.slice(0, last);
    // A little bigger, rounded up: the GPU computes in 32-bit floats, and a sphere
    // smaller than the shape would skip an object that touches the ray
    const reachOfOrigin = Math.hypot(fixed[0], fixed[1], fixed[2]);
    const safeRadius = Math.ceil((radius + reachOfOrigin + 0.001) * 10000) / 10000;
    const around = origin ? `q - ${origin}` : "q";
    const sphere = `(length(${around}) - ${glslFloat(safeRadius)} * ${ownScale})${groupScales.map((scale) => ` * ${scale}`).join("")}`;
    return [
      ` // ${label(instance)}`,
      `  q = p;`,
      ...groupLines,
      `  q -= ${hoist(hoisted, "vec3", hoverValue(instance.styles, keyframes, "translate", readTranslate, hover))};`,
      `  if (${sphere} <= ${nearest}) { // its bounding sphere could be the nearest`,
      ...(origin ? [`    q -= ${origin};`] : []),
      ...rotationLines(instance.styles, keyframes, hover, hoisted).map((line) => `  ${line}`),
      `    q /= ${ownScale};`,
      ...offsetLines(instance.styles, keyframes, hover, hoisted).map((line) => `  ${line}`),
      ...(origin ? [`    q += ${origin};`] : []),
      `   res = ${combine};`,
      `  }`,
    ].join("\n");
  });

  // The objects painted with a gradient (decision 82)
  const painted: Painted[] = [];
  const materialLines = instances.map((instance) => {
    const { painted: gradient, styles } = objectGradient(instance, keyframes, hoverOf(instance), paints.has(instance));
    if (gradient) painted.push(gradient);
    instance = gradient ? { ...instance, styles } : instance;
    // A gradient moves in gradientColor(): getMaterial() keeps the mean of its rest
    const color = gradient
      ? readColor(instance.styles["color"])
      : hoverValue(instance.styles, keyframes, "color", readSurfaceColor, hoverOf(instance));
    const material = readMaterial(instance.styles["material"], color);
    return `  if (id == ${glslFloat(instance.index)}) return ${material};  // ${label(instance)}`;
  });

  // floor: none moves the floor infinitely far away
  const floor = sceneStyles["floor"];
  const noFloor =
    floor?.length === 1 &&
    floor[0].type === "IDENT" &&
    floor[0].value === "none";
  // A gradient, a noise() or a displace() paints the floor (decision 122)
  const floorImage = noFloor ? null : floorGradient(floor);

  // ambient: the share of light received in the shadow; the sun gives the rest.
  // Set from JS (decision 105): kept between 0 and 1 on the GPU.
  // A color can follow the number (decision 110)
  const ambientParts = splitAmbient(sceneStyles["ambient"]);
  const liveAmbient = liveCode(ambientParts.number, "ambient");
  const ambientCode = liveAmbient === null ? null : `clamp(${liveAmbient}, 0.0, 1.0)`;
  const ambient = ambientCode ? 0 : readNumber(ambientParts.number, "ambient", 0.1, true);
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

  const map = boundedMap(instances, mapLines, spheres, plainUnion, nearest);
  // A blend adds a fillet up to its distance around the objects it joins
  const blends = instances.map((i) => liveNumber(i.styles["blend"], "blend", 0, true));
  const maxBlend = Math.max(0, ...blends.filter((b): b is number => !isLive(b)));
  // A blend set from JS: how far it reaches is not known, nor the sphere of the scene
  const known = spheres.every((s): s is Sphere => s !== null) && spheres.length > 0 && !blends.some(isLive);
  const scene = known ? enclosing(spheres as Sphere[]) : null;
  const sceneRadius = scene ? scene.radius + maxBlend + 0.01 : 0;
  const sceneSphereCode = scene
    ? sceneMiss(scene.center, sceneRadius, hasFloor)
    : "";
  const precisionSceneSphereCode = scene
    ? sceneMiss(scene.center, sceneRadius, hasFloor, true)
    : "";
  // The sun, the ambient light and the lights of @scene; null for the white sun of always
  // shadows (decision 115): through the holes of mask-image too
  const lights = lightingCode(
    lamps,
    sceneStyles,
    keyframes,
    hoverOf,
    hoisted,
    { level: ambientCode ?? glslFloat(ambient), color: ambientParts.color },
    { mode: shadows, holes: masked.length > 0, transparent: transparent.length > 0 },
  );
  const animate = animateCode(hoisted, lights?.positions ?? "");
  const textures = textureCode(instances, keyframes, hoverOf);
  // filter on the scene (decision 83) and on objects (decision 84)
  const { objectFilter, filterLines, alpha, filterFunctions } = filterCode(instances, sceneStyles);
  const textured = new Set(
    instances.filter(
      (instance) =>
        sceneTextures([instance]).length > 0,
    ),
  );
  const gradients = gradientCode(painted, textured, keyframes, hoverOf, floorImage);
  // mask-image (decision 113): how much of the surface of each object with holes is there
  const masks = maskCode(masked, new Set([...textured, ...painted.map(({ instance }) => instance)]), keyframes, hoverOf, transparent.length === 0);
  // opacity (decision 116): how much each surface covers, the color the light takes through it
  // (shadows), the skins, and the way past a surface
  const transparency =
    transparent.length > 0
      ? [
          alphaFunction(transparent),
          ...(shadows ? [colorFunction(painted.length > 0)] : []),
          skinFunction("isSkin", [...skins]),
          PAST_SURFACE,
        ].join("\n\n")
      : "";
  // A color is a constant; a gradient a function of the pixel (decision 81); either one
  // can follow an animation of the scene (decision 103)
  const background = backgroundCode(sceneStyles, keyframes);
  const fog = fogCode(sceneStyles, keyframes); // off by default
  const materials = materialLines.join("\n");
  // One line in main() for each material the scene uses
  const shadeCalls = Object.entries(SHADE_CALLS)
    .filter(([kind]) => materials.includes(kind + "("))
    .map(([, line]) => line)
    .join("\n");

  const lit = lights
    ? TEMPLATE.replace(DIFFUSE, lights.diffuse).replace("const vec3 LIGHT_DIR = /*@LIGHT*/;", lights.definitions)
    : TEMPLATE;
  // opacity (decision 116) and geometricPrecision put surface shading in a function:
  // opacity calls it for each layer; a grazing silhouette calls it once for its coverage.
  const surfaceInFunction = transparent.length > 0 || geometricPrecision;
  const layered =
    transparent.length > 0
      ? lit.replace(SURFACE, LAYERS).replace("void main() {", `${surfaceFunction(SURFACE)}void main() {`)
      : geometricPrecision
        ? lit
            .replace(SURFACE, "  vec3 col = shadeSurface(ro, rd, t, id);\n")
            .replace("void main() {", `${surfaceFunction(SURFACE)}void main() {`)
        : lit;
  const rendered = geometricPrecision
    ? layered.replace(
        "\nvec3 calcNormal(vec3 p) {",
        `\n${precisionMarch(precisionSceneSphereCode, masked.length > 0, transparent.length > 0)}\n\nvec3 calcNormal(vec3 p) {`,
      )
    : layered;
  const template = distanceView ? withObjectsAlone(rendered) : rendered;
  const objectLine = "  if (t < MAX_DIST) col = objectFilter(id, col);\n";
  const finalLines = surfaceInFunction ? filterLines.replace(objectLine, "") : filterLines;
  const edgeBlend = geometricPrecision
    ? `  if (edgeCoverage > 0.0 && edgeT < t) {
    vec3 edgePoint = ro + rd * edgeT;
    vec3 edgeColor = shadeSurface(ro, rd, edgeT, edgeId);
    col = mix(col, edgeColor, ${transparent.length > 0 ? "edgeCoverage * surfaceAlpha(edgeId, edgePoint)" : "edgeCoverage"});
  }
`
    : "";
  const shader = (
    template.replace(
      "/*@EASINGS*/",
      section(
        "// The easings of the animations: only those the scene uses",
        used(
          EASINGS,
          [map, animate, textures.functions, gradients.functions, masks, textures.call, materials, background].join("\n"),
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
        ) +
          (skins.size > 0 ? `\n\n${SHELL}` : "") +
          (animate ? `\n\n${animate}` : ""),
      )
      .replace(
        "/*@SHAPES*/",
        section("// Shapes written by GSS (path…)", functions) +
          (offsetFunctions.size > 0
            ? "\n\n" +
              section(
                "// Motion paths: the point at a distance along each one, and its direction",
                [...offsetFunctions].map(([code, name]) => code.replace("NAME", name)).join("\n\n"),
              )
            : ""),
      )
      .replace("/*@MAP*/", map)
      .replace(
        "  vec2 hit = march(ro, rd);\n  float t = hit.x;\n  float id = hit.y;/*@PICK_OUTPUT*/",
        geometricPrecision
          ? "  PrecisionHit hit = marchPrecision(ro, rd);\n  float t = hit.t;\n  float id = hit.id;/*@PICK_OUTPUT*/\n  float edgeT = hit.edgeT;\n  float edgeId = hit.edgeId;\n  float edgeCoverage = hit.coverage;"
          : "  vec2 hit = march(ro, rd);\n  float t = hit.x;\n  float id = hit.y;/*@PICK_OUTPUT*/",
      )
      .replace("/*@TEXTURE_UNIFORMS*/", textures.uniforms)
      .replace(
        "/*@HOVER_UNIFORM*/",
        (timelines.length > 0
          ? `uniform vec4 uTimeline; // scroll() and view(): the progress of each, 0 to 1${slots.length > 0 ? "\n" : ""}`
          : "") +
          (properties > 0
            ? `uniform vec4 uProperties[${properties}]; // @property: the variables set from JS${slots.length > 0 ? "\n" : ""}`
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
            ? `\n\n// Gradients on objects${floorImage ? " and on the floor" : ""}: the color at the point that was hit\n${gradients.functions}`
            : "") +
          (masks ? `\n\n// mask-image: how much of each object's surface is there, from 0 to 1\n${masks}` : "") +
          (transparency ? `\n\n${transparency}` : ""),
      )
      .replace(
        "/*@TEXTURE_CALL*/",
        moreLines([gradients.call, textures.call].filter(Boolean).join("\n")),
      )
      .replace(
        "/*@MATERIALS_USED*/",
        [
          // The colors a variable set from JS changes (decision 105)
          section(
            "// The color spaces of CSS: only those the colors set from JS use",
            used(COLOR_LIBRARY, [materials, background, gradients.functions, masks].join("\n")),
          ),
          section(
            "// The metal, jelly and glass materials: only those getMaterial() uses",
            used(MATERIALS, materials),
          ),
          // noise() (decision 111): in the background and on the objects it paints
          section("// The noise of noise(): only what the scene uses", used(NOISE_LIBRARY, [background, gradients.functions, masks].join("\n"))),
          // background-blend-mode (decision 112): only the modes of the layers
          section("// The blend modes of the background: only those its layers use", used(BLEND_LIBRARY, background)),
        ]
          .filter(Boolean)
          .join("\n\n"),
      )
      .replace("/*@MATERIALS*/", moreLines(materials))
      // The filters before the lighting: the reflections of trace() call objectFilter()
      .replace(
        "/*@SHADING*/",
        [
          ...(skins.size > 0 ? [holeNormal(skinTest)] : []),
          ...((filterLines + filterFunctions).includes("grain(") ? [GRAIN] : []),
          ...(filterFunctions ? [filterFunctions] : []),
          section(
            "// The lighting of metal, jelly and glass, and what it calls: only what the scene uses",
            used(SHADING, shadeCalls),
          ),
          ...(fog ? [fog.functions] : []),
          ...(distanceView ? [ISOLINES] : []),
        ].join("\n\n"),
      )
      .replace("/*@SHADE_CALLS*/", moreLines(shadeCalls))
      .replace("/*@FOG*/", fog?.line ?? "")
      .replace(
        "/*@FLOOR*/",
        noFloor
          ? "vec3(0.0)"
          : // An image moves in gradientColor(): getMaterial() keeps the mean of its colors
            floorImage
            ? readColor([{ type: "HASH", value: gradientMean(floor!) }])
            : liveRead("floor", (value) => readColor(value, "vec3(0.91, 0.89, 0.86)"))(floor),
      )
      .replace("/*@FLOOR_DISTANCE*/", noFloor ? "1e10" : "p.y")
      // A sun set from JS (decision 105): a function, since a constant cannot read a uniform
      .replace(
        "const vec3 LIGHT_DIR = /*@LIGHT*/;",
        lights
          ? ""
          : (liveLight(sceneStyles["light"]) ?? `const vec3 LIGHT_DIR = ${vec3(readLight(sceneStyles["light"]))};`),
      )
      .replace("/*@AMBIENT*/", ambientCode ?? glslFloat(ambient))
      .replace("/*@DIRECT*/", ambientCode ? `(1.0 - ${ambientCode})` : glslFloat(direct))
      .replace(
        "/*@CAMERA_TARGET*/",
        sceneStyles["camera-target"]
          ? liveRead("translate", readTranslate)(sceneStyles["camera-target"]) // a target set from JS (decision 105)
          : "vec3(0.0, 0.5, 0.0)",
      )
      .replace(
        "const vec3 BACKGROUND = /*@BACKGROUND*/;",
        background,
      )
      // The background gradient needs the camera, and the reflections the gradients of objects
      .replace(
        "  vec3 up = cross(right, forward);\n",
        backgroundNeedsCamera(sceneStyles["background"])
          ? "  vec3 up = cross(right, forward);\n  camForward = forward;\n  camRight = right;\n  camUp = up;\n"
          : "  vec3 up = cross(right, forward);\n",
      )
      .replace(
        "return diffuse(n, getMaterial(hit.y).color);",
        painted.length > 0 || floorImage
          ? "return diffuse(n, gradientColor(hit.y, p, getMaterial(hit.y).color));"
          : "return diffuse(n, getMaterial(hit.y).color);",
      )
      .replace(
        "vec2 march(vec3 ro, vec3 rd) {\n",
        `vec2 march(vec3 ro, vec3 rd) {\n${sceneSphereCode}`,
      )
      // Through the holes of mask-image (decision 113)
      .replace(MARCH_LOOP, masked.length > 0 ? MASKED_MARCH_LOOP : transparent.length > 0 ? SKIN_MARCH_LOOP : MARCH_LOOP)
      .replace("/*@SURFACE_FILTER*/", surfaceInFunction && filterLines.includes(objectLine) ? objectLine : "")
      .replace("  outColor = vec4(col, 1.0);\n}", `${edgeBlend}${finalLines}${distanceView ? ISOLINES_CALL : ""}  outColor = vec4(col, ${alpha});\n}`)
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
  // The normals of a scene with holes (decision 113)
  const turned = skins.size > 0 ? holeNormals(shader) : shader;
  // Every light in the highlights of the materials too
  return lights ? lights.rewrite(turned) : turned;
}
