import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

type Snippet = { prefix: string; body: string[]; description?: string };

const manifest = JSON.parse(
  readFileSync(new URL("../../editors/vscode/package.json", import.meta.url), "utf8"),
);
const snippets: Record<string, Snippet> = JSON.parse(
  readFileSync(new URL("../../editors/vscode/snippets/html.json", import.meta.url), "utf8"),
);
const vscodeIgnore = readFileSync(
  new URL("../../editors/vscode/.vscodeignore", import.meta.url),
  "utf8",
);

describe("the VS Code HTML snippets", () => {
  it("registers its snippets for HTML and does not exclude them from the VSIX", () => {
    expect(manifest.contributes.snippets).toContainEqual({
      language: "html",
      path: "./snippets/html.json",
    });
    expect(vscodeIgnore).not.toMatch(/(^|\n)snippets(?:\/\*\*)?(?:\n|$)/);
  });

  it("writes the documented external <gss-scene> form", () => {
    expect(snippets["GSS scene from file"]).toMatchObject({
      prefix: "gss-scene",
      body: ['<gss-scene src="${1:scene.gss}"></gss-scene>'],
    });
  });

  it("keeps the whole inline @scene rule inside the first tabstop", () => {
    expect(snippets["GSS inline scene"]).toMatchObject({
      prefix: "gss-scene-inline",
      body: [
        "<gss-scene>",
        '  <script type="text/gss">',
        "    ${1:@scene { sphere; \\}}",
        "  </script>",
        "</gss-scene>",
      ],
    });
    // In TextMate/VS Code snippet syntax, the literal closing brace inside a
    // placeholder must be escaped or it terminates the tabstop early.
    expect(snippets["GSS inline scene"].body[2]).toContain("\\}}");
  });
});
