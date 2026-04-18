# noJSX Build Pipeline

This document explains the current noJSX package build and app-build pipeline.

noJSX ships a browser runtime plus builder/server helpers. The repository no longer maintains the old generated component catalog, but it still supports consumer page-loader generation and app dev builds.

## 1. Current scope

The package now builds:

- the runtime JavaScript in `dist/`,
- the runtime type declarations in `dist/`,
- the Tailwind helper CLI exposed as `nojsx-build-css`,
- the app build/server helper exports under `@nogg-aholic/nojsx/builder` and `@nogg-aholic/nojsx/start-nojsx-server`.

It does not build:

- a generated component namespace,
- a bundled component library,
- a bundled design system catalog.

## 2. Current scripts

The `scripts/` directory now contains only the scripts still required by the package:

- `clean-dist.ts`: clears `dist/` before each build.
- `build-tailwind.ts`: thin wrapper around the Tailwind CLI.
- `assert-dist-relative-import-extensions.ts`: asserts emitted `dist` JS has explicit extensions on relative imports.
- `pack-tgz.ts`: runs package packing flow and writes a stable `nogg-aholic-nojsx.tgz` at repo root.

The TSX live preview runtime now lives under `src/live-preview/` as TypeScript and is compiled with the rest of the runtime into `dist/live-preview/`.

## 3. What package build does

`bun run build` runs:

1. Clear prior `dist/` output.
2. TypeScript compile for the library.
3. TypeScript compile for the remaining scripts.
4. Assert emitted relative imports in `dist` use explicit extensions.

This is the package build. There is no `regen` phase anymore.

`bun run compile` builds and packs `nogg-aholic-nojsx.tgz`.

## 3.1 Local package validation flow

The repository validates packaging via the minimal example.

- `bun run compile`: runs build and writes `nogg-aholic-nojsx.tgz`.
- `examples/nojsx-minimal`: installs from `file:../../nojsx/nogg-aholic-nojsx.tgz` and validates the consumer build.

`examples/nojsx-minimal` should consume `@nogg-aholic/nojsx` via `file:../../nojsx/nogg-aholic-nojsx.tgz`.

## 4. What `build-tailwind.ts` does

`build-tailwind.ts` is a convenience wrapper around the installed Tailwind CLI.

It:

1. reads `--input` and `--output`,
2. optionally injects extra `@source` entries into a temporary CSS file,
3. runs Tailwind,
4. optionally minifies the output.

This makes it useful for consuming apps that want to reuse the package stylesheet and point Tailwind at app-owned source files.

## 5. Consumer app build pieces

Consumers still build app-owned concerns through the builder exports:

- `buildNojsxApp(...)` writes the dev HTML shell, transpiles app source, emits generated loaders, and builds app CSS,
- `startNojsxServer(...)` serves the built app, websocket transport, and optional custom request handlers,
- `buildGeneratedLoadersModule(...)` emits route/component loader metadata for the app.

These helpers are exported through `@nogg-aholic/nojsx/builder` and `@nogg-aholic/nojsx/start-nojsx-server`.

## 6. What consumers still own

Consumers still need to build their own app-level concerns:

- upstream service contracts,
- proxy endpoint configuration,
- app-specific server request passthroughs,
- app pages and components,
- app styling inputs.

If a consumer wants CSS output, they can either call `nojsx-build-css` or use Tailwind directly.

## 7. Operational summary

Today the package should be understood as:

- a JSX runtime,
- an app build/server helper surface,
- a Tailwind helper CLI.

Any larger app architecture beyond that now belongs in the consuming project, not in this repository.
