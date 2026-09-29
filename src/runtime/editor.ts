import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  ViewPlugin,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
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

// Where the editor goes, the OK / Error badge, and the error message
export type EditorElements = {
  host: HTMLElement;
  status: HTMLElement;
  error: HTMLElement;
};

// What the page can do with an editor once it is created
export type Editor = {
  getCode(): string;
  setCode(code: string): void; // replaces everything (undoable with Cmd/Ctrl+Z)
  onCompile(listener: (code: string) => void): void; // after each successful compile
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

// ----- The editor -----

const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "transparent",
      color: "var(--gss-text)",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.6" },
    ".cm-content": { caretColor: "var(--gss-content)", padding: "0.75rem 0" },
    ".cm-cursor": {
      borderLeftColor: "var(--gss-signal)",
      borderLeftWidth: "2px",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--gss-gutter)",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "var(--gss-raised)" },
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
    status.textContent = "Error";
    status.className = "status error";
    error.hidden = false;

    // A compile error that knows its place: underline it, and say which line
    const diagnostics: Diagnostic[] = [];
    if (caught instanceof GssError && caught.start !== undefined) {
      const length = view.state.doc.length;
      const from = Math.min(caught.start, length);
      const to = Math.min(Math.max(caught.end ?? from, from + 1), length);
      const line = view.state.doc.lineAt(from);
      error.textContent = `Line ${line.number}, column ${from - line.from + 1}: ${message}`;
      diagnostics.push({ from, to, severity: "error", message });
    } else {
      error.textContent = message;
    }
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }

  function tryLoad(): void {
    const code = view.state.doc.toString();
    try {
      renderer.load(code);
    } catch (caught) {
      showError(caught);
      return;
    }
    status.textContent = "OK";
    status.className = "status ok";
    error.hidden = true;
    view.dispatch(setDiagnostics(view.state, []));
    lastCompiled = code;
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
    destroy() {
      clearTimeout(typingTimer);
      view.destroy();
    },
  };
}
