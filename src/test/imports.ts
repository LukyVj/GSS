// Test helper (decision 63): every module a file really imports (not `import type`),
// followed from file to file. The files are read with Vite's glob, as text.
const SOURCES = import.meta.glob<string>(["../**/*.ts", "!../**/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

// "../runtime/view.ts" + "./hover" → "../runtime/hover.ts"
function join(from: string, path: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  const bare = parts.join("/");
  return (
    [`${bare}.ts`, `${bare}/index.ts`, bare].find((key) => key in SOURCES) ??
    bare
  );
}

// file: a path from src, like "runtime/view.ts". Returns paths from src too.
export function valueImports(file: string): string[] {
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key) || !(key in SOURCES)) return;
    seen.add(key);
    const pattern = /^import\s+(?!type\s)[^;]*?from\s+"(\.[^"]+)"/gms;
    for (const [, path] of SOURCES[key].matchAll(pattern))
      visit(join(key, path));
  };
  visit(`../${file}`);
  return [...seen].map((key) => key.slice(3));
}
