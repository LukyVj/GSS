import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";
import { createTransitions } from "../../runtime/transitions";
import { hoverRange } from "./codegen/bounds";
import type { Easing } from "../values/easing";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { expandScene } from "../cascade/expand";
import { resolveStyles } from "../cascade/resolve";

// march() starts with the sphere around the whole scene: a ray that passes by it
// meets no object, only the floor. The sphere must hold every object, at every
// moment of its animations, and hovered.
const sphereOf = (gss: string) => {
  const m = compileGSS(gss).match(
    /vec3 oc = ro - vec3\(([^;]*)\);\n {2}float b = dot\(oc, rd\);\n {2}float c = dot\(oc, oc\) - ([\d.e-]+);/,
  );
  if (!m) return null;
  const center = m[1].split(",").map(Number);
  return { center: center.length === 1 ? [center[0], center[0], center[0]] : center, radius: Math.sqrt(Number(m[2])) };
};
// Does the sphere hold a ball of radius r at this point?
const holds = (gss: string, point: number[], r: number) => {
  const sphere = sphereOf(gss)!;
  return Math.hypot(...point.map((p, i) => p - sphere.center[i])) + r <= sphere.radius;
};

describe("the sphere of the scene", () => {
  it("holds every object where it stands", () => {
    const gss = "@scene { sphere#a; sphere#b; } #a { translate: 2 0 0; } #b { translate: -2 1 0; radius: 0.3; }";
    expect(holds(gss, [2, 0, 0], 0.5)).toBe(true);
    expect(holds(gss, [-2, 1, 0], 0.3)).toBe(true);
  });

  it("holds an object at every keyframe of its animation", () => {
    const gss = `
      @scene { sphere; }
      sphere { animation: rise 2s ease-in-out alternate; }
      @keyframes rise { 50% { translate: 0 5 0; } to { translate: 3 0 0; } }
    `;
    expect(holds(gss, [0, 0, 0], 0.5)).toBe(true);
    expect(holds(gss, [0, 5, 0], 0.5)).toBe(true);
    expect(holds(gss, [3, 0, 0], 0.5)).toBe(true);
  });

  it("holds a hovered object where :hover takes it", () => {
    expect(holds("@scene { sphere; } sphere:hover { translate: 0 4 0; }", [0, 4, 0], 0.5)).toBe(true);
  });

  it("holds a child of a rotating group on its whole circle", () => {
    const gss = `
      @scene { group#g { sphere#s; } }
      #g { animation: spin 4s; } #s { translate: 3 0 0; }
      @keyframes spin { to { rotate-y: 1turn; } }
    `;
    for (const point of [[3, 0, 0], [-3, 0, 0], [0, 0, 3], [0, 0, -3]]) expect(holds(gss, point, 0.5)).toBe(true);
  });

  it("holds an object at its largest scale", () => {
    const gss = "@scene { sphere; } sphere { animation: grow 1s; } @keyframes grow { to { scale: 3; } }";
    expect(holds(gss, [0, 0, 0], 1.5)).toBe(true);
  });

  it("is widened by a blend: the fillet grows out of the objects", () => {
    const plain = sphereOf("@scene { sphere#a; sphere#b; } #b { translate: 1 0 0; }")!;
    const blended = sphereOf("@scene { sphere#a; sphere#b; } #b { translate: 1 0 0; blend: 0.4; }")!;
    expect(blended.radius).toBeGreaterThan(plain.radius + 0.399); // radii are rounded to 0.001
  });

  it("sends a ray that misses it to the floor, found without marching", () => {
    const shader = compileGSS("@scene { sphere; }");
    expect(shader).toContain("if (ro.y > 0.0 && c > 0.0 && (b > 0.0 || b * b < c * dot(rd, rd))) {");
    expect(shader).toContain("float floorT = rd.y < 0.0 ? -ro.y / rd.y : 1e10;");
  });

  it("sends it to nothing at all without a floor", () => {
    const shader = compileGSS("@scene { sphere; } scene { floor: none; }");
    expect(shader).not.toContain("floorT");
    expect(shader).toContain("return vec2(MAX_DIST + 1.0, 0.0);");
  });

  it("holds a hovered object with a transition that never overshoots", () => {
    const gss = "@scene { sphere; } sphere { transition: 0.4s ease-out; } sphere:hover { translate: 0 4 0; }";
    expect(holds(gss, [0, 4, 0], 0.5)).toBe(true);
  });

  it("holds a transition that overshoots, as far as uHover[] can go however often the pointer comes and goes (decision 234)", () => {
    // Up to 1.6: uHover[] stays in [-0.6 × 1.6, 1.6] / (1 - 0.36), [-1.5, 2.5]: y from -6 to 10
    const back = "@scene { sphere; } sphere { transition: 0.4s cubic-bezier(0.3, 1.6, 0.6, 1); } sphere:hover { translate: 0 4 0; }";
    expect(holds(back, [0, 10, 0], 0.5)).toBe(true);
    expect(holds(back, [0, -6, 0], 0.5)).toBe(true);
    // Up to 1.2: [-0.25, 1.25], y from -1 to 5
    const bounce = "@scene { sphere; } sphere:hover { translate: 0 4 0; transition: 1s linear(0, 1.2, 1); }";
    expect(holds(bounce, [0, 5, 0], 0.5)).toBe(true);
    expect(holds(bounce, [0, -1, 0], 0.5)).toBe(true);
  });

  it("holds a group pressed with a transition that overshoots (decisions 218 and 234)", () => {
    const pressed = "@scene { group#g { sphere; } } #g:active { translate: 0 4 0; transition: 0.4s cubic-bezier(0.3, 1.6, 0.6, 1); }";
    expect(holds(pressed, [0, 10, 0], 0.5)).toBe(true);
    expect(holds(pressed, [0, -6, 0], 0.5)).toBe(true);
  });

  it("holds an overshoot written in a longhand or in a list per property (decisions 220 and 234)", () => {
    const longhand = "@scene { sphere; } sphere { transition-duration: 0.4s; transition-timing-function: cubic-bezier(0.3, 1.6, 0.6, 1); } sphere:hover { translate: 0 4 0; }";
    expect(holds(longhand, [0, 10, 0], 0.5)).toBe(true);
    const list = "@scene { sphere; } sphere { transition: color 1s, translate 0.4s cubic-bezier(0.3, 1.6, 0.6, 1); } sphere:hover { translate: 0 4 0; }";
    expect(holds(list, [0, 10, 0], 0.5)).toBe(true);
  });

  it("is not there when a transition undershoots, or overshoots by 1 or more: uHover[] can grow at each turn", () => {
    const under = "@scene { sphere; } sphere { transition: 0.4s cubic-bezier(0.3, -0.4, 0.6, 1); } sphere:hover { translate: 0 4 0; }";
    expect(sphereOf(under)).toBeNull();
    const far = "@scene { sphere; } sphere:hover { translate: 0 4 0; transition: 1s linear(0, 2, 1); }";
    expect(sphereOf(far)).toBeNull();
  });

  it("holds a keyframe easing that overshoots, as far as its handles, and an animation that switches off (decision 219)", () => {
    const overshoot = `
      @scene { sphere; }
      sphere { animation: rise 2s cubic-bezier(0.3, -0.4, 0.7, 1.4); }
      @keyframes rise { to { translate: 0 2 0; } }
    `;
    const sphere = sphereOf(overshoot)!;
    // translate y from 0 to 2, eased between -0.4 and 1.4: from -0.8 to 2.8
    expect(sphere.center[1] - sphere.radius).toBeLessThanOrEqual(-0.8);
    expect(sphere.center[1] + sphere.radius).toBeGreaterThanOrEqual(2.8);
    const delayed = `
      @scene { sphere; }
      sphere { animation: rise 2s 1s 2; }
      @keyframes rise { to { translate: 0 2 0; } }
    `;
    // on during its two iterations only: then the translate of the sphere, 0
    const off = sphereOf(delayed)!;
    expect(off.center[1] - off.radius).toBeLessThanOrEqual(0);
    expect(off.center[1] + off.radius).toBeGreaterThanOrEqual(2);
  });

  it("is not there for an empty scene", () => {
    expect(sphereOf("@scene { }")).toBeNull();
  });
});

// The range of decision 234, against the runtime itself: the pointer comes and goes at random
// moments, each glide starts from where the value is, and the value never leaves the range

describe("uHover[] of a transition that overshoots", () => {
  const cases: [string, Easing][] = [
    ["cubic-bezier(0.3, 1.6, 0.6, 1)", { type: "cubic-bezier", x1: 0.3, y1: 1.6, x2: 0.6, y2: 1 }],
    ["linear(0, 1.2 40%, 0.9 65%, 1.05 85%, 1)", { type: "linear", points: [{ input: 0, output: 0 }, { input: 0.4, output: 1.2 }, { input: 0.65, output: 0.9 }, { input: 0.85, output: 1.05 }, { input: 1, output: 1 }] } as Easing],
    ["linear(0, 1.5 30%, 0.7 55%, 1.15 80%, 1)", { type: "linear", points: [{ input: 0, output: 0 }, { input: 0.3, output: 1.5 }, { input: 0.55, output: 0.7 }, { input: 0.8, output: 1.15 }, { input: 1, output: 1 }] } as Easing],
  ];
  for (const [name, easing] of cases) {
    it(`stays in the range the bounds read: ${name}`, () => {
      const gss = `@scene { sphere; } sphere:hover { translate: 0 1 0; } sphere { transition: 0.5s ${name}; }`;
      const stylesheet = parse(tokenize(gss));
      const [instance] = resolveStyles(expandScene(stylesheet.scene), stylesheet.rules);
      const range = hoverRange(instance, instance.groups.length)!;
      expect(range).not.toBeNull();
      const transition = { duration: 0.5, delay: 0, easing };
      const slots = createTransitions([{ enter: transition, leave: transition }]);
      let seed = 3;
      const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let now = 0;
      let target = 0;
      let [low, high] = [0, 1];
      for (let k = 0; k < 20000; k++) {
        // Hover or leave after a random moment, often in the middle of a glide, near its peak
        now += random() * 600;
        if (random() < 0.5) target = 1 - target;
        const value = slots.update(Float32Array.of(target), now)[0];
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
      expect(low).toBeGreaterThanOrEqual(range[0] - 1e-6);
      expect(high).toBeLessThanOrEqual(range[1] + 1e-6);
      expect(high).toBeGreaterThan(1); // it overshot (with 1.2, past 1.23: more than the easing alone)
    });
  }
});
