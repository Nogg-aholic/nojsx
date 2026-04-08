# nojsx Build Pipeline

This document explains the build pipeline that still exists in nojsx after the removal of the old component-generation system.

nojsx is now a small client-side runtime package. The repository no longer maintains the old generated component catalog, namespace generation flow, or consumer page-loader tooling.

## 1. Current scope

The package now builds three things:

- the runtime JavaScript in `dist/`,
- the runtime type declarations in `dist/`,
- the Tailwind helper CLI exposed as `nojsx-build-css`.

It does not currently build:

- a generated component namespace,
- a bundled component library,
- generated route metadata,
- generated page loaders.

## 2. Current scripts

The `scripts/` directory now contains only the scripts still required by the package:

- `clean-dist.ts`: clears `dist/` before each build.
- `build-tailwind.ts`: thin wrapper around the Tailwind CLI.
- `assert-dist-relative-import-extensions.ts`: asserts emitted `dist` JS has explicit extensions on relative imports.
- `pack-tgz.ts`: runs package packing flow and writes a stable `nojsx.tgz` at repo root.

The TSX live preview runtime now lives under `src/live-preview/` as TypeScript and is compiled with the rest of the runtime into `dist/live-preview/`.

## 3. What `build` does

`bun run build` currently runs:

1. Clear prior `dist/` output.
2. TypeScript compile for the library.
3. TypeScript compile for the remaining scripts.
4. Assert emitted relative imports in `dist` use explicit extensions.

This is now the full package build. There is no `regen` phase anymore.

`bun run compile` is just an alias to `bun run build`.

## 3.1 Local package validation flow

The repository validates packaging via the minimal example.

- `bun run pack:tgz`: runs build and writes `nojsx.tgz`.
- `bun run example:minimal`: installs and builds `examples/nojsx-minimal`.
- `bun run test:tgz:minimal`: runs full pack + install + build validation.

`examples/nojsx-minimal` should consume `nojsx` via `file:../../nojsx.tgz`.
Using `file:../..` causes recursive local folder installs and should be avoided.

## 4. What `build-tailwind.ts` does

`build-tailwind.ts` is a convenience wrapper around the installed Tailwind CLI.

It:

1. reads `--input` and `--output`,
2. optionally injects extra `@source` entries into a temporary CSS file,
3. runs Tailwind,
4. optionally minifies the output.

This makes it useful for consuming apps that want to reuse the package stylesheet and point Tailwind at app-owned source files.

## 5. What consumers still build themselves

Consumers still need to build their own app-level concerns:

- app JavaScript or TypeScript bundles,
- app routing,
- app page loading,
- any app-specific component library,
- final CSS output for their app.

If a consumer wants CSS output, they can either call `nojsx-build-css` or use Tailwind directly.

## 6. Operational summary

Today the package should be understood as:

- a JSX runtime,
- a small package build pipeline,
- a Tailwind helper CLI.

Any larger app architecture beyond that now belongs in the consuming project, not in this repository.
