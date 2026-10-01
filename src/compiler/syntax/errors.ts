// Errors that know where they are in the GSS text, so an editor can underline them.

export type Span = { start: number; end: number };

// Where each token (or declaration) came from in the source. Filled by scan() and
// the parser. A WeakMap keeps the AST as it is: no field is added to the tokens.
const spans = new WeakMap<object, Span>();

export function rememberSpan(thing: object, span: Span): void {
  spans.set(thing, span);
}

export function spanOf(thing: object | undefined): Span | undefined {
  return thing ? spans.get(thing) : undefined;
}

export class GssError extends Error {
  start?: number;
  end?: number;
  constructor(message: string, span?: Span) {
    super(message);
    this.name = "GssError";
    this.start = span?.start;
    this.end = span?.end;
  }
}

// From the first to the last thing that has a span
export function spanAcross(at: object | object[] | undefined): Span | undefined {
  const list = at === undefined ? [] : Array.isArray(at) ? at : [at];
  const found = list.map((thing) => spanOf(thing)).filter((span) => span !== undefined);
  if (found.length === 0) return undefined;
  return { start: found[0].start, end: found[found.length - 1].end };
}

// An error about some tokens (or declarations): it covers the first to the last one
export function errorAt(at: object | object[] | undefined, message: string): GssError {
  return new GssError(message, spanAcross(at));
}

// Runs a reader; if it throws without a position, the error gets the position of `at`
export function locate<T>(at: object | object[] | undefined, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof GssError && error.start !== undefined) throw error;
    if (error instanceof Error) throw errorAt(at, error.message);
    throw error;
  }
}
