# noJSX Usage Guide

This guide is for app authors using `noJSX` to build browser-rendered UI with an app-side server runtime.

It focuses on the current runtime model:
- browser-first,
- class-based components,
- JSX compiled with `jsxImportSource: nojsx`,
- client-side shell and route hosting,
- websocket-backed component server calls,
- app-owned request handling at the noJSX server boundary.

For deeper runtime internals, see [components.md](components.md).

## 1. What you build with noJSX

A typical noJSX app has three layers:
- a shell component that owns the app layout,
- page components rendered inside the shell,
- reusable nested components with local state.

The minimal example shows this split in [examples/nojsx-minimal/src/app.tsx](../examples/nojsx-minimal/src/app.tsx), [examples/nojsx-minimal/src/pages/home.tsx](../examples/nojsx-minimal/src/pages/home.tsx), and [examples/nojsx-minimal/src/components/persistent-counter.tsx](../examples/nojsx-minimal/src/components/persistent-counter.tsx).

## 2. Project setup

### TypeScript config

Use `react-jsx` mode and point the JSX runtime at `@nogg-aholic/nojsx`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@nogg-aholic/nojsx",
    "rootDir": ".",
    "baseUrl": ".",
    "outDir": "./dist",
    "strict": true,
    "skipLibCheck": true
  }
}
```

Reference: [examples/nojsx-minimal/tsconfig.json](../examples/nojsx-minimal/tsconfig.json).

### Package dependency

Consumer apps install `@nogg-aholic/nojsx` like a normal dependency. In this repo's examples, noJSX is consumed from a local tarball:

```json
{
  "dependencies": {
    "@nogg-aholic/nojsx": "file:../../nojsx/nogg-aholic-nojsx.tgz"
  }
}
```

Reference: [examples/nojsx-minimal/package.json](../examples/nojsx-minimal/package.json).

### JSX file header

Files using JSX should declare the runtime source:

```ts
/** @jsxImportSource @nogg-aholic/nojsx */
```

## 3. Authoring a component

noJSX components are classes. Reusable UI typically extends `NComponent`.

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

Rules that matter:
- Use class fields for handlers and methods: `increment = () => {}`.
- Keep local state on the instance.
- Trigger UI refresh explicitly with `this.render()`.
- Return JSX from `html`.

Reference pattern: [examples/nojsx-minimal/src/components/persistent-counter.tsx](../examples/nojsx-minimal/src/components/persistent-counter.tsx).

## 4. Building the app shell

A top-level app usually extends `ShellPageParent`.

The shell defines shared layout and provides the host for route content.

```tsx
/** @jsxImportSource nojsx */
import { ShellPageParent, NavOutlet } from "nojsx";

export default class ShellPage extends ShellPageParent {
  static layout_title = "My App";
  static layout_cspNonce = "nsx-importmap";
  static layout_appHostId = "info";
  static layout_bodyClass = "bg-slate-950 text-white";

  constructor(props?: any) {
    super({ ...props });
  }

  html = () => (
    <main>
      <header>My shell</header>
      <NavOutlet />
    </main>
  );
}
```

What the shell does:
- defines global layout metadata,
- stays mounted while route content changes,
- hosts the active page through `NavOutlet`.

Reference: [examples/nojsx-minimal/src/app.tsx](../examples/nojsx-minimal/src/app.tsx).

## 5. Routing and navigation

`NavOutlet` is the page host. It swaps visible page content without tearing down the shell.

The minimal example is intentionally built to demonstrate instance persistence across route changes. The shell description in [examples/nojsx-minimal/src/app.tsx](../examples/nojsx-minimal/src/app.tsx) calls this out directly.

Programmatic navigation is done through the shell:

```ts
this.getShell().nav("/about");
```

Use this from event handlers in shell children like nav controls.

Practical effects:
- route changes swap the outlet content,
- the shell remains alive,
- page instances can be cached,
- nested stateful components can remain sticky depending on the route host behavior.

See also:
- [examples/nojsx-minimal/src/app.tsx](../examples/nojsx-minimal/src/app.tsx)
- [examples/nojsx-minimal/src/pages/home.tsx](../examples/nojsx-minimal/src/pages/home.tsx)
- [examples/nojsx-minimal/src/pages/about.tsx](../examples/nojsx-minimal/src/pages/about.tsx)

## 6. State and re-rendering

noJSX does not use React hooks. State is usually just instance fields.

Typical pattern:
- store state on `this`,
- mutate it in an event handler,
- call `this.render()`.

Example from the minimal app:
- `count` is stored on the component instance,
- `increment` updates the field,
- `html` reads the current value and returns JSX.

Reference: [examples/nojsx-minimal/src/components/persistent-counter.tsx](../examples/nojsx-minimal/src/components/persistent-counter.tsx).

## 7. Children and composition

Nested composition works through standard JSX children and props.

Example pattern:

```tsx
<CounterCard explanation="Nested state persists here">
  <div>extra child content</div>
</CounterCard>
```

Inside the component:

```tsx
{this.props?.children}
```

Reference: [examples/nojsx-minimal/src/components/persistent-counter.tsx](../examples/nojsx-minimal/src/components/persistent-counter.tsx).

## 8. Styling

Use normal `class` attributes in JSX. The examples use Tailwind-style utility classes directly.

Example:

```tsx
<div class="rounded-2xl border border-white/10 bg-[#101726] p-6">
  ...
</div>
```

The repo also exposes CSS tooling used by the examples. The README documents `nojsx-build-css` as part of the validation flow.

For consumer apps:
- keep global styles in your app,
- use utility classes or normal CSS as needed,
- treat styling as standard browser-side styling rather than framework-specific CSS semantics.

## 9. Development workflow in this repo

For the `noJSX` package itself:

```bash
bun run build
```

Builds the library and support scripts into `dist/`.

To build and pack the library for local example consumption:

```bash
bun run compile
```

This writes `nojsx.tgz` in the package root.

To validate the minimal example against the packed tarball:

```bash
cd ../examples/nojsx-minimal
bun install
bunx tsc -p ./tsconfig.json --pretty false
bun run build
```

References:
- [README.md](../README.md)
- [scripts/refresh-examples.ts](../scripts/refresh-examples.ts)

### Extending the builder import map

`buildNojsxApp(...)` seeds the browser import map for the noJSX and nRPC runtimes.

If your client code needs additional bare browser imports, extend that map explicitly:

```ts
import { buildNojsxApp } from "nojsx/build-nojsx-app-dev";

await buildNojsxApp({
  appRoot: ".",
  origin: "http://127.0.0.1:4174",
  importMap: {
    extend: {
      "@vendor/browser-safe-lib": "http://127.0.0.1:4174/vendor/browser-safe-lib/index.js",
      "client-shim": "http://127.0.0.1:4174/src/shims/client-shim.js",
    },
  },
});
```

Notes:
- this augments the default noJSX import-map entries instead of replacing them,
- keep entries browser-viable and intentionally client-facing,
- server-only imports and DLL-backed code should stay outside the browser import map.

### Static export mode

If an app should ship as a standalone browser build without the noJSX app server, use the static target:

```ts
import { buildNojsxApp } from "nojsx/build-nojsx-app-dev";

await buildNojsxApp({
  appRoot: ".",
  origin: "http://127.0.0.1:4174",
  target: "static",
});
```

What changes in static mode:
- HTML uses relative URLs instead of the dev server origin,
- runtime package files are copied into `dist/_pkg/...`,
- browser imports still stay externalized through the import map,
- no bundling happens.

You can control which package runtimes are copied:

```ts
await buildNojsxApp({
  appRoot: ".",
  origin: "http://127.0.0.1:4174",
  target: "static",
  static: {
    copyRuntimePackages: ["@nogg-aholic/nojsx", "@nogg-aholic/nrpc"],
  },
});
```

This is intended as the safe baseline for standalone apps before any allowlist bundling is introduced.

## 10. App server and server-side request handling

The package export `nojsx/start-nojsx-server` starts the app server used by the examples.

Minimal shape:

```ts
import { startNojsxServer } from "nojsx/start-nojsx-server";

await startNojsxServer({
  serverModuleUrl: import.meta.url,
  logPrefix: "[my-app]",
});
```

`StartNojsxServerOptions` also supports `handleRequest`, which lets the app intercept HTTP requests before static asset handling.

This is the right place to add same-origin passthrough routes for docs or other server-owned resources.

Example pattern from `examples/nojsx-minimal`:

```ts
await startNojsxServer({
  serverModuleUrl: import.meta.url,
  handleRequest: async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/vscode/__docs/")) return null;

    const upstreamUrl = new URL(`http://127.0.0.1:43111${url.pathname}${url.search}`);
    const upstreamResponse = await fetch(upstreamUrl);
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: upstreamResponse.headers,
    });
  },
});
```

This keeps the browser on the app origin while the server talks to the upstream proxy.

## 11. Server-backed component calls

Components can call server-owned methods with `callOnServerAsync(...)`.

Common patterns:

- `serverLoad = () => ...` for initial handshake state,
- component methods that run on the server and are invoked from the browser,
- server-owned imports inside those methods.

Example pattern:

```tsx
loadCommandsFromServer = async (): Promise<string[]> => {
  const { vscode } = await import("../server/vscode-rpc.js");
  return vscode.commands.getCommands(true);
};

loadCommands = async () => {
  this.commands = await this.callOnServerAsync(this.loadCommandsFromServer);
  this.render();
};
```

References:

- [examples/nojsx-minimal/src/components/host-proxy-demo.tsx](../examples/nojsx-minimal/src/components/host-proxy-demo.tsx)
- [examples/nojsx-minimal/src/components/persistent-counter.tsx](../examples/nojsx-minimal/src/components/persistent-counter.tsx)

## 12. Upstream host RPC

`nojsx/server/upstream-host-proxy` configures server-side forwarding to an upstream RPC host.

Typical setup:

```ts
import { configureUpstreamHostRpc } from "nojsx/server/upstream-host-proxy";

configureUpstreamHostRpc("vscode", {
  rpcEndpoint: "http://127.0.0.1:43111/rpc",
  wsEndpoint: "ws://127.0.0.1:43111/ws",
});
```

Then server methods can call that upstream through `invokeUpstreamHostRpc(...)` or a typed wrapper.

Reference:

- [examples/nojsx-minimal/src/server-startup.ts](../examples/nojsx-minimal/src/server-startup.ts)
- [examples/nojsx-minimal/src/server/vscode-rpc.ts](../examples/nojsx-minimal/src/server/vscode-rpc.ts)

## 13. Minimal mental model

Use noJSX like this:
- build class-based browser components,
- render JSX through `html`,
- update local instance state directly,
- call `this.render()` when state changes,
- host page content in `NavOutlet`,
- navigate through the shell,
- use the app server for server-owned methods and request passthrough,
- keep direct browser-to-upstream connections out of the client when the server can own them.

## 14. Common mistakes

Do not assume noJSX is:
- React,
- SSR,
- hydration,
- server/client split rendering.

Do not use:
- method shorthand inside component classes,
- React hook mental models,
- direct browser connections to upstream services when the app server should proxy them.

## 15. Where to go next

- Runtime/component details: [components.md](components.md)
- Generation and loader pipeline: [generation-pipeline.md](generation-pipeline.md)
- Minimal example app shell: [examples/nojsx-minimal/src/app.tsx](../examples/nojsx-minimal/src/app.tsx)
