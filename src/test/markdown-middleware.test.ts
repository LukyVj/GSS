import { readdirSync } from "node:fs";
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

  it("answers a page that does not exist with a 404 in Markdown", async () => {
    const response = middleware(request("/no-such-page", "text/markdown"));
    expect(response?.status).toBe(404);
    expect(response?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response?.headers.get("vary")).toBe("Accept");
    const body = (await response?.text()) ?? "";
    expect(body).toMatch(/^# Not found/);
    expect(body).toContain("`/no-such-page`");
    expect(body).toContain("](https://www.gss-lang.dev/llms.txt)");
    // A browser gets the 404 of the host, in HTML
    expect(middleware(request("/no-such-page", "text/html"))).toBeUndefined();
  });

  it("leaves every page and file of the site to the host", () => {
    // bench.html is not built: it only runs in dev
    const pages = Object.keys(import.meta.glob("../../*.html"))
      .map((path) => path.replace("../../", ""))
      .filter((page) => page !== "bench.html");
    const paths = [
      "/docs/",
      "/index.md",
      "/llms.txt",
      "/llms-full.txt",
      "/sitemap.xml",
      "/robots.txt",
      "/docs/getting-started.md",
      "/assets/main-abc123.js",
      "/embed.js",
      ...pages.map((page) => `/${page}`),
      ...pages.map((page) => `/${page.replace(/\.html$/, "")}`.replace(/^\/index$/, "/")),
      ...readdirSync("public").filter((entry) => !entry.startsWith(".")).map((entry) => `/${entry}`),
      ...readdirSync("public/marks").filter((entry) => !entry.startsWith(".")).map((entry) => `/marks/${entry}`),
    ];
    for (const path of paths) {
      const response = middleware(request(path, "text/markdown"));
      expect(response?.status, path).not.toBe(404);
    }
  });
});
