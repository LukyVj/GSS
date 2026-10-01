import type { Plugin, ViteDevServer } from "vite";
import { createServer } from "vite";

// Injects docs / home / showcase HTML at transformIndexHtml so those pages are
// readable without JS. Playground stays client-rendered.
// Modules are loaded through Vite SSR (supports `.gss?raw`) rather than imported
// into vite.config, which would pull the whole app into the config bundle.

function pageName(filename: string): string {
  return filename.replace(/\\/g, "/").split("/").pop() ?? "";
}

export function prerenderSite(): Plugin {
  let dev: ViteDevServer | undefined;
  let build: ViteDevServer | undefined;
  let root = process.cwd();

  async function load<T>(id: string): Promise<T> {
    const server = dev ?? build;
    if (!server) throw new Error("gss-prerender: Vite server not ready");
    return server.ssrLoadModule(id) as Promise<T>;
  }

  return {
    name: "gss-prerender",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      dev = server;
    },
    async buildStart() {
      if (dev) return;
      build = await createServer({
        configFile: false,
        root,
        server: { middlewareMode: true },
        appType: "custom",
      });
    },
    async buildEnd() {
      await build?.close();
      build = undefined;
    },
    transformIndexHtml: {
      order: "pre",
      async handler(html, ctx) {
        const name = pageName(ctx.filename || ctx.path || "");
        if (name === "docs.html") {
          const { prerenderDocsHtml } = await load<{
            prerenderDocsHtml: (html: string) => string;
          }>("/src/docs/prerender.ts");
          return prerenderDocsHtml(html);
        }
        if (name === "index.html") {
          const { prerenderHomeHtml } = await load<{
            prerenderHomeHtml: (html: string) => string;
          }>("/src/home/prerender.ts");
          return prerenderHomeHtml(html);
        }
        if (name === "showcase.html") {
          const { prerenderShowcaseHtml } = await load<{
            prerenderShowcaseHtml: (html: string) => Promise<string>;
          }>("/src/showcase/prerender.ts");
          return prerenderShowcaseHtml(html);
        }
        return html;
      },
    },
  };
}
