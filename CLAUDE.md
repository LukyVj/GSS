# GSS — notes for Claude

GSS (GPU Style Sheets) is Lucas's CSS-like language for 3D scenes, compiled to one raymarching
fragment shader: GLSL (WebGL2) and WGSL (WebGPU, with a WebGL2 fallback). No Three.js. Site:
gss-lang.dev; npm package: `gss-lang`.

## Read first

- `ROADMAP.md`: what GSS already does, and what comes next. The **Essentials** section (Oct. 2) is done;
  Lucas's order for what comes next is at the top of **Priorities** (the panel of variables,
  `@property-panel`, is done: ask him for the next one). 0.0.5 is published (Oct. 4, tag `v0.0.5`); what
  comes next goes under "Unreleased" in `CHANGELOG.md`, on the branch `release/0.0.6`.
- `DECISIONS.md`: every design decision, numbered. The next one is **152**. Add a decision for every
  new feature or behavior change.
- `CONTRIBUTING.md`: where things live. `CHANGELOG.md`: user-facing changes, under "Unreleased".

## How Lucas works with Claude

- Answer in **French**. Code, comments, tests, error messages and every `.md` of the repo are in **English**.
- For now, **Claude does most of the implementation**, and challenges Lucas when it matters: a costly
  choice, a simpler alternative, a consequence he may not have seen (say it once, then follow his
  call). Design decisions are Lucas's: recommend one clear option, explain why, let him choose.
- **Claude commits, Lucas pushes** (Lucas's choice, Oct. 3): commit each verified step yourself, with
  only the files of that step (never his other work in progress), and give him the hash. Never push.
- A change that alters the render of existing scenes is asked to Lucas before it is made.

## Rules for every change

- Tests first (watch them fail for the right reason), then the code. Then: `npx vitest run`
  (GPU tests included: `src/test/gpu.test.ts`, Chromium), `npx tsc --noEmit -p .`, and `npm run build`.
- Every feature goes into the **registry** (`src/compiler/registry/registry.ts`): the docs, the
  playground examples, the autocompletion and the example tests are generated from it.
- Then update `ROADMAP.md`, `DECISIONS.md` and `CHANGELOG.md`.
- A refactor of the code generator must leave every shader identical: compile every scene of
  `src/scenes/` and every registry example before and after, and compare.
- Move code by cutting and pasting, never by retyping it.
- **Public content stays public**: the docs, the site pages, registry descriptions and error
  messages never mention decision numbers, `ROADMAP.md`, `DECISIONS.md`, `DESIGN.md`, repo paths
  or internal vocabulary.
- When a CSS or SVG notion exists, GSS takes its syntax and its behavior; any difference from CSS
  is written in the decision.

## Practical notes

- **New features go to `release/0.0.6`** (Lucas's choice, Oct. 6), not to `main`: `main` holds the
  published 0.0.5. Work and commit on the release branch; only fixes of the published version go
  to `main` (then merge `main` into the release branch). See "Branches" in `CONTRIBUTING.md`.

- **Several Claude sessions may work in this repo at once.** Look at `git status` before starting,
  tell the other sessions which files you will edit (and wait for their go before touching theirs),
  take the next free decision number, and commit only your own files.
- The shell's default `node` can be v16, too old for Vitest (`styleText` import error): use Node 20+
  from nvm (`~/.nvm/versions/node/`).
- To prove shaders identical without touching anyone's uncommitted work, compile every scene and
  registry example in a `git worktree` of `HEAD` (with a link to `node_modules`) and in the working
  tree, then compare. Never `git stash`.
- A GPU test that compares two images must be shown to catch a bug: break the code on purpose,
  watch it fail, restore. A heavy GPU test can time out while other test runs share the machine:
  run its file alone before calling it a failure.
