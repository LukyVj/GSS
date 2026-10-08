// What is new in the docs: the pages of the newest version that is out. The "New in" of the
// search and the "new" of the contents read the same rule, so they never disagree.
import { VERSION } from "../version";

// "0.0.10" comes after "0.0.9"
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((version) => version.split(".").map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const difference = (x[i] ?? 0) - (y[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

// The newest version that added pages and is published: a version newer than the package
// waits, the docs describe it before it is out
export function newestVersion(versions: (string | undefined)[], published = VERSION): string | null {
  const out = versions.filter((v): v is string => !!v && compareVersions(v, published) <= 0);
  if (!out.length) return null;
  return out.reduce((newest, other) => (compareVersions(other, newest) > 0 ? other : newest));
}
