import { PROPERTIES, SELECTORS, SHAPE_DOCS } from "../compiler/registry/registry";
import { CDN_URL, VERSION } from "../version";

// The files the site serves to crawlers and language models, written at build next to the
// pages: sitemap.xml, llms.txt (and llms-full.txt), the docs as Markdown (/docs/*.md, the
// same files as docs/ on GitHub) and the home page as Markdown (/index.md).

const SITE = "https://www.gss-lang.dev";

// Every page of the site, by its canonical path
export const SITE_PAGES = ["/", "/docs", "/playground", "/showcase", "/brand", "/changelog"];

const SUMMARY =
  "GSS writes 3D scenes in CSS: shapes declared in `@scene`, styled with selectors, the cascade and `@keyframes`, and compiled into one raymarching fragment shader for WebGL2 and WebGPU. No Three.js, no meshes.";

// docs/*.md, written from the reference of the site by `npm run docs:github`
const GITHUB_DOCS = import.meta.glob<string>("../../docs/*.md", { query: "?raw", import: "default", eager: true });

const docPage = (name: string) => (GITHUB_DOCS[`../../docs/${name}`] ?? "").replace(/^<!--[^\n]*-->\n+/, "");

// The pages of the docs, in the order of their index
function docPages(): string[] {
  return [...docPage("README.md").matchAll(/^- \[[^\]]+\]\(([^)]+\.md)\)/gm)].map((m) => m[1]);
}

function sitemapXml(): string {
  const urls = SITE_PAGES.map((page) => `  <url>\n    <loc>${SITE}${page}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// llms.txt (llmstxt.org): the title, a summary, then the index of the docs, linked as Markdown
function llmsTxt(): string {
  const sections = docPage("README.md")
    .slice(docPage("README.md").indexOf("\n## "))
    .replace(/\]\(([^)]+\.md)\)/g, `](${SITE}/docs/$1)`)
    .trim();
  return `# GSS (GPU Style Sheets)

> ${SUMMARY}

GSS takes CSS syntax and CSS behavior wherever CSS has the notion: selectors, combinators, pseudo-classes, the cascade, \`var()\`, \`calc()\`, \`@keyframes\`, \`@media\`, transitions. What is new is the 3D vocabulary: shapes, materials, the camera, lights. The npm package is \`gss-lang\` (v${VERSION}); every example of the docs can be edited live at ${SITE}/docs.

${sections}

## Optional

- [Every page of the docs in one file](${SITE}/llms-full.txt)
- [The home page](${SITE}/index.md): what GSS is, and the three ways to install it
- [Playground](${SITE}/playground): write a scene and see it compile as you type
- [Source on GitHub](https://github.com/LukyVj/GSS)
`;
}

function llmsFullTxt(): string {
  const pages = docPages().map((name) => docPage(name).trim());
  return `# GSS (GPU Style Sheets)\n\n> ${SUMMARY}\n\n${pages.join("\n\n---\n\n")}\n`;
}

// The home page (index.html) in Markdown: the same headings and the same words
function homeMarkdown(): string {
  return `# GSS — GPU Style Sheets

## Style sheets for the GPU.

Selectors, the cascade and \`@keyframes\`, compiled into a single raymarching shader. No Three.js. No meshes. Just CSS you already know.

- [Open the playground](${SITE}/playground)
- [Read the docs](${SITE}/docs) (also [as Markdown](${SITE}/llms.txt))

## Rules, not loops

Style a thousand objects with one selector. The cascade decides, like on a web page.

\`\`\`css
@scene { cube.corner * 4; }
.corner { color: #ff5a36; }
\`\`\`

## One shader

The compiler writes the GLSL: the whole scene becomes one fragment shader, raymarched on the GPU.

## LLMs already speak it

Every model knows CSS by heart. It writes the style sheet; the compiler writes the shader.

\`\`\`css
#dot {
  material: jelly(0.6);
}
\`\`\`

## Edit it. It compiles as you type.

The home page runs a live scene next to its code: edit the code and the scene compiles again. Drag to orbit, scroll to zoom. The same in the [playground](${SITE}/playground).

## GSS in numbers

${SHAPE_DOCS.length} shapes, ${PROPERTIES.length} properties, ${SELECTORS.length} selectors, 1 shader.

## npm package

Compile and render GSS in your application, with TypeScript types included.

\`\`\`sh
npm install gss-lang@${VERSION}
\`\`\`

[Package setup](${SITE}/docs#install-package)

## Vite plugin

Included in gss-lang. Import .gss files and ship the runtime with the compiled scene.

\`\`\`js
import gss from "gss-lang/vite";
\`\`\`

[Vite setup](${SITE}/docs#install-vite)

## CDN

Load the versioned browser module, then add a \`<gss-scene>\` to your page.

\`\`\`html
<script type="module" src="${CDN_URL}"></script>
\`\`\`

[CDN setup](${SITE}/docs#install-cdn)

## Thank you to everyone whose work is in GSS

Want to be on this list? Read the [contributing guide](https://github.com/LukyVj/GSS/blob/main/CONTRIBUTING.md), then open a pull request.

## Contact

Questions, ideas, a scene to show? Say hi on X, [@GSS_lang](https://x.com/GSS_lang), or [open an issue](https://github.com/LukyVj/GSS/issues) on GitHub.
`;
}

export function machineFiles(): Map<string, string> {
  const files = new Map<string, string>([
    ["sitemap.xml", sitemapXml()],
    ["llms.txt", llmsTxt()],
    ["llms-full.txt", llmsFullTxt()],
    ["index.md", homeMarkdown()],
  ]);
  for (const path of Object.keys(GITHUB_DOCS)) {
    const name = path.replace("../../docs/", "");
    files.set(`docs/${name}`, docPage(name));
  }
  return files;
}
