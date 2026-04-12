# nojsx Usage Guide

This guide is for app authors using `nojsx` to build browser-rendered UI.

It focuses on the current runtime model:
- browser-only,
- class-based components,
- JSX compiled with `jsxImportSource: nojsx`,
- client-side shell and route hosting.

For deeper runtime internals, see [components.md](components.md).

## 1. What you build with nojsx

A typical nojsx app has three layers:
- a shell component that owns the app layout,
- page components rendered inside the shell,
- reusable nested components with local state.

The minimal example shows this split in [examples/nojsx-minimal/src/app.tsx](../examples/nojsx-minimal/src/app.tsx), [examples/nojsx-minimal/src/pages/home.tsx](../examples/nojsx-minimal/src/pages/home.tsx), and [examples/nojsx-minimal/src/components/persistent-counter.tsx](../examples/nojsx-minimal/src/components/persistent-counter.tsx).

## 2. Project setup

### TypeScript config

Use `react-jsx` mode and point the JSX runtime at `nojsx`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "nojsx",
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

Consumer apps install `nojsx` like a normal dependency. In this repo's examples it is consumed from a local tarball:

```json
{
  "dependencies": {
    "nojsx": "file:../../nojsx.tgz"
  }
}
```

Reference: [examples/nojsx-minimal/package.json](../examples/nojsx-minimal/package.json).

### JSX file header

Files using JSX should declare the runtime source:

```ts
/** @jsxImportSource nojsx */
```

## 3. Authoring a component

nojsx components are classes. Reusable UI typically extends `NComponent`.

```tsx
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx";

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

nojsx does not use React hooks. State is usually just instance fields.

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

For the repo itself:

```bash
bun run build
```

Builds the library and support scripts.

To package the library for local example consumption:

```bash
bun run pack:tgz
```

To refresh the examples against the current package:

```bash
bun run refresh:examples
```

To validate the minimal example package flow:

```bash
bun run test:tgz:minimal
```

References:
- [README.md](../README.md)
- [scripts/refresh-examples.ts](../scripts/refresh-examples.ts)

## 10. Using the inflight build without running a server

The inflight build path can be used directly without starting the Live Preview extension server.

The public entrypoint is the package export:
- [package.json](../package.json)

It exposes:

```ts
import { renderLivePreview } from "nojsx/live-preview-runner";
```

This runner takes a TSX file plus source text, compiles it through the live-preview pipeline, and returns HTML.

Minimal example:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderLivePreview } from "nojsx/live-preview-runner";

const filePath = path.resolve("src/app.tsx");
const sourceText = await readFile(filePath, "utf8");

const html = await renderLivePreview({
  filePath,
  sourceText,
  serverSessionId: "manual-preview-session"
});

console.log(html);
```

What to pass:
- `filePath`: absolute path to the TSX entry file.
- `sourceText`: the current source text to compile.
- `serverSessionId` or `serverProcessRef`: optional stable cache key if you want to reuse the inflight compiler state across repeated renders.
- `requestPath`: optional route path when previewing shell-based apps.
- `httpPort`: optional. Only needed when you specifically want generated browser preview modules to point at a running HTTP host.

For no-server usage, the normal path is:
- omit `httpPort`,
- call `renderLivePreview(...)`,
- consume the returned HTML string directly.

Why this works:
- the runner creates a temporary request workspace,
- compiles the entry through the live-preview compiler,
- reuses inflight incremental compiler state when you keep the same session id,
- returns the rendered HTML without needing the extension's HTTP content loader.

Important limitation:
- this does not create a standalone app server,
- it is for HTML generation and repeated preview-style recompiles,
- if your rendered output expects browser-loaded modules or assets from an HTTP origin, you must provide that hosting separately.

If you want to measure or exercise just the compile side, the repo also includes a local benchmark entry that calls the same compile helper directly:
- [src/live-preview/bench-live-preview-compile.ts](../src/live-preview/bench-live-preview-compile.ts)

## 11. Minimal mental model

Use nojsx like this:
- build class-based browser components,
- render JSX through `html`,
- update local instance state directly,
- call `this.render()` when state changes,
- host page content in `NavOutlet`,
- navigate through the shell,
- keep backend and transport concerns outside the runtime.

## 12. Common mistakes

Do not assume nojsx is:
- React,
- SSR,
- hydration,
- server/client split rendering,
- built-in transport or backend orchestration.

Do not use:
- method shorthand inside component classes,
- React hook mental models,
- server lifecycle language when describing client components.

## 13. Where to go next

- Runtime/component details: [components.md](components.md)
- Generation and loader pipeline: [generation-pipeline.md](generation-pipeline.md)
- Minimal example app shell: [examples/nojsx-minimal/src/app.tsx](../examples/nojsx-minimal/src/app.tsx)
