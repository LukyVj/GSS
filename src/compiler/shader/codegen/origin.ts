// transform-origin, like CSS: the point an object turns and scales around (decision 107).
// The keywords and the percentages are read on the box of the object, top up; a number is
// a point of its own space, from its center and y up, like translate. A group has no box:
// it takes numbers (and center).
import type { Token } from "../../syntax/tokenizer";
import type { StyledInstance } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { add, div, g, isLive, largest, liveFlatSize, liveNumber, liveRadii, liveSize3, mul, sub, type Num } from "./live";
import { shapeRadius } from "./shapes";

const ERROR =
  "transform-origin expects one to three values: left, center, right, top, bottom, a percentage or a number, then a number for z, like: transform-origin: left bottom;";
const GROUP =
  "A group has no box: transform-origin takes numbers on a group (or center), like: transform-origin: 0 1 0;";

type Keyword = "left" | "center" | "right" | "top" | "bottom";
type Item = { keyword?: Keyword; percent?: Num; number?: Num };
const KEYWORDS: Keyword[] = ["left", "center", "right", "top", "bottom"];

// The size of an object on x, y and z: the box its keywords and percentages are read on
export function objectBox(instance: StyledInstance): Num[] {
  const styles = instance.styles;
  switch (instance.tag) {
    case "cube":
      return liveSize3(styles["size"]);
    case "sphere": {
      const d = mul(2, liveNumber(styles["radius"], "radius", 0.5));
      return [d, d, d];
    }
    case "torus": {
      // Lying flat: its ring in the xz plane
      const r = liveNumber(styles["radius"], "radius", 1);
      const t = liveNumber(styles["thickness"], "thickness", 0.28);
      const width = mul(2, add(r, t));
      return [width, mul(2, t), width];
    }
    case "cylinder":
    case "capsule": {
      const d = mul(2, liveNumber(styles["radius"], "radius", instance.tag === "capsule" ? 0.25 : 0.5));
      return [d, liveNumber(styles["height"], "height", 1), d];
    }
    case "cone": {
      const d = mul(2, largest(...liveRadii(styles["radius"])));
      return [d, liveNumber(styles["height"], "height", 1), d];
    }
    case "plane": {
      const [w, d] = liveFlatSize(styles["size"]);
      return [w, 0, d];
    }
  }
  const d = 2 * (shapeRadius(instance.tag, styles) ?? 1); // path, prism: the box of their bounding sphere
  return [d, d, d];
}

function itemOf(token: Token, value: Token[]): Item {
  if (token.type === "IDENT" && (KEYWORDS as string[]).includes(token.value)) return { keyword: token.value as Keyword };
  if (token.type === "NUMBER") return { number: token.value };
  if (token.type === "PERCENTAGE") return { percent: token.value };
  // A variable set from JS (decision 105)
  if (token.type === "EXPR" && token.syntax === "number") return { number: token.code };
  if (token.type === "EXPR" && token.syntax === "percentage") return { percent: token.code };
  throw errorAt(value, ERROR);
}

const onlyX = (item: Item) => item.keyword === "left" || item.keyword === "right";
const onlyY = (item: Item) => item.keyword === "top" || item.keyword === "bottom";

// One coordinate, from the center. size: the box on this axis; sign: 1 when the keyword at
// 0% is on the negative side (left), -1 when it is on the positive side (top, y up)
function coordinate(item: Item, box: () => Num | undefined, sign: 1 | -1, value: Token[]): Num {
  if (item.number !== undefined) return item.number;
  if (item.keyword === "center") return 0;
  const size = box();
  if (size === undefined) throw errorAt(value, GROUP);
  // 0% is the left or the top, 100% the right or the bottom
  const percent = item.percent ?? (item.keyword === "left" || item.keyword === "top" ? 0 : 100);
  return mul(mul(sub(div(percent, 100), 0.5), size), sign);
}

// The box of an object, or how to find it: only a keyword or a percentage needs it
export type Box = Num[] | (() => Num[]);

// transform-origin in GLSL, as a vec3 from the center; vec3(0.0) for the center.
// box: the size of the object on x, y and z; none for a group.
export function readOrigin(box?: Box): (value: Token[] | undefined) => string {
  let known: Num[] | undefined;
  const size = (axis: number) => {
    if (box === undefined) return undefined;
    known ??= typeof box === "function" ? box() : box;
    return known[axis];
  };
  return (value) => {
    if (!value) return "vec3(0.0)";
    if (value.length === 0 || value.length > 3) throw errorAt(value, ERROR);
    const items = value.map((token) => itemOf(token, value));
    let [x, y] = items;
    if (items.length === 1) [x, y] = onlyY(x) ? [{ keyword: "center" }, x] : [x, { keyword: "center" }];
    // Two keywords can come in any order, like CSS: top left is left top
    else if (x.keyword && y.keyword && (onlyY(x) || onlyX(y))) [x, y] = [y, x];
    if (onlyY(x) || onlyX(y)) throw errorAt(value, ERROR);
    const z = items[2] ?? { number: 0 };
    if (z.number === undefined) throw errorAt(value, ERROR);

    // (0.75 - 0.5) * 1.2 is 0.30000000000000004: that is 0.3. + 0: never -0
    const point = [coordinate(x, () => size(0), 1, value), coordinate(y, () => size(1), -1, value), z.number].map((n) =>
      isLive(n) ? n : Math.round(n * 1e9) / 1e9 + 0,
    );
    if (point.every((n) => n === 0)) return "vec3(0.0)";
    return `vec3(${point.map(g).join(", ")})`;
  };
}
