import sceneSource from "../scene.gss?raw";
import logoSource from "./logo.gss?raw";
import { FIRST_SCENE } from "../docs/guide";
import { formatGss } from "../docs/format";
import { PROPERTIES, AT_RULES, FUNCTIONS } from "../compiler/registry";

// The scenes of the "Examples" menu. The reference ones come from the registry,
// so a new documented example shows up here with no change.
export type Example = { group: string; name: string; code: string };

function fromReference(name: string, examples: string[]): Example[] {
  return examples.map((code, i) => ({
    group: "Reference",
    name: examples.length > 1 ? `${name} (${i + 1})` : name,
    code: formatGss(code),
  }));
}

export const EXAMPLES: Example[] = [
  { group: "Start here", name: "First scene", code: formatGss(FIRST_SCENE) },
  { group: "Start here", name: "GSS logo", code: logoSource },
  { group: "Start here", name: "Test scene (every feature)", code: sceneSource },
  ...AT_RULES.flatMap((atRule) => fromReference(`@${atRule.name}`, atRule.examples)),
  ...FUNCTIONS.flatMap((fn) => fromReference(fn.name, fn.examples)),
  ...PROPERTIES.flatMap((property) => fromReference(property.name, property.examples)),
];

// The <option>s of the menu, grouped. The value of an option is its index in EXAMPLES.
export function renderExampleOptions(): string {
  const groups = [...new Set(EXAMPLES.map((example) => example.group))];
  return groups
    .map((group) => {
      const options = EXAMPLES.map((example, index) => ({ example, index }))
        .filter(({ example }) => example.group === group)
        .map(({ example, index }) => `<option value="${index}">${example.name}</option>`)
        .join("");
      return `<optgroup label="${group}">${options}</optgroup>`;
    })
    .join("");
}
