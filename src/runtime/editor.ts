import {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  ViewPlugin,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  indentService,
} from "@codemirror/language";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { setDiagnostics, lintGutter, type Diagnostic } from "@codemirror/lint";
import type { Renderer } from "./renderer";
import { classifyGss } from "../docs/highlight";
import { formatGss } from "../docs/format";
import { scan } from "../compiler/syntax/tokenizer";
import { GssError, GssErrors } from "../compiler/syntax/errors";
import type { Stats } from "./status";
import { propertySuggestions } from "./completion";

// Where the editor goes, the OK / Error badge (optional: the playground has a
// status bar instead, fed by onStats), and the message of an error with no place
export type EditorElements = {
  host: HTMLElement;
  status?: HTMLElement;
  error: HTMLElement;
};

// What the page can do with an editor once it is created
export type Editor = {
  getCode(): string;
  setCode(code: string): void; // replaces everything (undoable with Cmd/Ctrl+Z)
  onCompile(listener: (code: string) => void): void; // after each successful compile
  onStats(listener: (stats: Stats) => void): void; // after each compile, successful or not
  destroy(): void;
};

// ----- Colors: our own classifier, turned into CodeMirror decorations -----

const marks = new Map<string, Decoration>();
function markFor(kind: string): Decoration {
  if (!marks.has(kind))
    marks.set(kind, Decoration.mark({ class: `gss-${kind}` }));
  return marks.get(kind)!;
}

function colorize(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { start, end, kind } of classifyGss(view.state.doc.toString())) {
    if (end > start) builder.add(start, end, markFor(kind));
  }
  return builder.finish();
}

// The same classifier as the docs: the colors are identical everywhere
const gssColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = colorize(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = colorize(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

// ----- Indentation: two spaces per open block -----

// How many blocks are open at a position ("{" not yet closed), comments aside
function depthAt(code: string, position: number): number {
  let depth = 0;
  for (const { token } of scan(code.slice(0, position), { recover: true })) {
    if (token.type !== "PUNCT") continue;
    if (token.value === "{") depth++;
    if (token.value === "}") depth = Math.max(0, depth - 1);
  }
  return depth;
}

const gssIndent = indentService.of((context, position) => {
  const line = context.lineAt(position);
  const closing = /^\s*\}/.test(line.text.slice(position - line.from)); // a line that starts with "}"
  const depth = depthAt(context.state.doc.toString(), position);
  return Math.max(0, depth - (closing ? 1 : 0)) * context.unit;
});

// Typing "}" at the start of a line re-indents it
const reindentOnBrace = EditorState.languageData.of(() => [
  { indentOnInput: /^\s*\}$/ },
]);

// ----- Located errors, each one shown under its line (DESIGN.md § 6, decision 86) -----

// "15:3  radius only applies to …", as a block between two lines of code
class ErrorLine extends WidgetType {
  readonly text: string;
  constructor(text: string) {
    super();
    this.text = text;
  }
  eq(other: ErrorLine): boolean {
    return other.text === this.text;
  }
  toDOM(): HTMLElement {
    const line = document.createElement("div");
    line.className = "gss-error-line";
    line.setAttribute("role", "alert");
    line.textContent = this.text;
    return line;
  }
}

// The error lines of the last compile: [] removes them all
const setErrorLines = StateEffect.define<{ at: number; text: string }[]>();

// Block widgets must come from a StateField (they change the height of the document)
const errorLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(lines, transaction) {
    lines = lines.map(transaction.changes); // it follows the text while typing
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLines)) continue;
      // Two errors on one line: one block, one error per row
      const byLine = new Map<number, string[]>();
      for (const { at, text } of effect.value)
        byLine.set(at, [...(byLine.get(at) ?? []), text]);
      lines = Decoration.set(
        [...byLine].map(([at, texts]) =>
          Decoration.widget({
            widget: new ErrorLine(texts.join("\n")),
            block: true,
            side: 1,
          }).range(at),
        ),
        true, // sorted by position
      );
    }
    return lines;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// ----- Autocompletion of property names, from the registry (decision 89) -----

function gssCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\w-]*/);
  // Nothing typed: only when asked (Ctrl+Space), not after every { or ;
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const found = propertySuggestions(context.state.doc.toString(), context.pos);
  if (!found) return null;
  return {
    from: found.from,
    options: found.properties.map(
      (property): Completion => ({
        label: property.name,
        type: "property",
        detail: property.syntax,
        info: property.description,
        // "color: ", ready for the value; just the name when a ":" already follows
        apply: (view, _completion, from, to) => {
          const colon = view.state.sliceDoc(to, to + 1) === ":";
          const text = colon ? property.name : `${property.name}: `;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
        },
      }),
    ),
    validFor: /^[\w-]*$/,
  };
}

const gssAutocomplete = autocompletion({ override: [gssCompletions], icons: false });

// ----- The editor -----

// Shared with the GLSL tab (src/runtime/glsl.ts)
export const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "transparent",
      color: "var(--gss-text)",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.6" },
    ".cm-content": { caretColor: "var(--gss-signal)", padding: "0.75rem 0" },
    ".cm-cursor": {
      borderLeftColor: "var(--gss-signal)",
      borderLeftWidth: "2px",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--gss-gutter)",
      border: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--gss-raised) 60%, transparent)",
      boxShadow: "inset 2px 0 0 var(--gss-isoline)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--gss-ash)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor:
        "color-mix(in srgb, var(--gss-signal) 22%, transparent) !important",
    },
    ".cm-matchingBracket": {
      backgroundColor: "var(--gss-isoline)",
      outline: "none",
    },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "underline wavy var(--gss-signal)",
    },
    ".gss-error-line": {
      margin: "2px 0",
      padding: "6px 10px",
      borderLeft: "2px solid var(--gss-signal)",
      backgroundColor: "var(--gss-signal-wash)",
      color: "var(--gss-error-text)",
      fontSize: "12px",
      whiteSpace: "pre-wrap",
      // Its text must not widen the editor: with no size of its own, the block takes
      // the width of the code and the message wraps inside it, instead of running past
      // the edge (CodeMirror does not wrap lines, so .cm-content grows to its widest child)
      contain: "inline-size",
      overflowWrap: "anywhere",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "inherit", maxHeight: "16em" },
    ".cm-tooltip-autocomplete ul li": { padding: "2px 10px" },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--gss-isoline)",
      color: "var(--gss-bone)",
    },
    ".cm-completionMatchedText": { textDecoration: "none", color: "var(--gss-signal)" },
    ".cm-completionDetail": { color: "var(--gss-ash)", fontStyle: "normal", marginLeft: "1.5em" },
    ".cm-tooltip.cm-completionInfo": {
      maxWidth: "340px",
      padding: "8px 10px",
      fontSize: "12px",
      lineHeight: "1.5",
      whiteSpace: "normal",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--gss-raised)",
      border: "1px solid var(--gss-isoline)",
      color: "var(--gss-bone)",
    },
  },
  { dark: true },
);

// Shows the code in a CodeMirror editor, and recompiles the scene after each change
export function connectEditor(
  { host, status, error }: EditorElements,
  renderer: Renderer,
  source: string,
): Editor {
  const compileListeners: ((code: string) => void)[] = [];
  const statsListeners: ((stats: Stats) => void)[] = [];
  let lastStats: Stats | null = null;
  function emitStats(stats: Stats): void {
    lastStats = stats;
    for (const listener of statsListeners) listener(stats);
  }
  let lastCompiled: string | null = null; // the last code that compiled
  let typingTimer: number | undefined;

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        gssIndent,
        reindentOnBrace,
        gssColors,
        gssAutocomplete,
        errorLine,
        lintGutter(),
        EditorState.tabSize.of(2),
        keymap.of([
          // Shift+Alt+F formats the code, like in VS Code
          {
            key: "Shift-Alt-f",
            run: (v) => (setCode(formatGss(v.state.doc.toString())), true),
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        theme,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          // We wait for a short pause in the typing before recompiling
          clearTimeout(typingTimer);
          typingTimer = window.setTimeout(() => tryLoad(), 250);
        }),
      ],
    }),
  });
  host.classList.add("gss-dark"); // the dark palette of src/styles/gss-code.css

  function showError(caught: unknown): void {
    // Every error of the compile (decision 86); a GLSL error, for instance, is just one
    const all: Error[] =
      caught instanceof GssErrors
        ? caught.errors
        : [caught instanceof Error ? caught : new Error(String(caught))];
    if (status) {
      status.textContent = all.length > 1 ? `${all.length} errors` : "Error";
      status.className = "status error";
    }
    emitStats({ errors: all.length, objects: 0, glslLines: 0, compileMs: 0 });

    // A compile error that knows its place: underline it, and write it under its line
    const length = view.state.doc.length;
    const diagnostics: Diagnostic[] = [];
    const lines: { at: number; text: string }[] = [];
    const unplaced: string[] = [];
    for (const one of all) {
      if (!(one instanceof GssError) || one.start === undefined) {
        unplaced.push(one.message);
        continue;
      }
      const from = Math.min(one.start, length);
      const to = Math.min(Math.max(one.end ?? from, from + 1), length);
      const line = view.state.doc.lineAt(from);
      diagnostics.push({ from, to, severity: "error", message: one.message });
      lines.push({ at: line.to, text: `${line.number}:${from - line.from + 1}  ${one.message}` });
    }
    // No place (a GLSL error, for instance): the message goes under the editor
    error.textContent = unplaced.join("\n");
    error.hidden = unplaced.length === 0;
    view.dispatch(setDiagnostics(view.state, diagnostics), {
      effects: setErrorLines.of(lines),
    });
  }

  function tryLoad(): void {
    const code = view.state.doc.toString();
    const start = performance.now();
    let compiled;
    try {
      compiled = renderer.load(code);
    } catch (caught) {
      showError(caught);
      return;
    }
    const compileMs = performance.now() - start;
    if (status) {
      status.textContent = "OK";
      status.className = "status ok";
    }
    error.hidden = true;
    view.dispatch(setDiagnostics(view.state, []), {
      effects: setErrorLines.of([]),
    });
    lastCompiled = code;
    emitStats({
      errors: 0,
      objects: compiled.objects,
      glslLines: compiled.shader.split("\n").length,
      compileMs,
    });
    for (const listener of compileListeners) listener(code);
  }

  function setCode(code: string): void {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: code },
    });
  }

  tryLoad();

  return {
    getCode: () => view.state.doc.toString(),
    setCode,
    onCompile(listener) {
      compileListeners.push(listener);
      if (lastCompiled !== null) listener(lastCompiled); // the first compile already happened
    },
    onStats(listener) {
      statsListeners.push(listener);
      if (lastStats !== null) listener(lastStats);
    },
    destroy() {
      clearTimeout(typingTimer);
      view.destroy();
    },
  };
}
