// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { enableTocGroups } from "./toc-groups";
import { renderDocs } from "./render";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
});

it("renders every group with a native summary and keeps article links inside", () => {
  const groups = [...document.querySelectorAll(".toc-group")];
  expect(groups.length).toBeGreaterThan(10);
  for (const group of groups) {
    expect(group.tagName).toBe("DETAILS");
    expect(group.firstElementChild?.tagName).toBe("SUMMARY");
    expect(group.querySelector("summary a, summary button")).toBeNull();
    expect(group.querySelectorAll("ul a").length).toBeGreaterThan(0);
  }
});

it("reveals a deep-linked page without closing other groups or moving focus", () => {
  const reveal = enableTocGroups(document.body);
  const installation = document.querySelector<HTMLDetailsElement>('[data-group="installation"]')!;
  const colors = document.querySelector<HTMLDetailsElement>('[data-group="colors"]')!;
  installation.open = true;
  installation.querySelector("summary")!.focus();
  reveal(document.querySelector('.toc a[href="#fn-oklab-oklch"]'));
  expect(colors.open).toBe(true);
  expect(colors.hasAttribute("data-current")).toBe(true);
  expect(installation.open).toBe(true);
  expect(document.activeElement).toBe(installation.querySelector("summary"));
  reveal(document.querySelector('.toc a[href="#embedding"]'));
  expect(colors.hasAttribute("data-current")).toBe(false);
  expect(installation.hasAttribute("data-current")).toBe(true);
});

it("restores and saves explicit expansion choices", () => {
  sessionStorage.setItem("gss-docs-groups", JSON.stringify({ installation: true, "getting-started": false }));
  enableTocGroups(document.body);
  const group = document.querySelector<HTMLDetailsElement>('[data-group="installation"]')!;
  expect(group.open).toBe(true);
  expect(document.querySelector<HTMLDetailsElement>('[data-group="getting-started"]')!.open).toBe(false);
  group.open = false;
  group.dispatchEvent(new Event("toggle"));
  expect(JSON.parse(sessionStorage.getItem("gss-docs-groups")!).installation).toBe(false);
});

it("works when storage is unavailable or malformed", () => {
  sessionStorage.setItem("gss-docs-groups", "not json");
  expect(() => enableTocGroups(document.body)).not.toThrow();
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(() => enableTocGroups(document.body)).not.toThrow();
  get.mockRestore();
});
