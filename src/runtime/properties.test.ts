import { describe, it, expect } from "vitest";
import { createProperties, parsePropertyValue } from "./properties";
import type { RegisteredProperty } from "../compiler/features/properties";

const SCENE: RegisteredProperty[] = [
  { name: "--h", syntax: "number", initial: [1, 0, 0, 0] },
  { name: "--turn", syntax: "angle", initial: [0, 0, 0, 0] },
  { name: "--along", syntax: "percentage", initial: [25, 0, 0, 0] },
  { name: "--tint", syntax: "color", initial: [1, 0, 0, 0] },
];

describe("the values setProperty() takes (decision 105)", () => {
  it("reads a number, an angle in radians, a percentage, a hex color", () => {
    expect(parsePropertyValue("--h", "number", "8")).toEqual([8, 0, 0, 0]);
    expect(parsePropertyValue("--h", "number", 2.5)).toEqual([2.5, 0, 0, 0]);
    expect(parsePropertyValue("--turn", "angle", "180deg")[0]).toBeCloseTo(Math.PI);
    expect(parsePropertyValue("--turn", "angle", "0.25turn")[0]).toBeCloseTo(Math.PI / 2);
    expect(parsePropertyValue("--along", "percentage", "50%")).toEqual([50, 0, 0, 0]);
    expect(parsePropertyValue("--tint", "color", "#00ff00")).toEqual([0, 1, 0, 0]);
    expect(parsePropertyValue("--tint", "color", " #f00 ")).toEqual([1, 0, 0, 0]);
  });

  it("refuses a value of another syntax, saying what it expects", () => {
    expect(() => parsePropertyValue("--h", "number", "8px")).toThrow('--h is a <number>, like "4"');
    expect(() => parsePropertyValue("--turn", "angle", 90)).toThrow('--turn is an <angle>, like "90deg"');
    expect(() => parsePropertyValue("--along", "percentage", "0.5")).toThrow('--along is a <percentage>, like "50%"');
    expect(() => parsePropertyValue("--tint", "color", "#12")).toThrow('--tint is a <color>, like "#ff5a36"');
  });
});

describe("the variables of a scene, set from JS", () => {
  it("fills uProperties[] with the initial values, then the values set", () => {
    const properties = createProperties();
    properties.use(SCENE);
    expect([...properties.values()!]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 25, 0, 0, 0, 1, 0, 0, 0]);
    properties.set("--h", "3");
    properties.set("--tint", "#0000ff");
    expect([...properties.values()!].slice(0, 4)).toEqual([3, 0, 0, 0]);
    expect([...properties.values()!].slice(12)).toEqual([0, 0, 1, 0]);
  });

  it("reads a value back like CSS, and forgets it with removeProperty()", () => {
    const properties = createProperties();
    properties.use(SCENE);
    expect(properties.get("--h")).toBe("1");
    properties.set("--turn", "0.5turn");
    expect(properties.get("--turn")).toBe("180deg");
    expect(properties.get("--tint")).toBe("#ff0000");
    properties.set("--h", 4);
    properties.remove("--h");
    expect(properties.get("--h")).toBe("1");
  });

  it("refuses a variable the scene does not register", () => {
    const properties = createProperties();
    properties.use(SCENE);
    expect(() => properties.set("--nope", "1")).toThrow(
      "--nope is not registered with @property in this scene",
    );
    expect(properties.get("--nope")).toBe("");
  });

  it("keeps the values set when the scene changes, if the variable keeps its syntax", () => {
    const properties = createProperties();
    properties.use(SCENE);
    properties.set("--h", "3");
    properties.set("--turn", "90deg");
    properties.use([
      { name: "--turn", syntax: "number", initial: [7, 0, 0, 0] },
      { name: "--h", syntax: "number", initial: [1, 0, 0, 0] },
    ]);
    expect([...properties.values()!]).toEqual([7, 0, 0, 0, 3, 0, 0, 0]);
  });

  it("has nothing to send for a scene without @property", () => {
    const properties = createProperties();
    properties.use(undefined);
    expect(properties.values()).toBeNull();
  });
});
