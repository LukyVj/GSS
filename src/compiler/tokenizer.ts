// Un token = un "mot" du langage, avec son type.
// Le "|" veut dire "ou" : un Token est l'une de ces cinq formes.
export type Token =
  | { type: "IDENT"; value: string } // torus, radius, --gap
  | { type: "HASH"; value: string } // #hero, #ff5a36
  | { type: "AT_KEYWORD"; value: string } // @scene, @keyframes
  | { type: "NUMBER"; value: number } // 1, 0.28, -2.5
  | { type: "PUNCT"; value: string } // { } : ; , ( ) . * + - /
  | { type: "DIMENSION"; value: number; unit: string }; // 70deg, 24s

const PUNCTUATION = "{}:;,().*+-/";

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentChar(char: string): boolean {
  return /^[a-zA-Z0-9_-]$/.test(char);
}

// Un nom commence par une lettre, ou par "-" suivi d'une lettre ou d'un autre "-" (--gap)
function isIdentStart(char: string, next: string): boolean {
  if (/^[a-zA-Z_]$/.test(char)) return true;
  return char === "-" && /^[a-zA-Z_-]$/.test(next);
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0; // notre position dans le texte

  // Renvoie le caractère à une position, ou "" si on dépasse la fin
  const charAt = (index: number): string => source[index] ?? "";

  // Avance tant qu'on lit des caractères de nom, et renvoie le nom lu
  const readIdent = (): string => {
    const start = i;
    while (isIdentChar(charAt(i))) i++;
    return source.slice(start, i);
  };

  while (i < source.length) {
    const char = charAt(i);
    const next = charAt(i + 1);

    // 1. Les espaces : on les saute
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // 2. Les commentaires /* ... */ : on saute jusqu'à la fin
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1)
        throw new Error(`Commentaire jamais fermé (position ${i})`);
      i = end + 2;
      continue;
    }

    // 3. Les nombres : 1, 0.28, -2.5
    if (isDigit(char) || ((char === "-" || char === ".") && isDigit(next))) {
      const start = i;
      i++;
      while (isDigit(charAt(i)) || charAt(i) === ".") i++;
      const value = parseFloat(source.slice(start, i)); // le nombre : 70

      // Est-ce qu'une lettre est collée juste après le nombre ?
      if (isIdentStart(charAt(i), charAt(i + 1))) {
        const unit = readIdent(); // lit "deg" et avance i
        tokens.push({ type: "DIMENSION", value, unit });
      } else {
        tokens.push({ type: "NUMBER", value });
      }
      continue;
    }

    // 4. @scene et #hero : un symbole suivi d'un nom
    if (char === "@" || char === "#") {
      i++;
      const name = readIdent();
      if (name === "")
        throw new Error(`"${char}" doit être suivi d'un nom (position ${i})`);
      tokens.push({ type: char === "@" ? "AT_KEYWORD" : "HASH", value: name });
      continue;
    }

    // 5. Les noms : torus, radius, nth-child, --gap
    if (isIdentStart(char, next)) {
      tokens.push({ type: "IDENT", value: readIdent() });
      continue;
    }

    // 6. La ponctuation
    if (PUNCTUATION.includes(char)) {
      tokens.push({ type: "PUNCT", value: char });
      i++;
      continue;
    }

    // 7. Rien ne correspond : erreur claire, avec la position
    throw new Error(`Caractère inattendu "${char}" (position ${i})`);
  }

  return tokens;
}
