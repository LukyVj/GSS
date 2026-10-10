import { escapeHtml } from "./escape";
import { between, says, shapeSvg, type ShapeName } from "./figure-kit";
import type { Frame } from "./hairline";

// A scene as a row of objects, in the order of its @scene, a group as a dashed box around its
// own: the figure of a selector lights the objects it targets. Each object turns under the
// pointer, like the shapes of the other figures.

type Item =
  | { shape: ShapeName; lit?: boolean; label?: string; state?: "absent" | "blinks"; lift?: number; fade?: number }
  | { group: string; lit?: boolean; items: Item[] };

const SMALL: Frame = { width: 64, height: 64, scale: 34, x: 32, y: 33 };

const one = (shape: ShapeName, more: Omit<Extract<Item, { shape: ShapeName }>, "shape"> = {}): Item => ({ shape, ...more });
const lit = (shape: ShapeName, label?: string): Item => ({ shape, lit: true, label });
const group = (name: string, items: Item[], on = false): Item => ({ group: name, lit: on, items });
// The copies of `shape * n`, numbered like sibling-index() counts them
const copies = (shape: ShapeName, count: number, each: (index: number) => Omit<Extract<Item, { shape: ShapeName }>, "shape">) =>
  Array.from({ length: count }, (_, i) => one(shape, each(i + 1)));

type Row = { code: string | [string, string]; items: Item[]; kind?: "ring" };

const ROWS: Record<string, Row> = {
  "at-scene": {
    code: "@scene { cube; sphere; torus * 3; }",
    items: [one("cube", { label: "cube" }), one("sphere", { label: "sphere" }), ...copies("torus", 3, (i) => ({ label: `torus ${i}` }))],
  },
  "selector-class": { code: ".red { color: #ff5a36; }", items: [one("cube"), lit("sphere", ".red"), lit("cube", ".red"), one("torus")] },
  "selector-id": { code: "#hero { color: #ff5a36; }", items: [one("cube"), lit("sphere", "#hero"), one("torus")] },
  "selector-universal": { code: "* { color: #ff5a36; }", items: [lit("cube"), lit("sphere"), lit("torus"), lit("cone")] },
  "selector-list": { code: "cube, torus { color: #ff5a36; }", items: [lit("cube"), one("sphere"), lit("torus"), one("cone")] },
  "selector-descendant": {
    code: "#g cube { color: #ff5a36; }",
    items: [one("cube"), group("group#g", [one("sphere"), lit("cube"), group("group", [lit("cube")])])],
  },
  "selector-child": {
    code: "#g > cube { color: #ff5a36; }",
    items: [one("cube"), group("group#g", [one("sphere"), lit("cube"), group("group", [one("cube")])])],
  },
  "selector-adjacent": { code: "sphere + cube { color: #ff5a36; }", items: [one("cube"), one("sphere"), lit("cube"), one("cube")] },
  "selector-sibling": { code: "sphere ~ cube { color: #ff5a36; }", items: [one("cube"), one("sphere"), one("torus"), lit("cube"), lit("cube")] },
  "selector-nesting": {
    code: "#g { cube { color: #ff5a36; } }",
    items: [one("cube"), group("group#g", [lit("cube"), one("sphere"), lit("cube")])],
  },
  "selector-has": {
    code: "group:has(sphere) cube { color: #ff5a36; }",
    items: [group("group", [lit("cube"), one("sphere")], true), group("group", [one("cube"), one("cube")])],
  },
  "selector-not": { code: "cube:not(.red) { color: #4f8cff; }", items: [lit("cube"), one("cube", { label: ".red" }), one("sphere"), lit("cube")] },
  "selector-nth-child": {
    code: ":nth-child(odd) { color: #ff5a36; }",
    items: copies("cube", 5, (i) => ({ label: String(i), lit: i % 2 === 1 })),
  },
  "selector-nth-of-type": {
    code: "cube:nth-of-type(3) { color: #ff5a36; }",
    items: [one("cube", { label: "1" }), one("cube", { label: "2" }), one("sphere", { label: "3" }), lit("cube", "4")],
  },
  "selector-first-child": {
    code: ":first-child, :last-child { color: #ff5a36; }",
    items: [lit("cube"), one("sphere"), one("torus"), lit("cone")],
  },
  "fn-sibling-index": {
    code: "cube { translate: 0 calc(sibling-index() * 0.2) 0; }",
    items: copies("cube", 5, (i) => ({ label: String(i), lift: i * 9 })),
  },
  "fn-sibling-count": {
    code: "sphere { rotate-y: calc(360deg / sibling-count() * sibling-index()); }",
    items: copies("sphere", 6, () => ({})),
    kind: "ring",
  },
  "fn-progress": {
    code: "cube { opacity: progress(sibling-index(), 1, sibling-count()); }",
    items: copies("cube", 5, (i) => ({ label: String((i - 1) / 4), fade: 0.15 + ((i - 1) / 4) * 0.85 })),
  },
  "fn-random": {
    code: "cube { translate: 0 random(0, 1) 0; }",
    items: [0.31, 0.92, 0.08, 0.64, 0.47, 0.77].map((value) => one("cube", { label: String(value), lift: Math.round(value * 40) })),
  },
  display: { code: "sphere { display: none; }", items: [one("cube"), one("sphere", { state: "absent", label: "none" }), one("torus")] },
  visibility: {
    code: ["sphere { visibility: hidden; }", "sphere { visibility: visible; }"],
    items: [one("cube"), one("sphere", { state: "blinks" }), one("torus")],
  },
};

function draw(item: Item, counter: { next: number }): string {
  if ("group" in item) {
    return `<span class="group${item.lit ? " lit" : ""}"><code>${escapeHtml(item.group)}</code>${item.items.map((inside) => draw(inside, counter)).join("")}</span>`;
  }
  const classes = ["item", item.lit ? "lit" : "", item.state ?? ""].filter(Boolean).join(" ");
  const styles = [`--i: ${counter.next++}`, item.lift ? `--lift: ${item.lift}px` : "", item.fade ? `--fade: ${+item.fade.toFixed(2)}` : ""].filter(Boolean).join("; ");
  return `<span class="${classes}" style="${styles}">${shapeSvg(item.shape, SMALL)}<code>${escapeHtml(item.label ?? "")}</code></span>`;
}

export function row(subject: string): string {
  const { code, items, kind } = ROWS[subject];
  const counter = { next: 0 };
  const drawn = items.map((item) => draw(item, counter)).join("");
  return (
    `<div class="figure-row${kind ? ` ${kind}` : ""}" style="--n: ${counter.next}">${drawn}</div>` +
    (typeof code === "string" ? says(code) : between(code[0], code[1], "2.4s"))
  );
}
export const ROW_PAGES = Object.keys(ROWS);
