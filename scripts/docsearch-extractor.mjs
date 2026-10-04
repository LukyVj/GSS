// Prints the recordExtractor of the docs search as JavaScript, to paste into the Algolia
// Crawler editor in place of the one there: `npm run docsearch:extractor | pbcopy`.
// Its source, with its tests, is src/docs/crawler.ts.
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/docs/crawler.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: false },
});
const start = "export const recordExtractor = ";
const at = outputText.indexOf(start);
if (at === -1) throw new Error(`docsearch-extractor: no "${start}" in src/docs/crawler.ts`);
const extractor = outputText.slice(at + start.length).trim().replace(/;$/, "");
process.stdout.write(`${extractor}\n`);
