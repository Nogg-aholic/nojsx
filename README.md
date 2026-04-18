# noJSX

`noJSX` is a TypeScript-first JSX runtime for client-rendered UI. It is **not React**.

The anchor concept for this package is:

> **Simple class-based UI composition**: components render and update in the browser with minimal runtime ceremony.

This document is concept-first. For practical app-author guidance, see [`docs/usage.md`](./docs/usage.md). For deeper implementation details, see [`docs/components.md`](./docs/components.md) and [`docs/generation-pipeline.md`](./docs/generation-pipeline.md).

---

## 1) Philosophy and intended use-cases

`noJSX` exists to remove repetitive glue work in apps with lots of UI interactions:
- no endpoint sprawl for each tiny interaction,
- no manual request/response shape maintenance for every action,
- no custom state sync boilerplate for each component flow.

It is designed for:
- internal apps / controlled deployments,
- teams okay with generation workflows,
- apps that prefer class-based UI composition over heavy framework ceremony.

It is **not** a hosted multi-tenant platform, and does not try to solve ops-level concerns like auth hosting, tenant isolation, or scaling automation by itself.

---

## 2) Component namespace model (`n.*`) and component groups

Consumer apps use generated namespace members and intrinsic tags when a component library is present.

That component library is being reworked. The current repository direction is the runtime, generation pipeline, intrinsic tags, and browser-local rendering model rather than the old bundled component catalog.

---

## 3) Runtime model

`noJSX` is a browser-first JSX runtime with a small companion app server.

Current package surface:

- browser-rendered `NComponent` UI,
- route hosting through `NavOutlet`,
- a dev/build app server entrypoint exposed as `nojsx/start-nojsx-server`,
- server-side RPC forwarding helpers exposed as `nojsx/server/upstream-host-proxy`.

Important boundary:

- `noJSX` is not SSR or a framework with server/client component splitting,
- but it does support a server runtime for websocket-backed component calls and app-owned request handling,
- browser code can call server-owned methods with `callOnServerAsync(...)`,
- consuming apps can proxy upstream services through the app server so the browser stays same-origin.

---

## 4) Lifecycle and UI auto-init behavior

Lifecycle shape in current runtime:
1. Client component starts load wrapper.
2. Optional `onLoad(args?)` runs before the first real render.
3. `render()` patches DOM and preserves nested child instances.
4. `onUnload(args?)` runs when an instance is actually removed.

After DOM updates, the runtime re-initializes UI bindings.

---

## 5) Build workflow

### Release / publish loop

```bash
bun run build
```

This compiles the runtime into `dist/`.

```bash
bun run compile
```

This compiles the runtime and packs `nogg-aholic-nojsx.tgz` at the repo root for consumer testing.

---

## 6) Generated artifacts and PR review expectations

The old generated component namespace flow has been removed.

The remaining placeholder files under `src/core/*generated*` are transitional cleanup stubs, not active outputs of a regeneration step.

---

## 7) Mini playbook: “I changed a component, now what?”

1. Edit the active runtime source as needed.
2. Ensure methods are class fields (`method = (...) => {}`), **not** shorthand.
3. Keep logic local to component state/lifecycle where possible.
4. Run full build check before merge:
   ```bash
   bun run build
   ```
5. Commit source and any intentional build-output changes together.

---

## 8) Do / Don’t for component authoring

### Do

- Do model features as `NComponent` classes.
- Do keep component logic local and explicit.
- Do use `onLoad`/`onUnload` for lifecycle-driven setup and cleanup.
- Do use `serverLoad` and `callOnServerAsync(...)` when a component needs server-owned state or server-side calls.
- Do treat in-memory state as the source of truth for UI behavior.
- Do keep upstream services behind the app server when the browser should not connect to them directly.

### Don’t

- Don’t treat `noJSX` as React semantics.
- Don’t expose upstream hosts directly to the browser when the app server can proxy them.
- Don’t use method shorthand inside classes; use class fields with `=`.
- Don’t use deprecated `/*@client*/` or `/*@end-client*/` comments.

---

## Additional docs

- [Usage guide for app authors](docs/usage.md)
- [Component model + authoring details](docs/components.md)
- [Generation pipeline and troubleshooting](docs/generation-pipeline.md)
- [Consumer migration: generated component loaders](docs/generation-pipeline.md#consumer-migration-loader-generation-moved-to-app-prebuild)

## Minimal example project

The repository includes `examples/nojsx-minimal` as the package validation target.

It demonstrates:
- TSX compilation with `jsxImportSource: @nogg-aholic/nojsx`,
- CSS build via `nojsx-build-css`,
- consuming a packed local tarball (`file:../../nojsx/nogg-aholic-nojsx.tgz`),
- server-backed component calls through `callOnServerAsync(...)`,
- upstream host RPC bridged through the app server,
- same-origin docs passthrough for `/vscode/__docs/*`.

From the `noJSX` package directory:

```bash
bun run compile
```

Then from `examples/nojsx-minimal/`:

```bash
bun install
bunx tsc -p ./tsconfig.json --pretty false
bun run build
```

## License

MIT
