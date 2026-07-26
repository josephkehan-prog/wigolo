# Contributing to wigolo

Thanks for your interest in improving wigolo. This document covers how to get set
up, how to propose changes, and the contribution terms.

## Development setup

Requires Node.js 20, 22, or 24 (see `.nvmrc` for the exact version this repo is
tested against; `nvm use` / `mise` will pick it up automatically — mise's
`idiomatic_version_file_enable_tools` config already honors `.nvmrc` with no
project-local mise config needed).

```bash
npm install
npm run build        # tsc -> dist/
npm test             # full vitest suite
npm run test:unit    # unit tests only
npm run lint         # tsc --noEmit
```

`npm run dev` runs the CLI from source via `tsx`.

### Two install-time traps worth knowing about

- **Node ≥ 26 breaks `better-sqlite3` with a `NODE_MODULE_VERSION` mismatch,
  not a real test failure.** The pinned `better-sqlite3` release only ships
  prebuilt binaries through Node 24's ABI. Running the suite under a newer
  ambient Node (e.g. a `mise`/`nvm` default of 26) silently falls back to a
  stale native build and turns into a wall of *unrelated-looking* test
  failures — every one of them a `better-sqlite3` load error, not an actual
  regression. Use the pinned version in `.nvmrc` (`engines.node` in
  `package.json` also documents the ceiling: `>=20 <26`).
- **A system-wide (Homebrew) `vips` install breaks `sharp` for anyone on
  macOS.** `sharp` (pulled in transitively via `@huggingface/transformers`)
  detects a global `libvips` via `pkg-config` and prefers building against it
  over using its own prebuilt binary — but that from-source build needs
  `node-addon-api`, which isn't a direct dependency here, so `npm ci` fails
  with `sharp: Please add node-addon-api to your dependencies`. If you have
  `vips` installed via Homebrew, set `SHARP_IGNORE_GLOBAL_LIBVIPS=1` before
  installing:
  ```bash
  SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci
  ```
  This isn't Node-version-specific — it reproduces on any supported Node once
  `brew install vips` is present on the machine.

## Proposing changes

1. Open an issue first for anything non-trivial so we can agree on the approach.
2. Branch from `main`, keep changes focused, and add tests for new behavior.
3. Use [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`).
4. Make sure `npm test` and `npm run lint` pass before opening a PR.
5. Open a pull request describing the change and why it matters.

## Guidelines

- Prefer the smallest change that fully solves the problem.
- Match the surrounding code style. Minimal comments — only where the "why" is
  non-obvious.
- All logging goes to stderr (stdout is reserved for the MCP stdio protocol).
- Don't add dependencies without a clear need; note new deps in the PR.

## Contributor License Agreement (CLA)

By submitting a contribution (a pull request, patch, or any other work) to this
project, you agree to the following:

1. **License of your contribution.** You license your contribution to the project
   and to everyone downstream under the same license as the project
   (GNU AGPL-3.0-only).

2. **Grant to the maintainer.** You additionally grant the project maintainer a
   perpetual, worldwide, non-exclusive, royalty-free, irrevocable copyright and
   patent license to reproduce, modify, distribute, sublicense, and **relicense**
   your contribution, including under different license terms (for example, a
   commercial license). This lets the project offer commercial licensing
   alongside the open-source AGPL release.

3. **You have the right to grant this.** You certify that the contribution is your
   original work (or that you have the right to submit it) and that, to your
   knowledge, it does not infringe anyone else's rights.

4. **No warranty.** Your contribution is provided "as is", without warranty of
   any kind.

If you are contributing on behalf of an employer, you confirm you have permission
to do so. If you cannot agree to these terms, please open an issue to discuss
before contributing.
