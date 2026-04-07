import { clearInlineHandlersForComponent, injectAttributes, setRenderContext } from '../../jsx-dev-runtime.js';
import { extendShellBridge, createGetShellFunctionServer } from '../bridges/get-shell.js';
import { nContext, componentRegistry, shouldLogPreserveForAny } from '../global/registry.js';
import { refreshClientUiBindings } from '../util/ui-runtime.js';

// Runtime environment flag
/**
 * Indicates whether the current runtime is non-browser.
 *
 * @remarks
 * `true` when `window` is unavailable, `false` in browser execution.
 */
export const isServer = typeof window === 'undefined';

/**
 * Wraps a component HTML renderer and injects render metadata attributes.
 *
 * @param fn - Zero-argument renderer that returns root HTML.
 * @returns A renderer accepting component id and optional class name.
 *
 * @remarks
 * The wrapper adds `data-component-id` and merges classes via {@link injectAttributes}.
 * It does not mutate global render context.
 */
export function wrapHtmlWithRenderContext(fn: () => string): (componentId: string, className?: string) => string {
	return (componentId: string, className?: string) => {
		// Inject data-component-id and optional className into the root element
		return injectAttributes(fn(), componentId, className);
	};
}
// Basic component types (framework-agnostic)
/**
 * Base props accepted by framework component classes.
 *
 * @remarks
 * `__id`/`key`/`__key` are used to build stable component instance ids.
 */
export interface NComponentProps {
	class?: string;
	__id?: string;
	key?: string | number;
	__key?: string | number;
}

// Component instance class (replaces ComponentInstanceBase).
// NOTE: This is intentionally not backward-compatible with the prior callable `NComponent` interface.
/**
 * Base class for stateful nojsx components.
 *
 * @remarks
 * Instances are registered in the component registry and run in a client-only runtime.
 * - `render` patches DOM on the client.
 * - Initial client construction returns placeholder HTML and starts async load.
 */
export abstract class NComponent {
	// Author-provided API surface
	abstract html: (() => JSX.Element) | ((componentId: string, className?: string) => JSX.Element);
	[key: string]: any;

	// Unified instance surface (defined directly on the class; no post-construction injection)
	id!: string;
	nContext!: nContext;
	parent!: NComponent | null;
	children!: NComponent[];
	getShell = () => {
		let current: NComponent | null = this;
		while (current) {
			if (current.id === 'ShellPage') {
				return extendShellBridge(current);
			}
			current = current.parent;
		}

		// Fallback: if ShellPage isn't in the hierarchy, extend the current component.
		return extendShellBridge(this);
	};
	/*
	  Executes once before first real render. No DOM is available yet.
	*/
	onLoad?: (args?: any) => any;

	/*
	  this executes when the component instance is actually removed from the registry (stale/purged/clear),
	  not when it is preserved and reattached during render.
	*/
	onUnload?: (args?: any) => any;


	/*
		Re-evaluates `html()` and patches the DOM for this component.
		Nested children are temporarily detached and re-attached to preserve state and avoid unnecessary re-renders.
		Prefer `updateHtml(selector, html)` for small partial updates.
	*/
	render = () => {
		if (isServer) return;

		const el = document.querySelector(`[data-component-id="${this.id}"]`);
		if (!el) return;

		const currentEntry = componentRegistry.get(this.id);
		const htmlFn = currentEntry.result.html;
		if (typeof htmlFn !== 'function') return;
		const preservedChildElements = new Map<string, Element>();
		const directChildIds = [...currentEntry.childIds];
		const descendantIds: string[] = [];
		for (const [childId, childEntry] of componentRegistry.entries()) {
			if (childId === this.id) continue;
			let cursor = childEntry.parentId;
			while (cursor) {
				if (cursor === this.id) {
					descendantIds.push(childId);
					break;
				}
				cursor = componentRegistry.has(cursor) ? componentRegistry.get(cursor).parentId : null;
			}
		}
		for (const childId of descendantIds) {
			const childEl = document.querySelector(`[data-component-id="${childId}"]`);
			if (childEl) preservedChildElements.set(childId, childEl);
		}
		const before = componentRegistry.getRenderParent();
		try {
			componentRegistry.setRenderParent(this.id);
			componentRegistry.beginPreserveChildren(descendantIds, directChildIds);
			componentRegistry.prepareChildRender(this.id, currentEntry);
			const html = this.__renderHtml(this.id, this.__props?.class);
			el.outerHTML = html;
		} finally {
			componentRegistry.endPreserveChildren();
			componentRegistry.setRenderParent(before ?? '');
		}

		for (const [childId, preservedEl] of preservedChildElements.entries()) {
			if (!componentRegistry.has(childId)) continue;
			const placeholder = document.querySelector(`[data-component-id="${childId}"]`);
			if (!placeholder || !placeholder.parentNode) continue;
			placeholder.parentNode.replaceChild(preservedEl, placeholder);
		}

		refreshClientUiBindings();

			
	};

	updateHtml = (selector: string, html: string) => {
		if (isServer) return;
		const el = document.querySelector(selector);
		if (el) {
			if (html.trim().startsWith('<')) {
				el.outerHTML = html;
			} else {
				el.innerHTML = html;
			}
			refreshClientUiBindings();
		} else {
			console.warn(`[WS] updateHtml: element not found for selector: ${selector}`);
		}
	};

	// Captured construction props for rendering (used by injected render())
	private __props?: NComponentProps;
	private __didLoad = false;

	private __runOnLoadOnce(): void {
		if (this.__didLoad || isServer || typeof this.onLoad !== 'function') return;
		this.__didLoad = true;
		try {
			const out = this.onLoad.call(this);
			if (out && typeof (out as PromiseLike<unknown>).then === 'function') {
				(out as Promise<unknown>).catch((e) => {
					console.warn(`[nojsx:onLoad] async onLoad failed for ${this.id}`, e);
				});
			}
		} catch (e) {
			console.warn(`[nojsx:onLoad] onLoad failed for ${this.id}`, e);
		}
	}

	private __renderHtml(componentId: string, className?: string): string {
		const original = (this as any).html;
		if (typeof original !== 'function') {
			throw new Error(`[NComponent] Missing html() implementation for component ${this.id}`);
		}
		clearInlineHandlersForComponent(componentId);
		const prevRenderParent = componentRegistry.getRenderParent();
		const prev = setRenderContext(componentId);
		try {
			componentRegistry.setRenderParent(componentId);
			if (original.length === 0) {
				return injectAttributes(String((original as unknown as () => unknown).call(this)), componentId, className);
			}
			return String((original as unknown as (componentId: string, className?: string) => unknown).call(this, componentId, className));
		} finally {
			componentRegistry.setRenderParent(prevRenderParent ?? '');
			setRenderContext(prev);
		}
	}

	// (no constructor-time html wrapping)

	constructor(name: string, props?: NComponentProps) {
		const { componentId, instanceKey } = generateIDs(props, name);
		const ctx: nContext = { name: name, id: componentId, key: instanceKey };
		this.id = componentId;
		this.nContext = ctx;
		this.__props = props;
		this.parent = componentRegistry.getRenderParent() ? componentRegistry.get(componentRegistry.getRenderParent())?.result : null;
		this.children = [];
		this.getShell = createGetShellFunctionServer();
		register(this, ctx);
	}

	// Placeholder HTML used during initial client construction.
	__html(): string {
		this.__runOnLoadOnce();
		return this.__renderHtml(this.id, this.__props?.class);
	}
}


function generateIDs(props: NComponentProps | undefined, name: string) {
	const parentId = componentRegistry.getRenderParent();
	const forcedId = props?.__id;
	const baseId = parentId ? `${parentId}.${name}` : name;
	const explicitKey = props?.key ?? props?.__key;
	let instanceKey = '';
	let suffix = '';
	if (explicitKey !== undefined && explicitKey !== null && explicitKey !== '') {
		instanceKey = String(explicitKey);
		suffix = `:${instanceKey}`;
	} else {
		const parentKey = parentId ?? '__root__';
		let count = componentRegistry.getRenderParent() === '' ? 0 : componentRegistry.get(componentRegistry.getRenderParent())?.childIds.length;
		if (count > 0) {
			instanceKey = String(count - 1);
			suffix = `#${instanceKey}`;
		}
	}

	const componentId = typeof forcedId === 'string' && forcedId.length > 0 ? forcedId : baseId + suffix;
	if (typeof forcedId === 'string' && forcedId.length > 0 && !instanceKey) {
		if (forcedId.startsWith(baseId + ':') || forcedId.startsWith(baseId + '#')) {
			instanceKey = forcedId.slice(baseId.length + 1);
		}
	}
	return { componentId, instanceKey };
}

function register(instance: NComponent, nContext: nContext) {
	const componentId = nContext.id;
	const parentId = componentRegistry.getRenderParent();
	const wasAdded = componentRegistry.set(componentId, {
		result: instance,
		nContext,
		parentId,
		childIds: [],
	});
	const entry = componentRegistry.get(componentId);
	if (wasAdded) {
		const parentAfter = parentId ? (componentRegistry.has(parentId) ? componentRegistry.get(parentId) : undefined) : undefined;
		// Add this component to parent's children array
		if (parentAfter?.result) {
			const parentInstance = parentAfter.result as any;
			parentInstance.children = parentInstance.children ?? [];
			parentInstance.children.push(instance);
		}

	}

	//console.warn(`[ComponentRegistry] Registering component: ${componentId}, parent: ${parentId}, wasAdded: ${wasAdded}`);
}
