// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { elementId, findElement, usesElements } from "./textures";
import { compileScene } from "../compiler";

// texture: element(#id): the slot of an HTML element of the page (decision 101)
describe("element() at run time", () => {
  it("reads the id of a slot that the compiler wrote", () => {
    const { textures } = compileScene('@scene { cube#a; cube#b; } #a { texture: element(#card); } #b { texture: url("dirt.png"); }');
    expect(textures.map(elementId)).toEqual(["card", null]);
    expect(elementId("element(#my-card_2)")).toBe("my-card_2");
    expect(elementId("dirt.png")).toBeNull();
  });

  it("finds the element inside the canvas, or shown there by a <slot> (<gss-scene>)", () => {
    const canvas = document.createElement("canvas");
    canvas.innerHTML = '<div><article id="card">hello</article></div>';
    expect(findElement(canvas, "card")?.textContent).toBe("hello");
    expect(findElement(canvas, "other")).toBeNull();

    const host = document.createElement("div");
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = "<canvas><slot></slot></canvas>";
    host.innerHTML = '<section><p id="note">slotted</p></section>';
    expect(findElement(root.querySelector("canvas")!, "note")?.textContent).toBe("slotted");
  });

  it("tells whether a scene or one of its versions uses an element", () => {
    expect(usesElements(compileScene("@scene { cube; } cube { texture: element(#card); }"))).toBe(true);
    expect(usesElements(compileScene('@scene { cube; } cube { texture: url("dirt.png"); }'))).toBe(false);
    expect(
      usesElements(compileScene("@scene { cube; } @media (max-width: 600px) { cube { texture: element(#card); } }")),
    ).toBe(true);
  });
});
