import { describe, it, expect, afterAll } from "vitest";
import { compileOnGpu, closeGpu } from "./gpu";
import { compileGSS, compileScene } from "../compiler";
import { toShadertoy } from "../compiler/shader/shadertoy";
import {
  PROPERTIES,
  SELECTORS,
  SHAPE_DOCS,
  FUNCTIONS,
} from "../compiler/registry/registry";
import sceneSource from "../scene.gss?raw";
import { FIRST_SCENE } from "../docs/guide";
import logoSource from "../scenes/logo.gss?raw";
import { USE_CASES } from "../showcase/content";

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
  for (const shape of SHAPE_DOCS) {
    for (const example of shape.examples) {
      it(`${shape.name}: ${example}`, async () => {
        expect(await compileOnGpu(compileGSS(example))).toBe("");
      });
    }
  }
  for (const selector of SELECTORS) {
    for (const example of selector.examples) {
      it(`${selector.name}: ${example}`, async () => {
        expect(await compileOnGpu(compileGSS(example))).toBe("");
      });
    }
  }
  for (const fn of FUNCTIONS) {
    for (const example of fn.examples) {
      it(`${fn.name}: ${example}`, async () => {
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

// Decision 63: the live scenes of showcase.html
describe("every showcase scene compiles on the GPU", () => {
  for (const useCase of USE_CASES) {
    it(useCase.slug, async () => {
      expect(await compileOnGpu(compileGSS(useCase.scene))).toBe("");
    });
  }
});

// What Shadertoy puts around the code we paste (the part that matters to compile)
const SHADERTOY_HEADER = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
out vec4 fragColor;
`;

it("the Shadertoy export compiles once Shadertoy wraps it", async () => {
  const code = toShadertoy(compileScene(sceneSource));
  const wrapped = `${SHADERTOY_HEADER}\n${code}\nvoid main() { mainImage(fragColor, gl_FragCoord.xy); }`;
  expect(await compileOnGpu(wrapped)).toBe("");
});
