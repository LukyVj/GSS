import { describe, it, expect } from "vitest";

// The npm package (gss-lang) and its public page on npm: the README.
// Read as text, like the scenes: no Node API in the tests.
const files = import.meta.glob<string>(["../package.json", "../README.md", "../LICENSE", "../package-lock.json"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const pkg = JSON.parse(files["../package.json"]);
const readme = files["../README.md"] ?? "";
const license = files["../LICENSE"] ?? "";

describe("the npm package", () => {
  it("can be published, as 0.0.4", () => {
    expect(pkg.private).toBeFalsy();
    expect(pkg.version).toBe("0.0.4");
  });

  it("keeps the lockfile, README and CDN entry in sync", () => {
    const lock = JSON.parse(files["../package-lock.json"]);
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[""].version).toBe(pkg.version);
    expect(readme).toContain(`npm install gss-lang@${pkg.version}`);
    expect(readme).toContain(`https://cdn.jsdelivr.net/npm/gss-lang@${pkg.version}/lib/embed.js`);
    expect(pkg.exports["./embed"]).toBe("./lib/embed.js");
    expect(pkg.scripts["build:lib"]).toContain("vite.embed.config.ts --outDir lib");
  });

  it("says what it is, and where to find more", () => {
    expect(pkg.description).toMatch(/\w/);
    expect(pkg.keywords).toEqual(expect.arrayContaining(["css", "webgl", "glsl"]));
    expect(pkg.homepage).toBe("https://www.gss-lang.dev"); // the canonical address (www)
  });

  it("ships its runtime in lib and depends only on WebGPU type declarations", () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@webgpu/types"]);
  });

  it("asks for vite only from those who use the plugin", () => {
    expect(pkg.peerDependencies?.vite).toBeDefined();
    expect(pkg.peerDependenciesMeta?.vite?.optional).toBe(true);
  });

  it("ships only the build and the types (npm adds the README and the license)", () => {
    expect(pkg.files).toEqual(["lib", "types"]);
  });

  it("rebuilds and tests itself before it is published", () => {
    expect(pkg.scripts.prepublishOnly).toContain("build:lib");
    expect(pkg.scripts.prepublishOnly).toContain("vitest run");
  });

  it("carries the Apache 2.0 license, in package.json and in full", () => {
    expect(pkg.license).toBe("Apache-2.0");
    expect(license).toContain("Apache License");
    expect(license).toContain("Version 2.0, January 2004");
  });
});

describe("the README, the public page of the package", () => {
  it("shows its images from the site: a relative path is broken on npm", () => {
    // The images only: <img src> and <source srcset>, not the src="logo.gss" of a code example
    const sources = [...readme.matchAll(/<(?:img|source)\b[^>]*?\b(?:src|srcset)="([^"]+)"/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(source).toMatch(/^https:\/\//);
  });

  it("never mentions how we work: decisions, roadmap, design notes, paths of the repo", () => {
    for (const internal of ["DECISIONS", "ROADMAP", "DESIGN.md", "decision ", "src/", "editors/"]) {
      expect(readme).not.toContain(internal);
    }
  });

  it("tells how to install and use it, the three ways", () => {
    expect(readme).toContain("## Install");
    expect(readme).toContain("npm install gss-lang");
    expect(readme).toContain("<gss-scene");
    expect(readme).toContain("gss-lang/runtime");
    expect(readme).toContain("gss-lang/vite");
  });

  it("no longer says the package is not on npm", () => {
    expect(readme).not.toContain("not on npm");
  });
});
