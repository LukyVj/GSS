import * as vscode from "vscode";
// The same formatter as the docs and `npm run format`: esbuild copies it into the extension
import { formatGss } from "../../../src/docs/format";
import { suggestAt } from "./suggest";

// "Format Document" (and format on save) on a .gss file calls formatGss
export function activate(context: vscode.ExtensionContext): void {
  const provider: vscode.DocumentFormattingEditProvider = {
    provideDocumentFormattingEdits(document) {
      const text = document.getText();
      let formatted: string;
      try {
        formatted = formatGss(text);
      } catch (error) {
        // The code cannot be read (a comment never closed, an unknown character):
        // we leave the file as it is and say why in the status bar
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.setStatusBarMessage(`GSS: not formatted, ${message}`, 5000);
        return [];
      }
      if (formatted === text) return [];

      // One edit that replaces the whole file
      const whole = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
      return [vscode.TextEdit.replace(whole, formatted)];
    },
  };

  // The properties the rule can take, and the mixins after @apply, as in the playground
  const completion: vscode.CompletionItemProvider = {
    provideCompletionItems(document, position, _token, context) {
      const language = document.languageId === "gss" ? "gss" : "html";
      const offset = document.offsetAt(position);
      const explicit = context.triggerKind === vscode.CompletionTriggerKind.Invoke;
      const found = suggestAt(document.getText(), offset, language, explicit);
      if (!found) return undefined;
      const range = new vscode.Range(document.positionAt(found.from), position);
      return found.items.map((suggestion) => {
        const kind = suggestion.kind === "mixin" ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Property;
        const item = new vscode.CompletionItem(suggestion.label, kind);
        item.detail = suggestion.detail;
        if (suggestion.documentation) item.documentation = new vscode.MarkdownString(suggestion.documentation);
        item.insertText = suggestion.insertText;
        item.range = range;
        return item;
      });
    },
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("gss", provider),
    // "-" opens the mixins after @apply; letters open the rest on their own
    vscode.languages.registerCompletionItemProvider(["gss", "html"], completion, "-"),
  );
}

export function deactivate(): void {}
