import { describe, it, expect } from "vitest";
import { resolvePage, neighbors, type PageIndex } from "./pages";

const index: PageIndex = {
  sections: [
    { id: "getting-started", entries: ["why-gss", "first-scene"] },
    { id: "object-properties", entries: ["translate", "material"] },
  ],
};

describe("resolvePage", () => {
  it("shows the entry of the hash", () => {
    expect(resolvePage("#material", index)).toEqual({ page: "material", target: null });
  });
  it("shows the entry of a part, and scrolls to the part", () => {
    expect(resolvePage("#material--example-2", index)).toEqual({ page: "material", target: "material--example-2" });
  });
  it("opens a section at its first entry", () => {
    expect(resolvePage("#object-properties", index).page).toBe("translate");
  });
  it("starts at the first entry without a hash, or with an unknown one", () => {
    expect(resolvePage("", index).page).toBe("why-gss");
    expect(resolvePage("#nope", index).page).toBe("why-gss");
  });
});

describe("neighbors", () => {
  it("crosses sections, in reading order", () => {
    expect(neighbors("first-scene", index)).toEqual({ previous: "why-gss", next: "translate" });
  });
  it("has no previous at the start and no next at the end", () => {
    expect(neighbors("why-gss", index).previous).toBeUndefined();
    expect(neighbors("material", index).next).toBeUndefined();
  });
});
