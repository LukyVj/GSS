# Contributing to GSS

## Develop

```sh
npm install
npm run dev        # the site: home, playground, docs, brand, showcase
npm test           # Vitest
npm run build      # type-check, then build the site to dist/ and embed.js
npm run build:lib  # the npm package and standalone CDN module, to lib/
npm run format     # format the .gss files (npm run format:check to only list them)
```

| Path | What lives there |
| --- | --- |
| `src/compiler/` | `index.ts` (`compileScene()`, the pipeline), then one folder per stage: `syntax/` (tokenizer, parser), `cascade/` (selectors, validation, variables), `values/` (math, colors, easings, SVG paths), `features/` (animation, transition, camera, textures…), `shader/` (`codegen/`: the code generator, one file per part of the shader; `wgsl/`: the same shader lowered to WGSL; gradients, paths, the Shadertoy export), `registry/`, and `tests/` for the end-to-end tests |
| `src/scenes/` | the `.gss` scenes of the playground, the showcase and the bench |
| `src/runtime/` | WebGL2 and WebGPU renderers (`backend.ts` picks one), camera, :hover picking, editor and autocompletion, share links |
| `src/embed/`, `src/vite/` | the npm package: `mount()`, `<gss-scene>`, the Vite plugin |
| `src/docs/` | the generated reference and the syntax highlighter |
| `src/playground/`, `src/home/`, `src/showcase/` | the playground, the home page, the showcase |
| `src/profiler/`, `src/bench/` | the performance panel of the playground (`perf` or Alt+P, closed by default) and the bench (dev only) |
| `editors/vscode/` | the VS Code / Cursor extension |
| `DESIGN.md` | the visual identity ("Distance field") |

Every property, shape, selector and function is described once in the registry
(`src/compiler/registry/registry.ts`): the reference and the tests of its examples are generated from it.

## Decisions

The design decisions, and why they were made, are recorded in [`DECISIONS.md`](DECISIONS.md).
What comes next is in [`ROADMAP.md`](ROADMAP.md).

## Performance

`npm run bench:compare -- main --dpr 2` compares another commit with the working tree: the
timings, and the rendering pixel by pixel. The report distinguishes measured regressions from noise; isolated pixels and edge flips are accepted only within the 0.05% image budget (decision 74).

## Documentation navigation

`src/docs/navigation.ts` groups every registry entry by its stable anchor. Add its anchor to
`DOC_GROUPS` when adding a feature. Groups use `category` and numeric `order`; smaller values
come first. Entries sort alphabetically unless `ENTRY_ORDER[anchor]` (or an entry's `order`)
sets a numeric priority. Do not reorder compiler registries to change the sidebar.
Navigation, page order and previous/next links share the same grouped entries. Tests check
that no registered entry is missing or assigned twice. Installation guides live in
`src/docs/guide.ts` and share versioned snippets with the showcase.

## Publishing

1. Update `package.json` and the root package version in `package-lock.json` together. The site and installation snippets read that version through `src/version.ts`.
2. Update the changelog, README, roadmap and decisions. Keep a prepared release marked as such until it is published.
3. Run the complete tests (including WebGL), `npm run build`, `npm run build:lib`, and `npm pack --dry-run`. Check that `lib/embed.js` is in the package and standalone.
4. Publish the npm package, then tag the release and deploy the site. Publish before deploying versioned CDN instructions: jsDelivr can only serve a version after npm has it.

`npm publish` rebuilds `lib/` (including the standalone `gss-lang/embed` browser entry) and runs
the non-GPU tests first (`prepublishOnly`). The unversioned site `/embed.js` remains available;
the installation guide recommends the versioned jsDelivr URL for reproducibility.
