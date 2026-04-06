# nojsx Agent Instructions For Consuming Projects

Use nojsx as a browser-only UI runtime.

## Core rules

- Treat nojsx as client-only. No server components, SSR, hydration model, server actions, RPC layer, or transport semantics are provided by nojsx.
- `NComponent` classes execute in browser runtime terms. `onLoad` and `onUnload` are client lifecycle hooks, not server phases.
- Internal `nojsx` names still exist. They come from the older server-plus-client variant and are not architectural signals for current nojsx.

## Authoring expectations

- Build pages and features as `NComponent` classes.
- Define component methods and handlers as class fields with `=`.
- Keep state, rendering, and browser-side behavior inside the component.
- Put networking in app-owned browser code when needed. Do not invent nojsx server abstractions.

## Build and packaging

- Use `nojsx-build-css` when app styles should be compiled with the provider CLI.
- For local provider validation, prefer packed tarball installs (`file:../../nojsx.tgz`) over folder installs (`file:../..`).
- Use runtime routing primitives such as `NavOutlet` for client route rendering.

## Do not assume

- Do not assume React semantics.
- Do not assume Next.js or Remix patterns.
- Do not split logic into server/client variants unless the consuming app explicitly adds its own non-nojsx infrastructure.
- Do not add duplicate bootstrap code for delegated events or standard runtime UI re-init unless overriding defaults intentionally.

## Preferred language

- Say: browser runtime, client-side component, route metadata, component instance, client bootstrap.
- Avoid: hydration, server loader, server component, action endpoint, framework RPC, isomorphic render.

## Decision test

Before proposing architecture or code, ask: “Is this behavior owned by nojsx runtime in the browser, or by the consuming app outside nojsx?”

If it is not clearly browser-runtime behavior, do not assign it to nojsx.