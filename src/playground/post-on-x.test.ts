import { describe, it, expect } from "vitest";
import { postOnXUrl } from "./post-on-x";

describe("postOnXUrl", () => {
  const url = postOnXUrl("https://www.gss-lang.dev/playground#abc");
  const params = new URL(url).searchParams;

  it("opens the post composer of X", () => {
    expect(url.startsWith("https://x.com/intent/post?")).toBe(true);
  });
  it("carries the share link of the scene", () => {
    expect(params.get("url")).toBe("https://www.gss-lang.dev/playground#abc");
  });
  it("mentions the GSS account, so the post reaches it", () => {
    expect(params.get("text")).toContain("@GSS_lang");
    expect(params.get("text")).not.toContain("http"); // the link is in url=, once
  });
});
