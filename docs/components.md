# noJSX Component Model

This document defines how noJSX components should be understood, authored, and consumed.

noJSX is a browser-first component runtime with an app-side server. It is not a framework with SSR or server/client component splitting. The internal codebase, generated artifacts, CLI names, and some types still retain `nojsx` identifiers, but those names should be read as implementation detail rather than architectural promise.

The most important constraint is simple:

> noJSX is not SSR or hydration, but it does include a server runtime for websocket-backed component calls, `serverLoad`, and app-owned request handling.

If you approach noJSX as React, Next.js, Remix, LiveView, or an isomorphic framework, you will make wrong architectural decisions.

## 1. Mental model

noJSX is a class-based UI system centered on explicit component instances, local state, and DOM replacement.

What it is:

- a TypeScript-first JSX runtime,
- a client-side component system built around `NComponent`,
- a browser-local runtime with delegated event wiring and UI re-initialization,
- a server handshake path for component state and method calls.

What it is not:

- not React,
- not a hydration framework,
- not SSR,
- not server/client dual execution,
- not a framework-level backend abstraction.

The correct framing is: noJSX renders and updates UI in the browser, while the app server can participate in server-backed component calls and same-origin passthroughs. Broader backend coordination still belongs to application code.

## 2. Naming boundary: noJSX vs `nojsx`

The package and docs now refer to the current runtime as noJSX. Some internals are intentionally still named with `nojsx` prefixes because they descend from older shared code and tooling surface.

You will still encounter names such as:

- `nojsx-generate-component-loaders`,
- `nojsxPageRoutes`,
- `__nojsxComponentLoaders`,
- generated files containing `nojsx` in their names,
- runtime files such as `jsx-runtime` and `jsx-dev-runtime`.

Current rule:

- product and architecture language should say noJSX,
- existing internal symbol names remain valid until explicitly renamed,
- consumers should not map old `nojsx` identifiers back onto current noJSX behavior,
- legacy names should not be used to infer unsupported framework semantics.

Legacy naming inside the codebase does not define the architecture; the exported API does.

## 3. Runtime surface and component authoring

Consumer applications import runtime modules from package exports and write UI using JSX with `jsxImportSource: nojsx`.

In practice:

- consuming code renders class-based components and intrinsic JSX tags,
- components can call server-owned methods with `callOnServerAsync(...)`,
- `serverLoad` can return initial state/snapshots for a component instance,
- package authors edit runtime source files directly,
- type declarations are emitted by TypeScript from source.

## 4. The `NComponent` contract

noJSX features are authored as `NComponent` classes.

Authoring rules:

- define handlers and instance methods as class fields using `=`,
- keep state and rendering logic local to the component,
- use explicit lifecycle hooks when setup or cleanup is required,
- treat the browser runtime as the only execution environment.

Preferred style:

```ts
export class ExamplePanel extends NComponent {
	state = { open: false };

	toggle = () => {
		this.state.open = !this.state.open;
		this.render();
	};

	serverLoad = () => {
		return { args: { openedAt: Date.now() } };
	};

	onLoad = () => {
		// browser-side setup after server handshake
	};

	onUnload = () => {
		// browser-side cleanup
	};

	html = () => {
		return <button onclick={this.toggle}>Toggle</button>;
	};
}
```

Avoid method shorthand for component behavior because the component model and surrounding conventions assume explicit instance-bound class fields.

## 5. Lifecycle intent

Lifecycle in noJSX is explicit and client-local.

- `serverLoad(args?)`: runs on the server side when the client requests the initial handshake for an instance.
- `onLoad(args?)`: runs in the browser after the server handshake and before the first real render completes.
- `html()`: returns the component UI for the current state.
- `render()`: triggers DOM replacement/update work for that instance.
- `onUnload(args?)`: runs when the instance is actually removed from the runtime registry.

Correct use of lifecycle hooks:

- DOM-adjacent browser setup,
- event listener registration outside normal delegated handlers,
- timer setup and cleanup,
- integration with browser-side third-party widgets.

Incorrect use of lifecycle hooks:

- assuming SSR,
- assuming framework loader semantics,
- embedding backend protocol semantics as framework behavior,
- treating `onLoad` as the server phase instead of `serverLoad`.

## 6. Runtime behavior and event wiring

noJSX produces HTML and associates behavior through runtime-managed maps and delegated attributes such as `data-action` and `data-on-*`.

Implications:

- handlers must be passed in a form the runtime can register,
- event wiring is not React synthetic events,
- runtime updates replace or patch DOM according to noJSX rules,
- UI behavior must tolerate DOM refresh cycles.

This matters operationally because assumptions imported from virtual-DOM frameworks frequently lead to the wrong debugging path. When behavior breaks, inspect generated markup, event registration, and lifecycle timing in browser terms, not React reconciliation terms.

## 7. Server boundary and network ownership

noJSX does not do:

- server rendering,
- framework loaders/actions,
- server/client component splitting,
- automatic API design for your backend.

noJSX does support:

- server-backed component calls over its websocket transport,
- `serverLoad` for initial component handshake payloads,
- app-server request interception through `startNojsxServer({ handleRequest })`,
- server-side forwarding to upstream RPC hosts through `nojsx/server/upstream-host-proxy`.

Practical consequence:

- keep UI state and rendering behavior in components,
- keep upstream service access on the server when the client should stay same-origin,
- use app-owned APIs and contracts for broader backend concerns,
- never describe noJSX as SSR-aware or isomorphic.

## 8. UI plugin and icon re-initialization

After `render()` and runtime DOM replacement/update operations, noJSX re-initializes supported UI integrations.

Consumers should generally not add duplicate “after every render” bootstrap code for standard noJSX updates.

Only add custom re-initialization code when:

- integrating a library noJSX does not already refresh,
- a widget requires instance-specific setup outside normal runtime hooks,
- the application intentionally overrides default runtime behavior.

Duplicate global re-initialization logic in consuming apps is usually a smell and often indicates the app is fighting the runtime rather than using it correctly.

## 9. Navigation and page loading

Route-to-component rendering is handled by browser runtime state and runtime components such as `NavOutlet`.

Current consumer expectations:

- page components live in the consuming app,
- route metadata (when used by the app) is consumed on the client,
- page transitions remain a client concern.

This is not SSR routing in framework terms. It is route mapping plus browser-side page hosting.

## 10. How to change a component safely

When modifying a component in this package:

1. Update the active source of truth for the runtime.
2. Keep handlers and methods as class fields.
3. Keep browser behavior inside component lifecycle and state transitions.
4. Run `bun run compile` before finalizing.
5. Commit source and intentional build-output changes together.

## 11. Common misconceptions to reject

These assumptions are wrong in noJSX projects and should be corrected immediately in reviews, prompts, and implementation plans.

- “This component can do part of its work on the server.”
- “We should split this into server and client components.”
- “`onLoad` is similar to a loader or server prefetch.”
- “We need hydration language to explain startup.”
- “Generated page loaders mean SSR-aware routing.”
- “Internal `nojsx` names define framework-style semantics.”

Replace them with the correct statements:

- noJSX runs in the browser.
- Components are client-side instances.
- Server-backed component calls exist, but they are not SSR.
- Runtime startup is client bootstrap plus server handshake, not hydration.

## 12. Review criteria for component changes

When reviewing noJSX component work, look for the following:

- the change respects the browser-first runtime model,
- no SSR/server-component language was introduced,
- lifecycle usage is explicit and justified,
- class-field method style is preserved,
- consumer-facing docs do not borrow semantics from React-style framework vocabulary.

## 13. Short operational summary

Use this package as a browser-first UI runtime with a small app server.

- Build UI as `NComponent` classes.
- Treat noJSX as browser-local for rendering.
- Use the server runtime for `serverLoad`, `callOnServerAsync(...)`, and app-owned same-origin passthroughs.
- Compile before release.
- Keep broader backend concerns outside the noJSX runtime model.

That framing prevents nearly all recurring misconceptions.
