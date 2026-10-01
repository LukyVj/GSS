# Contributing to GSS

## Develop

```sh
npm install
npm run dev        # the site: home, playground, docs, brand, showcase
npm test           # Vitest
npm run build      # type-check, then build the site to dist/ and embed.js
npm run build:lib  # the npm package, to lib/
npm run format     # format the .gss files (npm run format:check to only list them)
```

| Path | What lives there |
| --- | --- |
| `src/compiler/` | `index.ts` (`compileScene()`, the pipeline), then one folder per stage: `syntax/` (tokenizer, parser), `cascade/` (selectors, validation, variables), `values/` (math, colors, easings, SVG paths), `features/` (animation, transition, camera, textures…), `shader/` (GLSL codegen, Shadertoy export), `registry/`, and `tests/` for the end-to-end tests |
| `src/scenes/` | the `.gss` scenes of the playground, the showcase and the bench |
| `src/runtime/` | WebGL2 renderer, camera, :hover picking, editor, share links |
| `src/embed/`, `src/vite/` | the npm package: `mount()`, `<gss-scene>`, the Vite plugin |
| `src/docs/` | the generated reference and the syntax highlighter |
| `src/playground/`, `src/home/`, `src/showcase/` | the playground, the home page, the showcase |
| `src/profiler/`, `src/bench/` | dev only: the performance panel (Alt+P in the playground) and the bench |
| `editors/vscode/` | the VS Code / Cursor extension |
| `DESIGN.md` | the visual identity ("Distance field") |

Every property, shape, selector and function is described once in the registry
(`src/compiler/registry/registry.ts`): the reference and the tests of its examples are generated from it.

## Decisions

The design decisions, and why they were made, are recorded in [`DECISIONS.md`](DECISIONS.md).
What comes next is in [`ROADMAP.md`](ROADMAP.md).

## Performance

`npm run bench:compare -- main --dpr 2` compares another commit with the working tree: the
timings, and the rendering pixel by pixel. A change that makes a scene slower, or changes one
pixel, is a regression.

## Publishing

`npm publish` rebuilds `lib/` and runs the tests first (`prepublishOnly`).
