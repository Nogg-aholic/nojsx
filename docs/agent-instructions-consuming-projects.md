# noJSX Agent Instructions For Consuming Projects

Use noJSX as a browser-first UI runtime with an app-side server.

## Core rules

- Do not treat noJSX as SSR, hydration, or server/client component splitting.
- `NComponent` classes are browser-facing components, but noJSX also provides an app server runtime for websocket-backed server calls and request handling.
- `onLoad` and `onUnload` are client lifecycle hooks. `serverLoad` is the server handshake path.
- Internal `nojsx` names still exist. They are implementation names, not evidence of framework-style isomorphic rendering.

## Authoring expectations

- Build pages and features as `NComponent` classes.
- Define component methods and handlers as class fields with `=`.
- Keep state, rendering, and browser-side behavior inside the component.
- Use `callOnServerAsync(...)` for component-triggered server work.
- Use `nojsx/start-nojsx-server` when the app needs the noJSX server runtime.
- Use app-owned request passthroughs for same-origin access to upstream docs or services.

## Build and packaging

- Use `nojsx-build-css` when app styles should be compiled with the provider CLI.
- For local provider validation, prefer packed tarball installs (`file:../../nojsx.tgz`) over folder installs (`file:../..`).
- Use runtime routing primitives such as `NavOutlet` for client route rendering.

## Do not assume

- Do not assume React semantics.
- Do not assume Next.js or Remix patterns.
- Do not split UI into framework-style server/client component variants.
- Do not add duplicate bootstrap code for delegated events or standard runtime UI re-init unless overriding defaults intentionally.

## Preferred language

- Say: browser runtime, component instance, app server, server-backed component call, same-origin passthrough.
- Avoid: hydration, server component, action endpoint, framework RPC, isomorphic render.

## Decision test

Before proposing architecture or code, ask: “Is this behavior owned by the browser runtime, by the noJSX app server, or by app-specific infrastructure outside noJSX?”

If it is not clearly browser runtime or documented noJSX app-server behavior, do not assign it to noJSX.