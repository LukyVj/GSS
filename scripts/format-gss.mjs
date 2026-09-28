// Formats .gss files with formatGss, the same function the docs use.
//   npm run format            rewrites every .gss file in src/
//   npm run format -- --check  only lists files that are not formatted (exit code 1)
//   npm run format -- a.gss    formats only the files given
import { readFileSync, writeFileSync, globSync } from "node:fs";
import { runnerImport } from "vite";

const { module } = await runnerImport("./src/docs/format.ts");
const { formatGss } = module;

const args = process.argv.slice(2);
const check = args.includes("--check");
const given = args.filter((arg) => !arg.startsWith("--"));
const files = given.length > 0 ? given : globSync("src/**/*.gss");

let unformatted = 0;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const formatted = formatGss(source);
  if (formatted === source) continue;
  unformatted++;
  if (check) console.log(`not formatted: ${file}`);
  else {
    writeFileSync(file, formatted);
    console.log(`formatted: ${file}`);
  }
}

if (check && unformatted > 0) process.exit(1);
