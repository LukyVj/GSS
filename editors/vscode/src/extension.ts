import * as vscode from "vscode";
// The same formatter as the docs and `npm run format`: esbuild copies it into the extension
import { formatGss } from "../../../src/docs/format";

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

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("gss", provider),
  );
}

export function deactivate(): void {}
