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
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { setDiagnostics, lintGutter, type Diagnostic } from "@codemirror/lint";
import type { Renderer } from "./renderer";
import { classifyGss } from "../docs/highlight";
import { formatGss } from "../docs/format";
import { scan } from "../compiler/tokenizer";
import { GssError } from "../compiler/errors";
import type { Stats } from "./status";

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

// ----- A located error, shown under its line (DESIGN.md § 6) -----

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

// null removes the error line
const setErrorLine = StateEffect.define<{ at: number; text: string } | null>();

// Block widgets must come from a StateField (they change the height of the document)
const errorLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(lines, transaction) {
    lines = lines.map(transaction.changes); // it follows the text while typing
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLine)) continue;
      lines = effect.value
        ? Decoration.set([
            Decoration.widget({
              widget: new ErrorLine(effect.value.text),
              block: true,
              side: 1,
            }).range(effect.value.at),
          ])
        : Decoration.none;
    }
    return lines;
  },
  provide: (field) => EditorView.decorations.from(field),
});

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
    const message = caught instanceof Error ? caught.message : String(caught);
    if (status) {
      status.textContent = "Error";
      status.className = "status error";
    }
    emitStats({ errors: 1, objects: 0, glslLines: 0, compileMs: 0 });

    // A compile error that knows its place: underline it, and write it under its line
    if (caught instanceof GssError && caught.start !== undefined) {
      const length = view.state.doc.length;
      const from = Math.min(caught.start, length);
      const to = Math.min(Math.max(caught.end ?? from, from + 1), length);
      const line = view.state.doc.lineAt(from);
      const diagnostics: Diagnostic[] = [
        { from, to, severity: "error", message },
      ];
      error.hidden = true;
      view.dispatch(setDiagnostics(view.state, diagnostics), {
        effects: setErrorLine.of({
          at: line.to,
          text: `${line.number}:${from - line.from + 1}  ${message}`,
        }),
      });
    } else {
      // No place (a GLSL error, for instance): the message goes under the editor
      error.textContent = message;
      error.hidden = false;
      view.dispatch(setDiagnostics(view.state, []), {
        effects: setErrorLine.of(null),
      });
    }
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
      effects: setErrorLine.of(null),
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
