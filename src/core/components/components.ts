import { clearInlineHandlersForComponent, injectAttributes, setRenderContext } from '../../jsx-dev-runtime.js';
import { extendShellBridge, createGetShellFunctionServer } from '../bridges/get-shell.js';
import { nContext, componentRegistry, functionToMethodName, type nojsxGlobals } from '../global/registry.js';
import { ensureConnected } from '../transport/client/connection.js';
import { sendRpcToServerAwait } from '../transport/client/sender.js';
import { sendRenderComponent, sendUpdateHtml } from '../transport/server/sender.js';
import { applyComponentSnapshot } from '../util/component-snapshot.js';
import { refreshClientUiBindings } from '../util/ui-runtime.js';

type RpcArgsFor<T extends (...args: any[]) => any> = Parameters<T> extends [] ? undefined : Parameters<T> extends [infer A] ? A : Parameters<T>;

type ServerLoadHandshakeResponse = {
	args?: unknown;
	__state?: Record<string, unknown>;
	__snapshot?: Record<string, unknown>;
};

type nojsxClientDebugGlobals = {
	__nojsxLastLoadArgs?: Map<string, unknown>;
	__nojsxLoadPending?: Map<string, Promise<void>>;
};

async function runClientLoadWrapper(instance: NComponent): Promise<void> {
	if (typeof window === 'undefined') return;
	const id = instance.id;
	const g = globalThis as typeof globalThis & nojsxClientDebugGlobals;

	let onLoadArgs: unknown = undefined;
	const res = (await instance.callOnServerAsync(instance.__nojsxServerLoad, undefined)) as ServerLoadHandshakeResponse | null | undefined;
	const snapshot = res?.__snapshot;
	if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
		applyComponentSnapshot(instance as unknown as Record<string, unknown>, snapshot);
	}
	try {
		const state = res?.__state;
		if (state && typeof state === 'object') {
			for (const [key, value] of Object.entries(state)) {
				const stateKey = `${id}:${key}`;
				if (stateHydratedKeys.has(stateKey)) continue;
				const prev = stateCache.get(stateKey);
				stateCache.set(stateKey, value);
				stateHydratedKeys.add(stateKey);
				const callbacks = stateSyncCallbacks.get(stateKey);
				if (callbacks) callbacks.forEach((cb) => (cb as (value: unknown, prev?: unknown) => void)(value, prev as unknown));
			}
		}
	} catch (e) {
		console.warn('[Load] Failed to hydrate state from serverLoad', e);
	}

	onLoadArgs = res?.args;
	if (snapshot && typeof snapshot === 'object' && onLoadArgs && typeof onLoadArgs === 'object') {
		onLoadArgs = { ...(onLoadArgs as Record<string, unknown>), __snapshot: snapshot };
	} else if (snapshot && typeof snapshot === 'object') {
		onLoadArgs = { __snapshot: snapshot };
	}

	if (typeof instance.onLoad === 'function') {
		await (instance.onLoad as (args: unknown) => unknown).call(instance, onLoadArgs);
	}

	try {
		g.__nojsxLastLoadArgs = g.__nojsxLastLoadArgs ?? new Map<string, unknown>();
		if (typeof instance.id === 'string') {
			g.__nojsxLastLoadArgs.set(instance.id, onLoadArgs);
		}
	} catch {
		// ignore
	}
}

function getClientLoadState(): { pending: Map<string, Promise<void>> } {
	const g = globalThis as typeof globalThis & nojsxClientDebugGlobals;
	g.__nojsxLoadPending = g.__nojsxLoadPending ?? new Map<string, Promise<void>>();
	return {
		pending: g.__nojsxLoadPending,
	};
}

function ensureClientLoadStarted(instance: NComponent): void {
	if (typeof window === 'undefined') return;
	const id = instance.id;
	const { pending } = getClientLoadState();
	if (pending.has(id)) return;

	const p = runClientLoadWrapper(instance)
		.then(() => {
			instance.render();
			pending.delete(id);
		})
		.catch((e) => {
			throw new Error(`[Load] Client load failed for component ${id}: ${e?.message ?? e}`);
		});

	pending.set(id, p);
}

export const isServer = typeof window === 'undefined';
export const stateCache = new Map<string, unknown>();
export const stateSyncCallbacks = new Map<string, Set<(value: unknown, previous?: unknown) => void>>();
export const stateHydratedKeys = new Set<string>();

export function wrapHtmlWithRenderContext(fn: () => string): (componentId: string, className?: string) => string {
	return (componentId: string, className?: string) => {
		return injectAttributes(fn(), componentId, className);
	};
}

export interface NComponentProps extends JSX.HtmlTag {
	class?: string;
	__id?: string;
	__parentId?: string | null;
	key?: string | number;
	__key?: string | number;
}

export abstract class NComponent {
	abstract html: (() => JSX.Element) | ((componentId: string, className?: string) => JSX.Element);
	[key: string]: any;

	id!: string;
	nContext!: nContext;
	parent!: NComponent | null;
	children!: NComponent[];
	__serverHandlers?: Record<string, Function>;
	getShell = () => {
		let current: NComponent | null = this;
		while (current) {
			if (current.id === 'ShellPage') {
				return extendShellBridge(current);
			}
			current = current.parent;
		}
		return extendShellBridge(this);
	};

	serverLoad?: (args?: any) => any;
	onLoad?: (args?: any) => any;
	onUnload?: (args?: any) => any;

	__nojsxServerLoad = (_args?: unknown) => {
		return undefined;
	};

	callHostAsync = <TArgs extends any[], TResult>(method: (...args: TArgs) => TResult, ...args: TArgs): Promise<Awaited<TResult>> => {
		if (isServer) {
			const hostMethodName = (method as unknown as { __nojsxRpcName?: string } | undefined)?.__nojsxRpcName;
			if (typeof hostMethodName !== 'string' || hostMethodName.length === 0) {
				return Promise.reject(new Error('Cannot resolve host method to name for callHostAsync.'));
			}
			const runtime = (globalThis as { __livePreviewRuntime?: { hostRoots?: Record<string, unknown> } }).__livePreviewRuntime;
			const parts = hostMethodName.split('.').filter(Boolean);
			let current: unknown = runtime?.hostRoots?.[parts[0]];
			let parent: unknown = runtime?.hostRoots;
			for (let index = 1; current !== undefined && index < parts.length; index += 1) {
				parent = current;
				current = (current as Record<string, unknown>)[parts[index]];
			}
			if (typeof current !== 'function') {
				return Promise.reject(new Error(`Host handler not found: ${hostMethodName}`));
			}
			return Promise.resolve(invokeHostHandlerWithParent(current as Function, parent, args)) as Promise<Awaited<TResult>>;
		}
		return this.callOnServerAsync(method, ...args);
	};

	readHostValue = <TValue>(value: (TValue & { __nojsxRpcName?: string }) | undefined): Promise<Awaited<TValue | undefined>> => {
		const hostMethodName = (value as unknown as { __nojsxRpcName?: string } | undefined)?.__nojsxRpcName;
		if (typeof hostMethodName !== 'string' || hostMethodName.length === 0) {
			return Promise.reject(new Error('Cannot resolve host property to name for readHostValue.'));
		}

		if (isServer) {
			const runtime = (globalThis as { __livePreviewRuntime?: { hostRoots?: Record<string, unknown> } }).__livePreviewRuntime;
			const parts = hostMethodName.split('.').filter(Boolean);
			let current: unknown = runtime?.hostRoots?.[parts[0]];
			for (let index = 1; current !== undefined && index < parts.length; index += 1) {
				current = (current as Record<string, unknown>)[parts[index]];
			}
			if (current === undefined) {
				return Promise.reject(new Error(`Host property not found: ${hostMethodName}`));
			}
			return Promise.resolve(current) as Promise<Awaited<TValue | undefined>>;
		}

		return this.callHostPropertyOnServerAsync<TValue | undefined>(hostMethodName);
	};

	private callHostPropertyOnServerAsync = <TValue>(methodName: string): Promise<Awaited<TValue>> => {
		if (isServer) {
			return Promise.reject(new Error('callHostPropertyOnServerAsync is only available in the live preview client runtime.'));
		}

		return ensureConnected().then(() => {
			const globals = globalThis as unknown as nojsxGlobals;
			globals.__nojsxRpcPending = globals.__nojsxRpcPending ?? new Map();
			globals.__nojsxRpcNextId = (globals.__nojsxRpcNextId ?? 1) >>> 0;
			const requestId = globals.__nojsxRpcNextId >>> 0;
			globals.__nojsxRpcNextId = (requestId + 1) >>> 0;

			return new Promise<Awaited<TValue>>((resolve, reject) => {
				globals.__nojsxRpcPending?.set(requestId, {
					resolve: resolve as (value: unknown) => void,
					reject,
				});
				sendRpcToServerAwait(methodName, this.id, null, requestId);
			});
		});
	};

	callOnServerAsync = <T extends (...args: any[]) => any>(method: T, args?: RpcArgsFor<T>): Promise<Awaited<ReturnType<T>>> => {
		if (isServer) {
			return Promise.reject(new Error('callOnServerAsync is only available in the live preview client runtime.'));
		}

		this.__ensureMapped();
		const globals = globalThis as unknown as nojsxGlobals;
		const resolved = globals.__functionToMethodName?.get(method as unknown as Function);
		const methodName =
			resolved && resolved.componentId === this.id
				? resolved.methodName
				: (method as unknown as { __nojsxRpcName?: string })?.__nojsxRpcName;
		const targetComponentId = resolved && resolved.componentId === this.id ? this.id : '';

		if (typeof methodName !== 'string' || methodName.length === 0) {
			return Promise.reject(new Error('Cannot resolve method to name for callOnServerAsync.'));
		}

		return ensureConnected().then(() => {
			globals.__nojsxRpcPending = globals.__nojsxRpcPending ?? new Map();
			globals.__nojsxRpcNextId = (globals.__nojsxRpcNextId ?? 1) >>> 0;
			const requestId = globals.__nojsxRpcNextId >>> 0;
			globals.__nojsxRpcNextId = (requestId + 1) >>> 0;
			return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
				globals.__nojsxRpcPending?.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
				sendRpcToServerAwait(methodName, targetComponentId, args, requestId);
			});
		});
	};

	render = () => {
		this.__ensureMapped();
		if (isServer) {
			sendRenderComponent(this.id);
			return;
		}

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
			const placeholder = document.querySelector(`[data-component-id="${childId}"]`);
			if (!placeholder || !placeholder.parentNode) continue;
			placeholder.parentNode.replaceChild(preservedEl, placeholder);
		}

		const newEl = document.querySelector(`[data-component-id="${this.id}"]`);
		if (newEl) {
			newEl.addEventListener('server-render', () => {
				this.render();
			});
		}

		refreshClientUiBindings();
	};

	updateHtml = (selector: string, html: string) => {
		if (isServer) {
			sendUpdateHtml(this.id, selector, html);
			return;
		}
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

	public props?: NComponentProps;
	public __props?: NComponentProps;
	private __mapped = false;

	private __ensureMapped(): void {
		if (this.__mapped) return;
		this.__mapped = true;
		const reserved = new Set<string>([
			'html',
			'id',
			'nContext',
			'__html',
			'__nojsxServerLoad',
			'render',
			'updateHtml',
			'callOnServerAsync',
			'getShell',
			'parent',
			'children',
			'__serverHandlers',
		]);

		if (typeof this.__nojsxServerLoad === 'function') {
			functionToMethodName.set(this.__nojsxServerLoad, { componentId: this.id, methodName: 'serverLoad' });
		}

		for (const key of Object.keys(this)) {
			if (reserved.has(key)) continue;
			const value = (this as any)[key];
			if (typeof value !== 'function') continue;
			functionToMethodName.set(value, { componentId: this.id, methodName: key });
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

	constructor(nameOrProps?: string | NComponentProps, maybeProps?: NComponentProps) {
		const inferredName = typeof nameOrProps === 'string'
			? nameOrProps
			: ((this as any)?.constructor?.name || 'Component');
		const props = (typeof nameOrProps === 'string' ? maybeProps : nameOrProps) as NComponentProps | undefined;
		const { componentId, instanceKey } = generateIDs(props, inferredName);
		const ctx: nContext = { name: inferredName, id: componentId, key: instanceKey };
		this.id = componentId;
		this.nContext = ctx;
		this.props = props;
		this.__props = props;
		this.parent = componentRegistry.getRenderParent() ? componentRegistry.get(componentRegistry.getRenderParent())?.result : null;
		this.children = [];
		this.getShell = createGetShellFunctionServer();
		register(this, ctx);
	}

	__html(): string {
		this.__ensureMapped();
		if (!isServer) {
			ensureClientLoadStarted(this);
			return injectAttributes('<div></div>', this.id, this.__props?.class);
		}
		return '';
	}
}

function invokeHostHandler(handler: Function, args: unknown): unknown {
	if (args == null) return handler();
	if (Array.isArray(args)) return handler(...args);
	return handler(args);
}

function invokeHostHandlerWithParent(handler: Function, parent: unknown, args: unknown): unknown {
	if (args == null) return handler.call(parent);
	if (Array.isArray(args)) return handler.call(parent, ...args);
	return handler.call(parent, args);
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
	if (wasAdded) {
		const parentAfter = parentId ? (componentRegistry.has(parentId) ? componentRegistry.get(parentId) : undefined) : undefined;
		if (parentAfter?.result) {
			const parentInstance = parentAfter.result;
			parentInstance.children = parentInstance.children ?? [];
			parentInstance.children.push(instance);
		}
	}
}
