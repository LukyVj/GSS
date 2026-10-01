import pkg from "../package.json" with { type: "json" };

// The package version is also the version shown by the site and installation docs.
export const VERSION = pkg.version;
export const CDN_URL = `https://cdn.jsdelivr.net/npm/gss-lang@${VERSION}/lib/embed.js`;
