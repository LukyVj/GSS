// The scene beside the changelog: a cloud of points that takes a new shape for each
// version, driven by the scroll of the page

// How many points: a cube of 4 × 4 × 4 for the grid, 8 × 8 for the waves
export const POINTS = 64;

// Each shape places point i (from 1 to POINTS) with three expressions. --k runs from 0 to
// 1 along the points, --a turns by the golden angle: together they spread the points evenly
const SHAPES: [string, string, string][] = [
  // a sphere
  ["calc(cos(var(--a)) * sqrt(1 - pow(1 - 2 * var(--k), 2)) * 1.3)", "calc((1 - 2 * var(--k)) * 1.3)", "calc(sin(var(--a)) * sqrt(1 - pow(1 - 2 * var(--k), 2)) * 1.3)"],
  // a torus: 8 rings of 8 points
  ["calc(cos(var(--row) * 45deg) * (1.1 + cos(var(--col) * 45deg) * 0.4))", "calc(sin(var(--col) * 45deg) * 0.4)", "calc(sin(var(--row) * 45deg) * (1.1 + cos(var(--col) * 45deg) * 0.4))"],
  // a double helix
  ["calc(cos(var(--i) * 22.5deg + mod(var(--i), 2) * 180deg) * 0.75)", "calc(var(--k) * 3 - 1.5)", "calc(sin(var(--i) * 22.5deg + mod(var(--i), 2) * 180deg) * 0.75)"],
  // a cube of 4 × 4 × 4
  ["calc((mod(var(--i) - 1, 4) - 1.5) * 0.6)", "calc((mod(round(down, calc((var(--i) - 1) / 4)), 4) - 1.5) * 0.6)", "calc((round(down, calc((var(--i) - 1) / 16)) - 1.5) * 0.6)"],
  // a disk of seeds, like a sunflower
  ["calc(cos(var(--a)) * sqrt(var(--k)) * 1.6)", "0", "calc(sin(var(--a)) * sqrt(var(--k)) * 1.6)"],
  // waves: a grid of 8 × 8
  ["calc((var(--col) - 3.5) * 0.36)", "calc(sin(var(--col) * 50deg) * cos(var(--row) * 50deg) * 0.45)", "calc((var(--row) - 3.5) * 0.36)"],
  // a spiral that narrows as it climbs
  ["calc(cos(var(--i) * 33deg) * (1.25 - var(--k)))", "calc(var(--k) * 2.8 - 1.4)", "calc(sin(var(--i) * 33deg) * (1.25 - var(--k)))"],
  // a seed: every point close to the center
  ["calc(cos(var(--a)) * sqrt(1 - pow(1 - 2 * var(--k), 2)) * 0.3)", "calc((1 - 2 * var(--k)) * 0.3)", "calc(sin(var(--a)) * sqrt(1 - pow(1 - 2 * var(--k), 2)) * 0.3)"],
];

const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

// The scene, for releases of these weights (about the height of each in the page, the
// newest first): each release holds its shape while it fills the middle of its part of the
// scroll, and the cloud changes shape between two releases
export function changelogScene(weights: number[]): string {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const frames: string[] = [];
  let start = 0;
  weights.forEach((weight, n) => {
    const end = start + weight / total;
    const margin = (end - start) * 0.2;
    const at = n === 0 ? [0] : [start + margin];
    at.push(n === weights.length - 1 ? 1 : end - margin);
    const vars = [0, 1, 2].map((axis) => `--${"xyz"[axis]}${n}`);
    frames.push(`  ${at.map(percent).join(", ")} { translate: ${vars.map((name) => `var(${name})`).join(" ")}; }`);
    start = end;
  });
  const shapes = weights
    .map((_, n) => SHAPES[n % SHAPES.length].map((value, axis) => `  --${"xyz"[axis]}${n}: ${value};`).join("\n"))
    .join("\n");
  return `@scene {
  group#cloud { sphere.point * ${POINTS}; }
}

scene {
  background: #0a0a0c;
  floor: none;
  ambient: 0.35;
  light: -30deg 50deg;
  camera-target: 0 0 0;
  camera-distance: 10;
  camera-angle: 20deg 18deg;
  camera-spin: none;
  controls: none;
}

#cloud {
  animation: turn 24s linear infinite;
}

.point {
  --i: sibling-index();
  --k: calc((var(--i) - 0.5) / ${POINTS});
  --a: calc(var(--i) * 137.508deg);
  --col: mod(var(--i) - 1, 8);
  --row: round(down, calc((var(--i) - 1) / 8));
${shapes}
  radius: 0.085;
  color: hsl(calc(8 + var(--k) * 34) 95% 60%);
  material: emissive(1.2);
  animation: morph 1s ease-in-out;
  animation-timeline: scroll(root);
}

@keyframes turn {
  to { rotate-y: 360deg; }
}

@keyframes morph {
${frames.join("\n")}
}
`;
}
