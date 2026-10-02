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

// ----- Several errors at once (decision 86) -----
// A compile does not stop at the first error: it goes on where it can, and reports
// them all. Its start and end are those of the first one, so code that reads only
// one error keeps working.
export class GssErrors extends GssError {
  errors: GssError[];
  constructor(errors: GssError[]) {
    const [first] = errors;
    super(
      errors.map((error) => error.message).join("\n"),
      first.start === undefined ? undefined : { start: first.start, end: first.end ?? first.start },
    );
    this.name = "GssErrors";
    this.errors = errors;
  }
}

// The errors behind something thrown: every error of a GssErrors, the error itself,
// or none when it is not a GSS error. A plain Error (from a reader that does not
// know where it is) becomes an error without a place; anything else is a bug and is
// thrown again.
export function errorsOf(caught: unknown): GssError[] {
  if (caught instanceof GssErrors) return caught.errors;
  if (caught instanceof GssError) return [caught];
  if (caught instanceof Error && caught.constructor === Error) return [new GssError(caught.message)];
  throw caught;
}

// Where the errors of one compile are gathered
export class ErrorSink {
  readonly list: GssError[] = [];

  add(error: GssError): void {
    this.list.push(error);
  }

  get size(): number {
    return this.list.length;
  }

  // Runs one part of the compile; when it fails, its errors are kept and the
  // result is undefined: the caller goes on without it
  run<T>(part: () => T): T | undefined {
    try {
      return part();
    } catch (caught) {
      this.list.push(...errorsOf(caught));
      return undefined;
    }
  }

  // Nothing when no error was found; one error as it is; several as a GssErrors,
  // in the order of the text, each one once
  throwIfAny(): void {
    if (this.list.length === 0) return;
    const seen = new Set<string>();
    const unique = this.list.filter((error) => {
      const key = `${error.start}:${error.end}:${error.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // In the order of the text; the errors without a place come last
    const sorted = unique
      .map((error, n) => ({ error, n }))
      .sort((a, b) => (a.error.start ?? Infinity) - (b.error.start ?? Infinity) || a.n - b.n)
      .map(({ error }) => error);
    throw sorted.length === 1 ? sorted[0] : new GssErrors(sorted);
  }
}

// "3:5  message", one line per error, for a terminal (the Vite plugin)
export function describeErrors(source: string, caught: unknown): string {
  const list: unknown[] = caught instanceof GssErrors ? caught.errors : [caught];
  return list
    .map((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!(error instanceof GssError) || error.start === undefined) return message;
      const before = source.slice(0, error.start);
      const line = before.split("\n").length;
      const column = error.start - before.lastIndexOf("\n");
      return `${line}:${column}  ${message}`;
    })
    .join("\n");
}
