// The three ways to put a scene on a page (decision 63), shown on the showcase and in the docs
export const EMBED_SNIPPETS: {
  title: string;
  who: string;
  lang: "html" | "js";
  code: string;
}[] = [
  {
    title: "A tag",
    who: "no build step",
    lang: "html",
    code: `<script type="module" src="https://gss-lang.dev/embed.js"></script>\n\n<gss-scene src="logo.gss"></gss-scene>\n<gss-scene controls="none">\n  <script type="text/gss"> @scene { sphere; } </script>\n</gss-scene>`,
  },
  {
    title: "A function",
    who: "npm i gss-lang",
    lang: "js",
    code: `import { mount } from "gss-lang";\n\nconst scene = mount(canvas, "@scene { sphere; }");\nscene.update(otherSource);\nscene.destroy();`,
  },
  {
    title: "A build step",
    who: "Vite, compiled ahead",
    lang: "js",
    code: `// vite.config.ts\nimport gss from "gss-lang/vite";\nexport default { plugins: [gss()] };\n\n// main.ts: the compiler stays out of the page\nimport { mount } from "gss-lang/runtime";\nimport logo from "./logo.gss";\nmount(canvas, logo);`,
  },
];
