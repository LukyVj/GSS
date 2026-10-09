import { describe, it, expect, beforeAll } from "vitest";
import { build, type Rolldown } from "vite";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { PROPERTIES } from "./compiler/registry/registry";

// What a page downloads from the npm package, gzipped (decision 147). Each budget leaves
// room to grow a little: going past one is a choice to make, not a surprise.
const BUDGETS = {
  runtime: 14_500, // gss-lang/runtime: a scene compiled at build time (14_000 before cursor and animation-range, decisions 161 and 162)
  mount: 99_000, // gss-lang: compiles GSS text in the page (97_000 before the styles of outline-style, 98_000 before controls, decision 176)
  embed: 101_000, // gss-lang/embed: <gss-scene>, from a CDN (99_000 before the styles of outline-style, 100_000 before controls)
};

type Chunk = Rolldown.OutputChunk;
let chunks: Map<string, Chunk>;

// The entry and every file it imports, as a browser loads them
function download(entry: string): Chunk[] {
  const seen = new Map<string, Chunk>();
  const visit = (name: string) => {
    const chunk = chunks.get(name)!;
    if (seen.has(name)) return;
    seen.set(name, chunk);
    chunk.imports.forEach(visit);
  };
  visit(entry);
  return [...seen.values()];
}

const gzipped = (files: Chunk[]) => files.reduce((total, file) => total + gzipSync(file.code, { level: 9 }).length, 0);

beforeAll(async () => {
  const result = await build({
    configFile: fileURLToPath(new URL("../vite.lib.config.ts", import.meta.url)),
    logLevel: "silent",
    build: { write: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
  chunks = new Map(
    outputs.flatMap((output) => output.output).filter((file): file is Chunk => file.type === "chunk").map((chunk) => [chunk.fileName, chunk]),
  );
}, 120_000);

describe("the size of the npm package", () => {
  it("stays within its budget, entry by entry", () => {
    expect(gzipped(download("runtime.js"))).toBeLessThan(BUDGETS.runtime);
    expect(gzipped(download("index.js"))).toBeLessThan(BUDGETS.mount);
    expect(gzipped(download("embed.js"))).toBeLessThan(BUDGETS.embed);
  });

  it("never ships the compiler to a page that only draws a compiled scene", () => {
    expect(download("runtime.js").map((chunk) => chunk.fileName).join()).not.toMatch(/compiler/);
  });

  it("holds the compiler once: embed.js imports it", () => {
    const compilers = [...chunks.values()].filter((chunk) => chunk.moduleIds.some((id) => id.endsWith("compiler/index.ts")));
    expect(compilers).toHaveLength(1);
    expect(download("embed.js")).toContain(compilers[0]);
  });

  it("ships the compiler without the docs of the registry", () => {
    const code = [...chunks.values()].map((chunk) => chunk.code).join("\n");
    for (const property of PROPERTIES.slice(0, 20)) expect(code).not.toContain(property.description);
  });

  it("is minified", () => {
    for (const chunk of chunks.values()) expect(chunk.code).not.toMatch(/\n\t/);
  });
});
