// The shapes GSS can draw, as GLSL distance functions
import type { Token } from "../../syntax/tokenizer";
import type { Styles } from "../../cascade/resolve";
import { errorAt, locate } from "../../syntax/errors";
import { readFunction, readPolygon } from "../../values/values";
import { readSvgPath, type Point } from "../../values/svgpath";
import {
  pathFunction,
  polygonFunction,
  latheFunction,
  pathRadius,
  polygonRadius,
  latheRadius,
  type ViewBox,
} from "../path";
import { glslFloat } from "./glsl";
import { add, div, g, hypot, isLive, largest, liveFlatSize, liveNumber, liveRadii, liveSize3, smallest, sub, type Num } from "./live";

// Shapes that need their own GLSL function (like path) add it here.
// The same code is only written once, whatever the number of objects using it.
export type ShapeContext = { functions: Map<string, string> }; // GLSL code → function name

// "code" names its function NAME; returns the real name, shared with identical code
function useFunction(context: ShapeContext, code: string): string {
  const known = context.functions.get(code);
  if (known) return known;
  const name = `sdShape${context.functions.size}`;
  context.functions.set(code, name);
  return name;
}

// Reads d: path("M0 0 L1 1") and returns the string token of the path
function readD(value: Token[] | undefined): Token & { type: "STRING" } {
  const example = 'd: path("M0 0 C0 1 1 1 1 0");';
  if (!value) throw new Error(`path needs a d, like: ${example}`);
  const call = readFunction(value);
  const [arg] = call?.args ?? [];
  if (
    call?.name !== "path" ||
    call.args.length !== 1 ||
    arg.length !== 1 ||
    arg[0].type !== "STRING"
  ) {
    throw errorAt(value, `d expects path("…"), like: ${example}`);
  }
  return arg[0];
}

// Reads the contours of a prism or a lathe: d: polygon(0 1, 1 -1, -1 -1), one contour,
// or d: path("…"), one contour per subpath (the holes of a letter are subpaths)
function readContours(value: Token[] | undefined, tag: "prism" | "lathe", example: string): Point[][] {
  if (!value) throw new Error(`${tag} needs a d, like: ${example}`);
  const points = readPolygon(value);
  if (points) return [points];

  const call = readFunction(value);
  const [arg] = call?.args ?? [];
  if (
    call?.name === "path" &&
    call.args.length === 1 &&
    arg.length === 1 &&
    arg[0].type === "STRING"
  ) {
    const d = arg[0];
    // The precision follows the size of the shape: a logo 400 units wide
    // is cut as finely, relative to its size, as a shape 2 units wide.
    // A lathe is cut 50 times finer: its whole surface is made of the curves, and the
    // light shows each segment as a band, where a prism only has them on its walls
    const rough = locate(d, () => readSvgPath(d.value, Infinity)).flat();
    const size =
      Math.max(...rough.map((p) => p.x)) -
      Math.min(...rough.map((p) => p.x)) +
      Math.max(...rough.map((p) => p.y)) -
      Math.min(...rough.map((p) => p.y));
    const precision = tag === "lathe" ? 50_000 : 1000;
    return locate(d, () => readSvgPath(d.value, Math.max(size, 1e-6) / precision));
  }
  throw errorAt(
    value,
    `d expects polygon(…) or path("…") on a ${tag}, like: ${example}`,
  );
}

// Reads "0 0 32 32": min-x, min-y, width, height, like the viewBox of an SVG
function readViewBox(value: Token[] | undefined): ViewBox | null {
  if (!value) return null;
  const numbers = value.map((token) =>
    token.type === "NUMBER" ? token.value : NaN,
  );
  if (
    numbers.length !== 4 ||
    numbers.some(Number.isNaN) ||
    numbers[2] <= 0 ||
    numbers[3] <= 0
  ) {
    throw errorAt(
      value,
      "view-box expects four numbers: x, y, width and height, like: view-box: 0 0 32 32;",
    );
  }
  const [x, y, width, height] = numbers;
  return { x, y, width, height };
}

// The GLSL shape of each type of object. "q" is the point, already moved.
// Each shape turns the object's styles into GLSL, and gives the radius of a sphere,
// centered on its origin, that holds the whole shape: map() skips the object when
// even that sphere is further than the nearest object found so far (null: no sphere,
// the object is always drawn). Every shape below is an exact distance, so the
// distance to the shape is never less than the distance to its sphere.
export type Shape = { code: string; radius: number | null };

export const SHAPES: Record<
  string,
  (styles: Styles, context: ShapeContext) => Shape
> = {
  // A size set from JS (decision 105) is not known at compile time: no bounding sphere
  cube: (styles) => {
    const half = liveSize3(styles["size"]).map((n) => div(n, 2));
    const corner = smallest(liveNumber(styles["corner-radius"], "corner-radius", 0.08, true), ...half);
    return {
      code: `sdRoundBox(q, vec3(${half.map(g).join(", ")}), ${g(corner)})`,
      radius: known(hypot(...half)), // the corner of the box
    };
  },
  sphere: (styles) => {
    const radius = liveNumber(styles["radius"], "radius", 0.5);
    return { code: `sdSphere(q, ${g(radius)})`, radius: known(radius) };
  },
  torus: (styles) => {
    const radius = liveNumber(styles["radius"], "radius", 1);
    const thickness = liveNumber(styles["thickness"], "thickness", 0.28);
    return {
      code: `sdTorus(q, vec2(${g(radius)}, ${g(thickness)}))`,
      radius: known(add(radius, thickness)),
    };
  },
  cylinder: (styles) => {
    const radius = liveNumber(styles["radius"], "radius", 0.5);
    const height = liveNumber(styles["height"], "height", 1);
    return {
      code: `sdCylinder(q, ${g(div(height, 2))}, ${g(radius)})`,
      radius: known(hypot(radius, div(height, 2))), // the rim of a cap
    };
  },
  cone: (styles) => {
    const [bottom, top] = liveRadii(styles["radius"]);
    const height = liveNumber(styles["height"], "height", 1);
    return {
      code: `sdCappedCone(q, ${g(div(height, 2))}, ${g(bottom)}, ${g(top)})`,
      radius: known(hypot(largest(bottom, top), div(height, 2))), // the rim of the wider cap
    };
  },
  capsule: (styles) => {
    const radius = liveNumber(styles["radius"], "radius", 0.25);
    const height = liveNumber(styles["height"], "height", 1);
    let half = sub(div(height, 2), radius); // half of the straight part
    if (typeof half === "number" && half < 0) {
      throw errorAt(
        styles["height"],
        `capsule height must be at least twice its radius (${glslFloat((radius as number) * 2)}), like: height: ${(radius as number) * 2};`,
      );
    }
    if (isLive(half)) half = `max(${half}, 0.0)`; // set from JS: a sphere at worst
    return {
      code: `sdCapsule(q, ${g(half)}, ${g(radius)})`,
      radius: known(div(height, 2)), // the tip of a cap
    };
  },
  // A pyramid on a base of size x by size z, size y high (decision 154): sized like a cube
  pyramid: (styles) => {
    const size = liveSize3(styles["size"]);
    return {
      code: `sdPyramid(q, vec3(${size.map(g).join(", ")}))`,
      radius: known(hypot(...size.map((n) => div(n, 2)))), // a corner of the base, or the apex
    };
  },
  octahedron: (styles) => {
    const radius = liveNumber(styles["radius"], "radius", 0.5);
    return { code: `sdOctahedron(q, ${g(radius)})`, radius: known(radius) };
  },
  // A hollow cylinder (decision 154): its wall, thickness thick, inside its radius
  tube: (styles) => {
    const radius = liveNumber(styles["radius"], "radius", 0.5);
    const height = liveNumber(styles["height"], "height", 1);
    let thickness = liveNumber(styles["thickness"], "thickness", 0.1);
    if (typeof thickness === "number" && typeof radius === "number" && thickness > radius) {
      throw errorAt(
        styles["thickness"],
        `tube thickness must be at most its radius (${glslFloat(radius)}), like: thickness: ${glslFloat(radius / 5)};`,
      );
    }
    if (isLive(thickness) || isLive(radius)) thickness = `min(${g(thickness)}, ${g(radius)})`; // set from JS: a full cylinder at worst
    return {
      code: `sdTube(q, ${g(div(height, 2))}, ${g(radius)}, ${g(thickness)})`,
      radius: known(hypot(radius, div(height, 2))), // the rim of an end
    };
  },
  // A tube along an SVG path (decision 35)
  path: (styles, context) => {
    const d = readD(styles["d"]);
    const width = liveNumber(styles["stroke-width"], "stroke-width", 1);
    // Curves become segments that stay within a hundredth of the tube's width: smooth enough for the light
    // (a width set from JS: a hundredth of the default width)
    const lines = locate(d, () => readSvgPath(d.value, (isLive(width) ? 1 : width) / 100)); // errors point at the path
    const viewBox = readViewBox(styles["view-box"]);
    const code = locate(styles["d"], () =>
      pathFunction("NAME", lines, width, viewBox),
    );
    const name = useFunction(context, code);
    return { code: `${name}(q)`, radius: isLive(width) ? null : pathRadius(lines, width, viewBox) };
  },
  // A polygon, filled, then given a depth
  prism: (styles, context) => {
    const contours = readContours(
      styles["d"],
      "prism",
      'd: polygon(0 -1, 1 1, -1 1); or d: path("M0 0 L1 0 L1 1 Z");',
    );
    const depth = liveNumber(styles["depth"], "depth", 0.2);
    const viewBox = readViewBox(styles["view-box"]);
    const code = locate(styles["d"], () =>
      polygonFunction("NAME", contours, depth, viewBox),
    );
    return {
      code: `${useFunction(context, code)}(q)`,
      radius: isLive(depth) ? null : polygonRadius(contours, depth, viewBox),
    };
  },
  // A contour, filled, then turned around the y axis (decision 130)
  lathe: (styles, context) => {
    const example = 'd: polygon(0 0, 0.5 0, 0.3 1, 0 1); or d: path("M0 0 H0.5 V1 H0 Z");';
    const contours = readContours(styles["d"], "lathe", example);
    // A curve that ends on the axis can be cut a hair from it: that hair is the axis
    const points = contours.flat();
    const hair = 1e-9 * Math.max(1, ...points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
    if (points.some((p) => p.x < -hair)) {
      throw errorAt(
        styles["d"],
        `a lathe turns its contour around x = 0: every x must be 0 or more, like: ${example}`,
      );
    }
    if (points.every((p) => p.x <= hair)) {
      throw errorAt(
        styles["d"],
        `the contour of a lathe must go right of its axis, x = 0: it turns around it, like: ${example}`,
      );
    }
    const onAxis = contours.map((contour) => contour.map((p) => (p.x <= hair ? { x: 0, y: p.y } : p)));
    const viewBox = readViewBox(styles["view-box"]);
    const code = locate(styles["d"], () => latheFunction("NAME", onAxis, viewBox));
    return { code: `${useFunction(context, code)}(q)`, radius: latheRadius(onAxis, viewBox) };
  },
  // A thin box: the ray could jump over a surface with no thickness
  plane: (styles) => {
    const [width, depth] = liveFlatSize(styles["size"]);
    const half = [div(width, 2), 0.01, div(depth, 2)];
    return {
      code: `sdRoundBox(q, vec3(${half.map(g).join(", ")}), 0.0)`,
      radius: known(hypot(...half)),
    };
  },
};

// The radius of a bounding sphere, when it is known at compile time
const known = (n: Num): number | null => (isLive(n) ? null : n);

// The shapes worth a bounding test: their distance walks dozens of segments.
// Measured (npm run bench, dpr 2, M4 Pro): bounding every object made the scenes of
// simple shapes slower (spiral +44 %, todal +21 %): for a sphere, the test costs as
// much as the shape, and one branch per object breaks the straight-line code GPUs
// run best. Bounding only path, prism and lathe keeps what orrery and macropad gained.
export const BOUNDED = new Set(["path", "prism", "lathe"]);

// The radius of an object's bounding sphere, for the tests
export function shapeRadius(tag: string, styles: Styles): number | null {
  return SHAPES[tag](styles, { functions: new Map() }).radius;
}

// The names of the shapes the compiler can draw: the docs must list them all
export function shapeNames(): string[] {
  return Object.keys(SHAPES);
}
