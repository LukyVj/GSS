# GSS — GPU Style Sheets

Colors and formats `.gss` files in VS Code and Cursor.

- **Highlighting**: selectors, properties, values, colors, numbers and units, `@scene` and `@keyframes`.
- **Formatting**: *Format Document* (or save the file) rewrites the code with the GSS style: one instance per line in `@scene`, one declaration per line, two-space indentation, comments kept. It is the same formatter as `npm run format` and the docs.

Formatting on save is on by default for `.gss` files. To turn it off:

```json
"[gss]": { "editor.formatOnSave": false }
```

## Build

```sh
npm run generate-vscode-extension   # from the project root
```

Then, in VS Code or Cursor: *Extensions: Install from VSIX…* and pick `editors/vscode/gss-language-0.1.0.vsix`.
