// A token = a "word" of the language, with its type.
// The "|" means "or": a Token is one of these five forms.
export type Token =
  | { type: "IDENT"; value: string } // torus, radius, --gap
  | { type: "HASH"; value: string } // #hero, #ff5a36
  | { type: "AT_KEYWORD"; value: string } // @scene, @keyframes
  | { type: "NUMBER"; value: number } // 1, 0.28, -2.5
  | { type: "PUNCT"; value: string } // { } : ; , ( ) . * + - /
  | { type: "DIMENSION"; value: number; unit: string } // 70deg, 24s
  | { type: "PERCENTAGE"; value: number }; // 50%, 12.5%

const PUNCTUATION = "{}:;,().*+-/";

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentChar(char: string): boolean {
  return /^[a-zA-Z0-9_-]$/.test(char);
}

// A name starts with a letter, or by "-" followed by a letter or another "-" (--gap)
function isIdentStart(char: string, next: string): boolean {
  if (/^[a-zA-Z_]$/.test(char)) return true;
  return char === "-" && /^[a-zA-Z_-]$/.test(next);
}

export type Comment = { type: "COMMENT"; value: string }; // "/* hi */", with the /* */
export type Located = { token: Token | Comment; start: number; end: number };

// Reads the whole text, comments included, and remembers where each token is.
// The formatter and the highlighter need this; the parser only needs tokenize().
export function scan(source: string): Located[] {
  const located: Located[] = [];
  let i = 0; // our position in the text
  let start = 0; // where the token being read begins

  // Records a token that runs from `start` to the current position
  const push = (token: Token | Comment) => located.push({ token, start, end: i });

  // Returns the character at a position, or "" if we exceed the end
  const charAt = (index: number): string => source[index] ?? "";

  // Advance while reading name characters, and return the name read
  const readIdent = (): string => {
    const from = i;
    while (isIdentChar(charAt(i))) i++;
    return source.slice(from, i);
  };

  while (i < source.length) {
    start = i;
    const char = charAt(i);
    const next = charAt(i + 1);

    // 1. The spaces: we skip them
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // 2. The comments /* ... */ : kept, with their text (the parser never sees them)
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) throw new Error(`Comment never closed (position ${i})`);
      i = end + 2;
      push({ type: "COMMENT", value: source.slice(start, i) });
      continue;
    }

    // 3. The numbers: 1, 0.28, -2.5
    if (isDigit(char) || ((char === "-" || char === ".") && isDigit(next))) {
      i++;
      while (isDigit(charAt(i)) || charAt(i) === ".") i++;
      const value = parseFloat(source.slice(start, i)); // the number: 70

      // Is a "%" stuck just after the number?
      if (charAt(i) === "%") {
        i++;
        push({ type: "PERCENTAGE", value });
        continue;
      }

      // Is a letter stuck just after the number?
      if (isIdentStart(charAt(i), charAt(i + 1))) {
        const unit = readIdent(); // read "deg" and advance i
        push({ type: "DIMENSION", value, unit });
      } else {
        push({ type: "NUMBER", value });
      }
      continue;
    }

    // 4. @scene and #hero: a symbol followed by a name
    if (char === "@" || char === "#") {
      i++;
      const name = readIdent();
      if (name === "")
        throw new Error(`"${char}" must be followed by a name (position ${i})`);
      push({ type: char === "@" ? "AT_KEYWORD" : "HASH", value: name });
      continue;
    }

    // 5. The names: torus, radius, nth-child, --gap
    if (isIdentStart(char, next)) {
      push({ type: "IDENT", value: readIdent() });
      continue;
    }

    // 6. The punctuation
    if (PUNCTUATION.includes(char)) {
      i++;
      push({ type: "PUNCT", value: char });
      continue;
    }

    // 7. Nothing matches: clear error, with the position
    throw new Error(`Unexpected character "${char}" (position ${i})`);
  }

  return located;
}

// The tokens the parser needs: everything except comments
export function tokenize(source: string): Token[] {
  return scan(source)
    .map((l) => l.token)
    .filter((t): t is Token => t.type !== "COMMENT");
}
