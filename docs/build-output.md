# noJSX Build Output

noJSX emits runtime and declaration outputs directly from TypeScript sources into `dist/`.

Current rule:

- declarations are emitted by `tsc` from `.ts`/`.tsx` sources,
- package exports and published output resolve from `dist`, not from `src`.

Examples of declaration files that should exist in `dist` after compile:

- `dist/core/bridges/get-shell.d.ts`
- `dist/core/components/components.d.ts`
- `dist/core/global/g.d.ts`
- `dist/core/global/registry.d.ts`
- `dist/core/types/index.d.ts`
- `dist/core/util/client-bootstrap.d.ts`

If compile output is missing one of these files, the fix is not to point consumers back at `src`; the fix is to repair declaration-emitting source types or tsconfig settings.
