import { describe, it, expect, vi } from "vitest";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "./registry";
import { coreFacts, coreModule } from "./core";

// The npm package replaces core.ts with coreModule(): the compiler without the docs.
// Every scene and example must compile to the same result, and fail with the same errors.
const scenes = import.meta.glob<string>(["../../scenes/*.gss", "../../scene.gss", "../../home/*.gss"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const examples = [...PROPERTIES, ...AT_RULES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS].flatMap((entry) =>
  entry.examples.map((example) => example.code),
);

// Wrong on purpose: each error message lists properties read from the registry
const wrong = [
  "@scene { cube; } cube { colour: red; }",
  "@scene { cube; } cube:hover { radius: 2; }",
  "@scene { cube; } @keyframes k { to { radius: 2; } } cube { animation: k 1s; }",
  "@scene { cube; } @keyframes k { to { colour: red; } } cube { animation: k 1s; }",
  "@scene { cube; light; } light { radius: 2; }",
  "@scene { cube; } scene { radius: 2; }",
  "@scene { cube; } cube { background: red; }",
  "@scene { cube; } cube { segments: 4; }",
];

type Compile = (source: string) => unknown;

function results(compile: Compile, sources: string[]): string[] {
  return sources.map((source) => {
    try {
      return JSON.stringify(compile(source));
    } catch (error) {
      return `error: ${(error as Error).message}`;
    }
  });
}

async function compiler(slim: boolean): Promise<Compile> {
  vi.resetModules();
  if (slim) vi.doMock("./core", () => JSON.parse(JSON.stringify(coreFacts())));
  else vi.doUnmock("./core");
  const { compileScene } = await import("../index");
  return compileScene;
}

describe("the compiler of the npm package (without the docs)", () => {
  it("is generated as a module of plain data", () => {
    const facts = coreFacts();
    const module = coreModule();
    expect(module).toContain(`export const PROPERTIES = ${JSON.stringify(facts.PROPERTIES)};`);
    expect(module).toContain(`export const LIGHT_TAKES = ${JSON.stringify(facts.LIGHT_TAKES)};`);
    expect(module).not.toContain("description");
    expect(module.length).toBeLessThan(10_000);
  });

  it("keeps every property, and only what the compiler reads", () => {
    const { PROPERTIES: slim } = coreFacts();
    expect(slim.map((p) => p.name)).toEqual(PROPERTIES.map((p) => p.name));
    for (const property of slim) {
      expect(Object.keys(property).every((key) => ["name", "appliesTo", "animatable"].includes(key))).toBe(true);
    }
  });

  it("compiles every scene and every example exactly like the full registry", async () => {
    const sources = [...Object.values(scenes), ...examples, ...wrong];
    expect(sources.length).toBeGreaterThan(250);
    const full = results(await compiler(false), sources);
    const slim = results(await compiler(true), sources);
    expect(slim).toEqual(full);
    expect(full.filter((result) => result.startsWith("error:")).length).toBe(wrong.length);
  }, 120_000);
});
