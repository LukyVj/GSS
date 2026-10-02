// Nesting, like CSS: a rule inside a rule, with & for the selector of the rule around it.
// The parser unfolds it into flat rules: ".a { &:hover { … } }" gives ".a:hover { … }",
// so the cascade only ever sees flat selectors.
import type { Token } from "./tokenizer";
import { rememberSpan, spanOf } from "./errors";

// Where the parent meets the nested selector, the positions in the source cannot say
// whether a space was written: in "&:hover", ".a" and ":hover" are far apart in the text.
// The copy of the token after the meeting point keeps the answer.
const joined = new WeakMap<Token, boolean>();

// Was there a space (or a comment) between these two tokens in the source?
export function spaceBetween(before: Token, after: Token): boolean {
  const space = joined.get(after);
  if (space !== undefined) return space;
  const a = spanOf(before);
  const b = spanOf(after);
  return a !== undefined && b !== undefined && a.end < b.start;
}

export const isAmpersand = (token: Token | undefined): boolean =>
  token?.type === "PUNCT" && token.value === "&";

// A copy of the token that says if a space comes before it. It keeps the position of the
// original, so an error still underlines what was written.
function glue(token: Token, space: boolean): Token {
  const copy = { ...token };
  const span = spanOf(token);
  if (span) rememberSpan(copy, span);
  joined.set(copy, space);
  return copy;
}

// The nested selector, with the parent in place of each &: ".a" and "&:hover" give ".a:hover".
// Without &, the parent comes first, then a space, like CSS: "cube" gives ".a cube",
// "> sphere" gives ".a > sphere". An & inside :has() or :not() counts.
export function nestSelector(parent: Token[], nested: Token[]): Token[] {
  if (!nested.some(isAmpersand)) return [...parent, glue(nested[0], true), ...nested.slice(1)];
  const out: Token[] = [];
  nested.forEach((token, i) => {
    const before = nested[i - 1];
    if (isAmpersand(token)) {
      const space = before !== undefined && spaceBetween(before, token);
      parent.forEach((p, j) => out.push(j === 0 && before ? glue(p, space) : p));
    } else {
      out.push(isAmpersand(before) ? glue(token, spaceBetween(before!, token)) : token);
    }
  });
  return out;
}
