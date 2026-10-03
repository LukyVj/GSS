import burgerSource from "../scenes/zdog-burger.gss?raw";
import characterSource from "../scenes/zdog-character.gss?raw";
import cameraSource from "../scenes/camera-cutaway.gss?raw";
import bloomSource from "../scenes/chromatic-bloom.gss?raw";
import circuitSource from "../scenes/glass-circuit.gss?raw";
import relicSource from "../scenes/soft-relic.gss?raw";
import gardenSource from "../scenes/candy-garden.gss?raw";
import sceneSource from "../scene.gss?raw";
import logoSource from "../scenes/logo.gss?raw";
import orrerySource from "../scenes/orrery.gss?raw";
import { FIRST_SCENE } from "../docs/guide";
import { formatGss } from "../docs/format";
import {
  PROPERTIES,
  AT_RULES,
  FUNCTIONS,
  type Example as ReferenceExample,
} from "../compiler/registry/registry";

// The scenes of the "Examples" menu. The reference ones come from the registry,
// so a new documented example shows up here with no change.
export type Example = { group: string; name: string; code: string; html?: string };

// "@media", "media" and "media()" name the same thing
const bare = (name: string) => name.replace(/^@/, "").replace(/\(\)$/, "");

// An example's own name, when it says more than the entry's and no other example of
// the entry has it: "material: Gold and chrome". Otherwise numbered: "material (2)".
function fromReference(name: string, examples: ReferenceExample[]): Example[] {
  const telling = (example: ReferenceExample) =>
    example.name !== undefined &&
    bare(example.name) !== bare(name) &&
    examples.filter((other) => other.name === example.name).length === 1;
  return examples.map((example, i) => ({
    group: "Reference",
    name: telling(example)
      ? `${name}: ${example.name}`
      : examples.length > 1
        ? `${name} (${i + 1})`
        : name,
    code: formatGss(example.code),
    ...(example.html ? { html: example.html } : {}), // the HTML of element(#id) (decision 101)
  }));
}

export const EXAMPLES: Example[] = [
  { group: "Start here", name: "First scene", code: formatGss(FIRST_SCENE) },
  { group: "Start here", name: "GSS logo", code: logoSource },
  { group: "Start here", name: "Test scene (every feature)", code: sceneSource },
  { group: "Start here", name: "L'Orrery (everything at once)", code: orrerySource },
  // The studies of the showcase, in its order
  { group: "Studies", name: "Glass Circuit (motion paths)", code: circuitSource },
  { group: "Studies", name: "Soft Relic (smooth geometry)", code: relicSource },
  { group: "Studies", name: "Candy Garden (gradients and neighbours)", code: gardenSource },
  { group: "Studies", name: "Chromatic Bloom (scroll to unfold)", code: bloomSource },
  { group: "Studies", name: "High Strut (Zdog reconstruction)", code: characterSource },
  { group: "Studies", name: "Tasty Burger (Zdog reconstruction)", code: burgerSource },
  { group: "Studies", name: "Nikon F (illustrative cutaway)", code: cameraSource },
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
