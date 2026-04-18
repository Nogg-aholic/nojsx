# noJSX

`noJSX` is a browser-first JSX runtime and small app-side server toolkit for class-based UI.

It is built to pair well with `@nogg-aholic/nrpc` for server-backed component calls and same-origin upstream RPC forwarding.

It is **not React**, **not SSR**, and **not** a framework with server/client component splitting.

For deeper docs, see [docs/usage.md](docs/usage.md), [docs/components.md](docs/components.md), and [docs/generation-pipeline.md](docs/generation-pipeline.md).

## What Exists Now

Current package surface:

- `NComponent` for class-based browser UI
- `ShellPageParent` and `NavOutlet` for shell-plus-route composition
- `bootstrapClientRuntime(...)` for client startup
- `@nogg-aholic/nojsx/build-nojsx-app-dev` for app dev/build output
- `@nogg-aholic/nojsx/start-nojsx-server` for the app-side server runtime
- `@nogg-aholic/nojsx/server/upstream-host-proxy` for same-origin upstream RPC bridging
- `nojsx-build-css` for CSS/Tailwind-oriented consumer builds

What does **not** exist anymore:

- the old `n.*` generated component namespace model
- bundled component-group catalogs
- the old idea of `noJSX` as a generated component-library surface

This package is now the runtime, shell/routing primitives, app build helpers, and app-server transport surface.

## Core Model

`noJSX` renders in the browser.

Components are explicit class instances. They keep local state on `this`, return JSX from `html()`, and call `this.render()` when state changes.

Minimal shape:

```tsx
/** @jsxImportSource @nogg-aholic/nojsx */
import { NComponent } from "@nogg-aholic/nojsx";

export class CounterCard extends NComponent {
   count = 0;

   constructor(props?: any) {
      super("CounterCard", props);
   }

   increment = () => {
      this.count += 1;
      this.render();
   };

   html = () => (
      <button type="button" onclick={this.increment}>
         count: {this.count}
      </button>
   );
}
```

Important rules:

- use class fields for handlers and methods
- keep state on the component instance
- call `this.render()` explicitly
- do not assume React hook semantics

## Server Model

`noJSX` includes an app-side server path for component handshakes and method calls.

The important runtime features are:

- `serverLoad(args?)` for initial server-owned state or handshake data
- `callOnServerAsync(...)` for invoking server-owned component methods
- websocket-backed transport between browser runtime and app server
- optional same-origin forwarding to upstream RPC services

That transport is built with `@nogg-aholic/nrpc` in mind. Internally, `noJSX` uses `nRPC` codecs/message helpers for runtime RPC framing and upstream proxy behavior.

This means:

- you can keep browser UI same-origin while still calling app-owned server logic
- you can bridge typed upstream RPC definitions through the app server
- you do not need to expose upstream hosts directly to the browser

## How `nRPC` Fits

`noJSX` and `@nogg-aholic/nrpc` are complementary:

- `noJSX` owns UI instances, DOM updates, shell routing, and the app-server bridge
- `nRPC` owns compact RPC framing, method references, codecs, and typed upstream call surfaces

Typical pairing:

1. define or generate a typed upstream RPC surface with `@nogg-aholic/nrpc`
2. configure the upstream at the app-server boundary with `configureUpstreamHostRpc(...)`
3. call that upstream from browser-owned components through `callOnServerAsync(...)`

The minimal example demonstrates this with a VS Code upstream host proxy.

## App Structure

A typical `noJSX` app has:

- a shell component extending `ShellPageParent`
- route content rendered through `NavOutlet`
- nested `NComponent` classes for reusable UI
- optional app-server startup using `startNojsxServer(...)`
- optional upstream RPC registration using `configureUpstreamHostRpc(...)`

This is a browser-first architecture with an app-owned server boundary, not a dual-rendered framework.

## Install

```bash
npm install @nogg-aholic/nojsx
```

or

```bash
bun add @nogg-aholic/nojsx
```

TypeScript setup:

```json
{
   "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "jsx": "react-jsx",
      "jsxImportSource": "@nogg-aholic/nojsx"
   }
}
```

JSX files should declare:

```ts
/** @jsxImportSource @nogg-aholic/nojsx */
```

## Build And Pack

From [nojsx](.):

```bash
bun run build
```

Builds runtime and helper output into `dist/`.

```bash
bun run compile
```

Builds and packs a stable local test tarball:

- `nogg-aholic-nojsx.tgz`

Versioned pack output is also produced during packing, for example:

- `nogg-aholic-nojsx-1.0.108.tgz`

## Minimal Example

The validation target in this repository is [examples/nojsx-minimal](../examples/nojsx-minimal).

It demonstrates:

- `jsxImportSource: @nogg-aholic/nojsx`
- shell-plus-route composition with `ShellPageParent` and `NavOutlet`
- explicit `NComponent` state and rerender flow
- app startup through `startNojsxServer(...)`
- server-backed component calls through `callOnServerAsync(...)`
- upstream typed RPC access via `@nogg-aholic/nrpc`
- same-origin docs passthrough under `/vscode/__docs/*`

Validation flow:

```bash
cd nojsx
bun run compile

cd ../examples/nojsx-minimal
bun install
bunx tsc -p ./tsconfig.json --pretty false
bun run build
```

## Boundaries

Use `noJSX` when you want:

- browser-rendered class-based UI
- explicit component instances and explicit rerendering
- app-owned server methods reachable from UI components
- same-origin upstream RPC bridging
- a small runtime instead of a full framework abstraction

Do not use `noJSX` expecting:

- SSR or hydration
- React hooks or React component semantics
- server/client component splitting
- a built-in generated component catalog
- framework-owned backend architecture outside the app-server boundary

## Additional Docs

- [docs/usage.md](docs/usage.md)
- [docs/components.md](docs/components.md)
- [docs/generation-pipeline.md](docs/generation-pipeline.md)

## License

MIT
