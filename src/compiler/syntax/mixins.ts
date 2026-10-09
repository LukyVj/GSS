// Mixins, like the CSS draft (CSS Functions and Mixins): a block of declarations and rules,
// named once and put into any rule.
//
//   @mixin --ball(--size: 0.4, --tint) { radius: var(--size); color: var(--tint); }
//   sphere { @apply --ball(0.6, #ff5a36); }
//
// The parser takes the @mixin rules out of the file (readMixins), and puts the tokens of the
// mixin in place of each @apply (expandApply), with the parameters replaced by their values:
// what it reads next is what the author would have written by hand, so the rest of the
// compiler never sees a mixin, and the shader is the same.
import type { Token } from "./tokenizer";
import { ErrorSink, errorAt, errorsOf } from "./errors";

export type Parameter = {
  name: Token; // --size
  value?: Token[]; // its default, after ":"
};

export type Mixin = {
  name: Token; // --ball, as written (for the errors)
  parameters: Parameter[];
  body: Token[]; // between its braces
};

export type Mixins = Map<string, Mixin>;

// @apply --name(arguments) { contents };
export type Apply = {
  at: Token; // @apply
  name: Token;
  args: Token[][];
  contents?: Token[]; // the block, without its braces; undefined without a block
  end: number; // the index after the statement, its ";" included
};

const isPunct = (token: Token | undefined, value: string): boolean =>
  token?.type === "PUNCT" && token.value === value;
const isAt = (token: Token | undefined, value: string): boolean =>
  token?.type === "AT_KEYWORD" && token.value === value;
const isDashed = (token: Token | undefined): boolean =>
  token?.type === "IDENT" && token.value.startsWith("--");

// The index of the "}" or ")" that closes the bracket at `open`, or -1 when it never closes.
// Both kinds are counted: a "(" inside a block, a "{" inside the arguments.
function closing(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const token = tokens[i];
    if (isPunct(token, "(") || isPunct(token, "{")) depth++;
    if (isPunct(token, ")") || isPunct(token, "}")) depth--;
    if (depth === 0) return i;
  }
  return -1;
}

// The tokens between two brackets, split at the commas outside any bracket
function splitCommas(tokens: Token[]): { items: Token[][]; commas: Token[] } {
  const items: Token[][] = [[]];
  const commas: Token[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (isPunct(token, "(") || isPunct(token, "{")) depth++;
    if (isPunct(token, ")") || isPunct(token, "}")) depth--;
    if (depth === 0 && isPunct(token, ",")) {
      items.push([]);
      commas.push(token);
    } else items[items.length - 1].push(token);
  }
  return { items, commas };
}

// A value with a comma of its own is written between braces, like CSS: {color 1s, scale 2s}
function unwrap(value: Token[]): Token[] {
  const last = value.length - 1;
  return isPunct(value[0], "{") && closing(value, 0) === last ? value.slice(1, last) : value;
}

// Ends a list of declarations with a ";", so what follows it starts a new one
function closed(tokens: Token[]): Token[] {
  const last = tokens[tokens.length - 1];
  if (!last || isPunct(last, ";") || isPunct(last, "}")) return tokens;
  return [...tokens, { type: "PUNCT", value: ";" }];
}

// ----- @mixin -----

// The @mixin rules of the top level of the file, and the tokens without them. A broken
// @mixin is reported, and left out.
export function readMixins(input: Token[], sink: ErrorSink): { tokens: Token[]; mixins: Mixins } {
  const tokens: Token[] = [];
  const mixins: Mixins = new Map();
  let depth = 0;
  let i = 0;
  while (i < input.length) {
    const token = input[i];
    if (depth === 0 && isAt(token, "mixin")) {
      let end = input.length;
      try {
        const { mixin, next } = readMixin(input, i);
        mixins.set(String(mixin.name.value), mixin); // the last one of a name wins, like CSS
        end = next;
      } catch (caught) {
        for (const error of errorsOf(caught)) sink.add(error);
        end = skipMixin(input, i);
      }
      i = end;
      continue;
    }
    if (isPunct(token, "{")) depth++;
    if (isPunct(token, "}")) depth = Math.max(0, depth - 1);
    tokens.push(token);
    i++;
  }
  return { tokens, mixins };
}

// After a broken @mixin: up to its ";", or the end of its block
function skipMixin(tokens: Token[], at: number): number {
  for (let i = at + 1; i < tokens.length; i++) {
    if (isPunct(tokens[i], ";")) return i + 1;
    if (isPunct(tokens[i], "{")) {
      const end = closing(tokens, i);
      return end === -1 ? tokens.length : end + 1;
    }
  }
  return tokens.length;
}

// @mixin --name(--a, --b: 1) { … }, from the @mixin at `at`
function readMixin(tokens: Token[], at: number): { mixin: Mixin; next: number } {
  const name = tokens[at + 1];
  if (!isDashed(name))
    throw errorAt(name ?? tokens[at], "@mixin takes a name that starts with --, like: @mixin --name { … }");
  let i = at + 2;
  let parameters: Parameter[] = [];
  if (isPunct(tokens[i], "(")) {
    const end = closing(tokens, i);
    if (end === -1) throw errorAt(tokens[i], `The parameters of @mixin ${name.value} are never closed: ")" missing`);
    parameters = readParameters(tokens.slice(i + 1, end), name);
    i = end + 1;
  }
  const open = tokens[i];
  if (!isPunct(open, "{"))
    throw errorAt(open ?? name, `@mixin ${name.value} takes a block, like: @mixin ${name.value} { color: red; }`);
  const end = closing(tokens, i);
  if (end === -1) throw errorAt(open, `@mixin ${name.value} never closed: "}" missing`);
  const body = tokens.slice(i + 1, end);
  // A parameter has the value @apply gives it: the mixin cannot set it
  let parens = 0;
  body.forEach((token, n) => {
    if (isPunct(token, "(")) parens++;
    if (isPunct(token, ")")) parens--;
    if (parens === 0 && isPunct(body[n + 1], ":") && parameters.some((p) => p.name.value === token.value))
      throw errorAt(token, `${token.value} is a parameter of ${name.value}: it cannot be declared inside it`);
  });
  return { mixin: { name, parameters, body }, next: end + 1 };
}

// --a, --b <color>: red, --c * : 1
function readParameters(tokens: Token[], mixin: Token): Parameter[] {
  if (tokens.length === 0) return [];
  const { items, commas } = splitCommas(tokens);
  const parameters: Parameter[] = [];
  items.forEach((item, n) => {
    const [name] = item;
    if (!name) throw errorAt(commas[n - 1] ?? commas[n], `A parameter of @mixin ${mixin.value} is empty`);
    if (!isDashed(name))
      throw errorAt(name, "A parameter of @mixin is a name that starts with --, like: @mixin --m(--size: 1) { … }");
    if (parameters.some((p) => p.name.value === name.value))
      throw errorAt(name, `${name.value} is twice a parameter of ${mixin.value}`);
    // A type, like CSS: <number>, or * for any value. The property that gets the value checks it.
    let i = 1;
    if (isPunct(item[i], "*")) i++;
    else if (isPunct(item[i], "<") && item[i + 1]?.type === "IDENT" && isPunct(item[i + 2], ">")) i += 3;
    if (i < item.length && !isPunct(item[i], ":"))
      throw errorAt(
        item.slice(i),
        `After ${name.value}, a type like <number>, or ":" and a default, like: @mixin ${mixin.value}(${name.value}: 1) { … }`,
      );
    if (i === item.length) {
      parameters.push({ name });
      return;
    }
    const value = unwrap(item.slice(i + 1));
    if (value.length === 0) throw errorAt(item[i], `${name.value} has no default after ":"`);
    parameters.push({ name, value });
  });
  return parameters;
}

// ----- @apply -----

// @apply --name(…) { … }; from the @apply at `at`. The ";" is optional before a "}" and after
// a block, like the last declaration of a block.
export function readApply(tokens: Token[], at: number): Apply {
  const name = tokens[at + 1];
  if (!isDashed(name))
    throw errorAt(name ?? tokens[at], "@apply names a mixin, like: @apply --name;");
  let i = at + 2;
  let args: Token[][] = [];
  if (isPunct(tokens[i], "(")) {
    const end = closing(tokens, i);
    if (end === -1) throw errorAt(tokens[i], `The arguments of @apply ${name.value} are never closed: ")" missing`);
    const inside = tokens.slice(i + 1, end);
    if (inside.length > 0) {
      const { items, commas } = splitCommas(inside);
      items.forEach((item, n) => {
        if (item.length === 0)
          throw errorAt(commas[n - 1] ?? commas[n], `An argument of @apply ${name.value} is empty`);
      });
      args = items.map(unwrap);
    }
    i = end + 1;
  }
  let contents: Token[] | undefined;
  if (isPunct(tokens[i], "{")) {
    const end = closing(tokens, i);
    if (end === -1) throw errorAt(tokens[i], `The block of @apply ${name.value} is never closed: "}" missing`);
    contents = tokens.slice(i + 1, end);
    i = end + 1;
  }
  if (isPunct(tokens[i], ";")) i++;
  else if (contents === undefined && tokens[i] && !isPunct(tokens[i], "}"))
    throw errorAt(tokens[i], `";" expected after @apply ${name.value}, but found "${tokens[i].value}"`);
  return { at: tokens[at], name, args, contents, end: i };
}

// The tokens that take the place of an @apply: the body of the mixin, its @apply unfolded
// in turn, its parameters replaced by their values, and its @contents by the block of the
// @apply. chain: the mixins being applied, to find a mixin that applies itself.
export function expandApply(apply: Apply, mixins: Mixins, chain: string[] = []): Token[] {
  const name = String(apply.name.value);
  const mixin = mixins.get(name);
  if (!mixin)
    throw errorAt(apply.name, `The mixin ${name} is not defined: write @mixin ${name} { … } outside the rules`);
  if (chain.includes(name))
    throw errorAt(apply.name, `${name} applies itself: ${[...chain.slice(chain.indexOf(name)), name].join(" → ")}`);
  const { parameters } = mixin;
  if (apply.args.length > parameters.length) {
    const count = parameters.length;
    const takes =
      count === 0
        ? "no argument"
        : `${count} argument${count > 1 ? "s" : ""} (${parameters.map((p) => p.name.value).join(", ")})`;
    throw errorAt(apply.args.slice(count).flat(), `${name} takes ${takes}, not ${apply.args.length}`);
  }
  // The rules that apply this one first, then its parameters: a mixin it applies sees its
  // parameters, as in CSS, where a mixin sees what the rule it lands in sees
  const body = expandAll(mixin.body, mixins, [...chain, name]);
  const values = new Map<string, Token[] | undefined>(
    parameters.map((p, n) => [String(p.name.value), apply.args[n]]),
  );
  // The block of the @apply belongs to the rule it is written in: unfolded with its chain
  const contents = apply.contents && expandAll(apply.contents, mixins, chain);
  return closed(replaceContents(substitute(body, mixin, values, apply), contents));
}

// Every @apply of a list of tokens, unfolded: the body of a mixin, or the block of an @apply
function expandAll(tokens: Token[], mixins: Mixins, chain: string[]): Token[] {
  if (!tokens.some((token) => isAt(token, "apply"))) return tokens;
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isAt(tokens[i], "apply")) {
      out.push(tokens[i++]);
      continue;
    }
    const apply = readApply(tokens, i);
    out.push(...expandApply(apply, mixins, chain));
    i = apply.end;
  }
  return out;
}

// var(--param) and var(--param, fallback), replaced by the value the parameter takes: its
// argument, else its default, else the fallback of the var(). A default can read another
// parameter (the chain finds a loop). The values put in are not read again: they belong to
// the rule that applies the mixin.
function substitute(
  tokens: Token[],
  mixin: Mixin,
  values: Map<string, Token[] | undefined>,
  apply: Apply,
  chain: string[] = [],
): Token[] {
  if (values.size === 0) return tokens; // a mixin without parameters
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const name = tokens[i + 2];
    const read =
      token.type === "IDENT" && token.value === "var" && isPunct(tokens[i + 1], "(") && isDashed(name);
    if (!read || !values.has(String(name.value))) {
      out.push(token);
      i++;
      continue;
    }
    const end = closing(tokens, i + 1);
    if (end === -1) {
      out.push(token); // a var() never closed: the value reports it
      i++;
      continue;
    }
    const key = String(name.value);
    const argument = values.get(key);
    const fallback = isPunct(tokens[i + 3], ",") ? tokens.slice(i + 4, end) : [];
    const parameter = mixin.parameters.find((p) => p.name.value === key)!;
    if (argument) out.push(...argument);
    else if (parameter.value) {
      if (chain.includes(key))
        throw errorAt(parameter.value, `${key} uses itself: ${[...chain, key].join(" → ")}`);
      out.push(...substitute(parameter.value, mixin, values, apply, [...chain, key]));
    } else if (fallback.length > 0) out.push(...substitute(fallback, mixin, values, apply, chain));
    else
      throw errorAt(
        [apply.at, apply.name],
        `@apply ${mixin.name.value} gives no value to ${key}, which has no default: write @apply ${mixin.name.value}(<value>), or @mixin ${mixin.name.value}(${key}: <value>)`,
      );
    i = end + 1;
  }
  return out;
}

// @contents; and @contents { fallback }, replaced by the block of the @apply, or by the
// fallback when the @apply has no block. The block is not read again: a @contents in it
// belongs to the mixin around.
function replaceContents(tokens: Token[], contents: Token[] | undefined): Token[] {
  if (!tokens.some((token) => isAt(token, "contents"))) return tokens;
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isAt(tokens[i], "contents")) {
      out.push(tokens[i++]);
      continue;
    }
    let fallback: Token[] = [];
    let end = i + 1;
    if (isPunct(tokens[end], "{")) {
      const close = closing(tokens, end);
      if (close === -1) throw errorAt(tokens[end], 'The block of @contents is never closed: "}" missing');
      fallback = tokens.slice(end + 1, close);
      end = close + 1;
    }
    if (isPunct(tokens[end], ";")) end++;
    out.push(...closed(contents ?? fallback));
    i = end;
  }
  return out;
}
