// Vercel Routing Middleware: staging.gss-lang.dev asks for a password before anything is
// served. The password is the STAGING_PASSWORD environment variable of the Vercel project,
// never in the code. Any user name is accepted. On every host, a request that asks for
// Markdown (Accept: text/markdown) gets the home page or the docs in Markdown, and a path the
// site does not have gets its 404 in Markdown.
const STAGING_HOST = "staging.gss-lang.dev";

// The pages that have a Markdown version, written at build
const MARKDOWN = { "/": "/index.md", "/docs": "/docs/README.md" };

// What the site serves: its pages (with or without .html), the folders of the build and the
// files at its root. Any other path is a 404.
const PAGES = ["/", "/docs", "/playground", "/showcase", "/brand", "/changelog", "/privacy", "/about", "/contact"];
const FILES = /^\/(assets|marks|textures|showcase|studies|docs)(\/|$)|^\/[\w.-]+\.[a-z0-9]+$/i;

export default function middleware(request) {
  if ((request.headers.get("host") ?? "") === STAGING_HOST) {
    const refused = stagingRefusal(request);
    if (refused) return refused;
  }
  return markdownRewrite(request);
}

// Serves the Markdown file in place of the page, at the same URL
function markdownRewrite(request) {
  if (!/(^|[,\s])text\/markdown\b/.test(request.headers.get("accept") ?? "")) return;
  const url = new URL(request.url);
  const markdown = MARKDOWN[url.pathname];
  if (markdown) {
    return new Response(null, { headers: { "x-middleware-rewrite": new URL(markdown, url).toString() } });
  }
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
  if (PAGES.includes(path) || FILES.test(path)) return;
  return new Response(notFound(url.pathname), {
    status: 404,
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}

function notFound(path) {
  return `# Not found

There is no page at \`${path}\` on gss-lang.dev.

- [GSS, the home page](https://www.gss-lang.dev/index.md)
- [The docs, for language models](https://www.gss-lang.dev/llms.txt)
- [Every page of the site](https://www.gss-lang.dev/sitemap.xml)
`;
}

function stagingRefusal(request) {
  const password = process.env.STAGING_PASSWORD;
  // Without a password set, stay closed rather than open
  if (!password) return new Response("Staging is not configured.", { status: 503 });

  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      // Not base64: refused below
    }
    // user:password, the password may itself contain colons
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (decoded.includes(":") && sameText(given, password)) return;
  }
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GSS staging", charset="UTF-8"' },
  });
}

// Compares in a time that does not depend on where the texts differ
function sameText(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
