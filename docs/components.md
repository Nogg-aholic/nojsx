# nojsx Component Model

This document defines how nojsx components should be understood, authored, and consumed.

nojsx is the client-only runtime and component model that emerged from the broader `nojsx` system. `nojsx` referred to the older server-plus-client variant. The internal codebase, generated artifacts, CLI names, and some types still retain `nojsx` identifiers, but those names should be read as legacy implementation detail rather than current architectural direction.

The most important constraint is simple:

> nojsx is a browser-only UI runtime. It does not provide server rendering, server actions, transport orchestration, RPC semantics, or request lifecycle abstractions.

If you approach nojsx as React, Next.js, Remix, LiveView, or an isomorphic framework, you will make wrong architectural decisions.

## 1. Mental model

nojsx is a class-based UI system centered on explicit component instances, local state, and DOM replacement.

What it is:

- a TypeScript-first JSX runtime,
- a client-side component system built around `NComponent`,
- a browser-local runtime with delegated event wiring and UI re-initialization.

What it is not:

- not React,
- not a hydration framework,
- not SSR,
- not server/client dual execution,
- not a backend transport layer,
- not an API abstraction.

The correct framing is: nojsx renders and updates UI in the browser. Anything involving persistence, network requests, authentication exchange, or backend coordination belongs to application code outside the nojsx runtime contract.

## 2. Naming boundary: nojsx vs `nojsx`

The package and docs now refer to the client-only runtime as nojsx. Some internals are intentionally still named with `nojsx` prefixes because they descend from the older shared code and tooling surface.

You will still encounter names such as:

- `nojsx-generate-component-loaders`,
- `nojsxPageRoutes`,
- `__nojsxComponentLoaders`,
- generated files containing `nojsx` in their names,
- runtime files such as `jsx-runtime` and `jsx-dev-runtime`.

Current rule:

- product and architecture language should say nojsx,
- existing internal symbol names remain valid until explicitly renamed,
- consumers should not map old `nojsx` identifiers back onto current nojsx behavior,
- `nojsx` should be understood as the older server-plus-client variant, not as another name for current nojsx.

Legacy naming inside the codebase does not mean nojsx still carries server behavior.

## 3. Runtime surface and component authoring

Consumer applications import runtime modules from package exports and write UI using JSX with `jsxImportSource: nojsx`.

In practice:

- consuming code renders class-based components and intrinsic JSX tags,
- package authors edit runtime source files directly,
- type declarations are emitted by TypeScript from source.

## 4. The `NComponent` contract

nojsx features are authored as `NComponent` classes.

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
		this.update();
	};

	onLoad = () => {
		// browser-only setup
	};

	onUnload = () => {
		// browser-only cleanup
	};

	render = () => {
		return <button onclick={this.toggle}>Toggle</button>;
	};
}
```

Avoid method shorthand for component behavior because the component model and surrounding conventions assume explicit instance-bound class fields.

## 5. Lifecycle intent

Lifecycle in nojsx is explicit and client-local.

- `onLoad(args?)`: runs before the first real client render when the instance is initialized.
- `render()`: returns the component UI for the current state.
- `update()` or equivalent runtime-driven refresh path: causes browser DOM replacement/update work for that instance.
- `onUnload(args?)`: runs when the instance is actually removed from the runtime registry.

Correct use of lifecycle hooks:

- DOM-adjacent browser setup,
- event listener registration outside normal delegated handlers,
- timer setup and cleanup,
- integration with browser-only third-party widgets.

Incorrect use of lifecycle hooks:

- assuming server prepass execution,
- assuming request-scoped data loading,
- embedding backend protocol semantics as framework behavior,
- treating `onLoad` as a server bootstrap phase.

## 6. Runtime behavior and event wiring

nojsx produces HTML and associates behavior through runtime-managed maps and delegated attributes such as `data-action` and `data-on-*`.

Implications:

- handlers must be passed in a form the runtime can register,
- event wiring is not React synthetic events,
- runtime updates replace or patch DOM according to nojsx rules,
- UI behavior must tolerate DOM refresh cycles.

This matters operationally because assumptions imported from virtual-DOM frameworks frequently lead to the wrong debugging path. When behavior breaks, inspect generated markup, event registration, and lifecycle timing in browser terms, not React reconciliation terms.

## 7. Browser-only means browser-only

This is the central architectural constraint and should be enforced aggressively in consuming projects.

nojsx does not do:

- server rendering,
- API route generation,
- action serialization,
- backend mutation dispatch,
- socket synchronization,
- automatic loader execution on the server,
- server/client component splitting,
- request-bound dependency injection.

If an application needs backend communication, the application should implement it directly using its own network layer. nojsx can call that code from browser-side component logic, but nojsx itself is not the transport abstraction.

Practical consequence:

- fetch data from browser code when needed,
- persist application state through app-owned APIs,
- keep server concerns outside nojsx package assumptions,
- never describe nojsx components as dual-run or server-aware unless you are explicitly documenting external app infrastructure.

## 8. UI plugin and icon re-initialization

After `render()` and runtime DOM replacement/update operations, nojsx re-initializes supported UI integrations.

Consumers should generally not add duplicate “after every render” bootstrap code for standard nojsx updates.

Only add custom re-initialization code when:

- integrating a library nojsx does not already refresh,
- a widget requires instance-specific setup outside normal runtime hooks,
- the application intentionally overrides default runtime behavior.

Duplicate global re-initialization logic in consuming apps is usually a smell and often indicates the app is fighting the runtime rather than using it correctly.

## 9. Navigation and page loading

Route-to-component rendering is handled by browser runtime state and runtime components such as `NavOutlet`.

Current consumer expectations:

- page components live in the consuming app,
- route metadata (when used by the app) is consumed on the client,
- page transitions remain a client concern.

This is not server routing in framework terms. It is client-side component loading and route mapping.

## 10. How to change a component safely

When modifying a component in this package:

1. Update the active source of truth for the runtime.
2. Keep handlers and methods as class fields.
3. Keep browser behavior inside component lifecycle and state transitions.
4. Run `bun run compile` before finalizing.
5. Commit source and intentional build-output changes together.

## 11. Common misconceptions to reject

These assumptions are wrong in nojsx projects and should be corrected immediately in reviews, prompts, and implementation plans.

- “This component can do part of its work on the server.”
- “We should split this into server and client components.”
- “The framework probably has a built-in mutation transport.”
- “`onLoad` is similar to a loader or server prefetch.”
- “We need hydration language to explain startup.”
- “Generated page loaders mean SSR-aware routing.”
- “Internal `nojsx` names mean nojsx still supports the old server-plus-client model.”

Replace them with the correct statements:

- nojsx runs in the browser.
- Components are client-side instances.
- Networking is application code.
- Runtime startup is client bootstrap, not hydration.

## 12. Review criteria for component changes

When reviewing nojsx component work, look for the following:

- the change respects browser-only execution,
- no server/client split language was introduced,
- lifecycle usage is explicit and justified,
- class-field method style is preserved,
- consumer-facing docs do not borrow semantics from React-style framework vocabulary.

## 13. Short operational summary

Use this package as a client UI runtime.

- Build UI as `NComponent` classes.
- Treat nojsx as browser-local.
- Compile before release.
- Keep backend concerns outside the nojsx runtime model.

That framing prevents nearly all recurring misconceptions.
