import { describe, expect, it } from "vitest";

// middleware.js sits at the root of the repo, outside the TypeScript project, where Vercel finds it
const { default: middleware } = (await import("../../middleware.js" as string)) as {
  default: (request: Request) => Response | undefined;
};

const request = (path: string, accept: string) =>
  new Request(`https://www.gss-lang.dev${path}`, { headers: { host: "www.gss-lang.dev", accept } });
const rewrite = (response: Response | undefined) => response?.headers.get("x-middleware-rewrite");

describe("the pages in Markdown, by the Accept header", () => {
  it("serves the home page and the docs as Markdown to who asks for it", () => {
    expect(rewrite(middleware(request("/", "text/markdown")))).toBe("https://www.gss-lang.dev/index.md");
    expect(rewrite(middleware(request("/", "text/markdown, text/html;q=0.8")))).toBe(
      "https://www.gss-lang.dev/index.md",
    );
    expect(rewrite(middleware(request("/docs", "text/markdown")))).toBe("https://www.gss-lang.dev/docs/README.md");
  });

  it("leaves browsers and every other page alone", () => {
    expect(middleware(request("/", "text/html,application/xhtml+xml,*/*;q=0.8"))).toBeUndefined();
    expect(middleware(request("/", "*/*"))).toBeUndefined();
    expect(middleware(request("/playground", "text/markdown"))).toBeUndefined();
    expect(middleware(request("/index.md", "text/markdown"))).toBeUndefined();
  });
});
