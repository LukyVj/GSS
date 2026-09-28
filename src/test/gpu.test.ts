import { describe, it, expect, afterAll } from "vitest";
import { compileOnGpu, closeGpu } from "./gpu";
import { compileGSS } from "../compiler";
import { PROPERTIES } from "../compiler/registry";
import sceneSource from "../scene.gss?raw";
import { FIRST_SCENE } from "../docs/guide";
import logoSource from "../playground/logo.gss?raw";

afterAll(closeGpu); // close Chromium when every test of this file is done

describe("compileOnGpu", () => {
  it("reports a broken shader", async () => {
    const log = await compileOnGpu(
      "#version 300 es\nprecision highp float;\nvoid main() { oops; }",
    );
    expect(log).toContain("oops");
  }, 20000); // 20 s: the first test also opens the browser
});

describe("every documented example compiles on the GPU", () => {
  for (const property of PROPERTIES) {
    for (const example of property.examples) {
      it(`${property.name}: ${example}`, async () => {
        expect(await compileOnGpu(compileGSS(example))).toBe("");
      });
    }
  }
});

it("the first scene of Getting started compiles on the GPU", async () => {
  expect(await compileOnGpu(compileGSS(FIRST_SCENE))).toBe("");
});

it("the GSS logo compiles on the GPU", async () => {
  expect(await compileOnGpu(compileGSS(logoSource))).toBe("");
});

it("the test scene compiles on the GPU", async () => {
  expect(await compileOnGpu(compileGSS(sceneSource))).toBe("");
});
