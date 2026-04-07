// Custom JSX runtime that passes parent context to components

//import type {} from './core/jsx.namespace.generated.js';

// Must run before importing any generated component modules.
import './jsx-globals.js';
import { nojsxGlobals } from './core/global/registry.js';
import { componentRegistry } from './core/global/registry.js';
import type { __nojsxSlotCaptureToken, nojsxComponent } from './core/types/index.js';
import { bootstrapClientRuntime } from './core/util/client-bootstrap.js';
import { renderSlotChildren, join as _join } from './core/util/util.js';
import { NComponent } from './core/components/components.js';

// Make join function globally available
(globalThis as any).join = _join;

/**
 * Runtime fragment symbol used by transpiled JSX fragment syntax.
 *
 * @remarks
 * This value is read from `globalThis` and initialized during runtime bootstrapping.
 */
export const Fragment: symbol = (globalThis as any).Fragment;

function ensureNojsxGlobalsInitialized(): void {
	// Core render context
	g.__currentComponentId = g.__currentComponentId ?? null;

	// Inline event handlers (onclick, oninput, onchange, etc.)
	// All handlers share one Map keyed by "componentId:handlerId".
	g.__nojsxInlineHandlerNextId = g.__nojsxInlineHandlerNextId ?? 1;
	g.__nojsxInlineHandlers = g.__nojsxInlineHandlers ?? new Map<string, Function>();
	g.__nojsxInlineHandlersByComponent = g.__nojsxInlineHandlersByComponent ?? new Map<string, Set<string>>();

	// Slot capture globals
	g.__nojsxSlotCaptureWired = g.__nojsxSlotCaptureWired ?? false;
	g.__nojsxSlotCaptureNextId = g.__nojsxSlotCaptureNextId ?? 1;
	g.__nojsxSlotCaptureStack = g.__nojsxSlotCaptureStack ?? [];
	g.__nojsxSlotCaptureData = g.__nojsxSlotCaptureData ?? new Map<number, Record<string, string>>();
	g.__nojsxDebugSlots = g.__nojsxDebugSlots ?? false;

	// Wire proxy implementations (see jsx-globals.ts)
	(g as any).__nojsx_jsx_impl = jsx;
	(g as any).__nojsx_jsxs_impl = jsxs;
	(g as any).__nojsx_jsxDEV_impl = jsxDEV;

	// Also expose direct globals for callers that read after init.
	g.Fragment = g.Fragment ?? Fragment;
	g.jsx = g.jsx ?? jsx;
	g.jsxs = g.jsxs ?? jsxs;
	g.jsxDEV = g.jsxDEV ?? jsxDEV;
	(g as any).livePreviewJSX = (g as any).livePreviewJSX ?? livePreviewJSX;
	(g as any).getLivePreviewHtml = (g as any).getLivePreviewHtml ?? getLivePreviewHtml;
	(g as any).isLivePreviewMode = (g as any).isLivePreviewMode ?? isLivePreviewMode;
	// Some emitters/tools use _jsxDEV as a global.
	g._jsxDEV = g._jsxDEV ?? g.jsxDEV;
	g.NComponent = g.NComponent ?? NComponent;
}

// Ensure runtime globals exist before any helper runs.
ensureNojsxGlobalsInitialized();
bootstrapClientRuntime();


export function clearInlineHandlersForComponent(componentId: string): void {
	const byComponent = g.__nojsxInlineHandlersByComponent;
	const handlers = g.__nojsxInlineHandlers;
	if (!byComponent || !handlers) return;
	const keys = byComponent.get(componentId);
	if (!keys) return;
	for (const k of keys) {
		handlers.delete(k);
	}
	byComponent.delete(componentId);
}

/**
 * Registers an inline event handler function during JSX rendering.
 * The function is stored in a client-side Map and a unique handler id is returned.
 * This id is emitted as a data attribute so delegated event listeners can look it up.
 */
function registerInlineHandler(componentId: string, fn: Function): string {
	g.__nojsxInlineHandlerNextId = g.__nojsxInlineHandlerNextId ?? 1;
	g.__nojsxInlineHandlers = g.__nojsxInlineHandlers ?? new Map<string, Function>();
	g.__nojsxInlineHandlersByComponent = g.__nojsxInlineHandlersByComponent ?? new Map<string, Set<string>>();
	const handlerId = `__i${g.__nojsxInlineHandlerNextId++}`;
	const key = `${componentId}:${handlerId}`;
	g.__nojsxInlineHandlers.set(key, fn);
	let set = g.__nojsxInlineHandlersByComponent.get(componentId);
	if (!set) {
		set = new Set<string>();
		g.__nojsxInlineHandlersByComponent.set(componentId, set);
	}
	set.add(key);
	return handlerId;
}

/**
 * Looks up an inline handler previously registered during render.
 *
 * @param componentId - Component render context id.
 * @param handlerId - Generated handler id (for example `__i1`).
 * @returns Registered function when present, otherwise `undefined`.
 */
export function getInlineHandler(componentId: string, handlerId: string): Function | undefined {
	const map = g.__nojsxInlineHandlers;
	if (!map) return undefined;
	return map.get(`${componentId}:${handlerId}`);
}

/** @deprecated Use getInlineHandler instead. Kept for backwards compatibility. */
export function getInlineOnclick(componentId: string, actionName: string): Function | undefined {
	return getInlineHandler(componentId, actionName);
}

/** @deprecated Use getInlineHandler instead. Kept for backwards compatibility. */
export function getInlineEventHandler(componentId: string, handlerId: string): Function | undefined {
	return getInlineHandler(componentId, handlerId);
}

/**
 * Sets the active component render context.
 *
 * @param id - Component id to activate, or `null` to clear context.
 * @returns Previous active component id, or `null` when none existed.
 *
 * @remarks
 * Side effects:
 * - Updates global `__currentComponentId` used by handler and child-component wiring.
 * - Ensures slot-capture getter wiring is installed.
 * - Clears stale inline handlers for the new component id.
 */
export function setRenderContext(id: string | null): string | null {
	const prev = g.__currentComponentId ?? null;
	g.__currentComponentId = id;
	ensureNojsxSlotCaptureWiring();
	return prev;
}

/**
 * Reads the active component render context id.
 *
 * @returns Current component id or `null`.
 */
export function getCurrentRenderContext(): string | null {
	return g.__currentComponentId ?? null;
}


function slotDebug(...args: any[]): void {
	void args;
}

function discardSlotCaptureTokenById(id: number): boolean {
	const stack = g.__nojsxSlotCaptureStack;
	if (!stack || stack.length === 0) return false;
	for (let i = stack.length - 1; i >= 0; i--) {
		const t = stack[i];
		if (t.id !== id) continue;
		stack.splice(i, 1);
		g.__nojsxSlotCaptureData?.delete(id);
		return true;
	}
	return false;
}

function ensureNojsxSlotCaptureWiring(): void {
	if (g.__nojsxSlotCaptureWired) return;

	g.__nojsxSlotCaptureNextId = g.__nojsxSlotCaptureNextId ?? 1;
	g.__nojsxSlotCaptureStack = g.__nojsxSlotCaptureStack ?? [];
	g.__nojsxSlotCaptureData = g.__nojsxSlotCaptureData ?? new Map<number, Record<string, string>>();

	const n = g.n;
	if (!n || typeof n !== 'object') {
		// `globalThis.n` may not be initialized yet (intrinsics-generated module loads later).
		// Don't mark as wired; we'll retry on the next render.
		slotDebug('wiring skipped: globalThis.n not ready');
		return;
	}

	for (const key of Object.keys(n)) {
		const desc = Object.getOwnPropertyDescriptor(n, key);
		if (desc?.get) continue;
		const value = (n as any)[key];
		if (!value || typeof value !== 'object') continue;

		Object.defineProperty(n, key, {
			enumerable: true,
			configurable: true,
			get() {
				const parentId: string | null = g.__currentComponentId ?? null;
				// Capture even without an active render context; parentId may be null.
				// This keeps slot passing working for plain function components that don't set __currentComponentId.

				const rootName: string = (value as any).__nojsxIntrinsicName ?? (value as any).__nojsxRootName ?? (value as any).__nojsxRootName ?? `n${key}`;

				g.__nojsxSlotCaptureNextId = g.__nojsxSlotCaptureNextId ?? 1;
				g.__nojsxSlotCaptureStack = g.__nojsxSlotCaptureStack ?? [];
				g.__nojsxSlotCaptureData = g.__nojsxSlotCaptureData ?? new Map<number, Record<string, string>>();
				const tokenId = g.__nojsxSlotCaptureNextId++;
				let rolledBack = false;
				const proxy = new Proxy(value as any, {
					get(target, prop, receiver) {
						const propValue = Reflect.get(target, prop, receiver);
						// If this access is only to reach a slot placeholder (e.g. `n.layoutsplitter.items`),
						// discard the token created by the base `n.layoutsplitter` access.
						if (!rolledBack && propValue && typeof propValue === 'object' && (propValue as any).__nojsxRootName === rootName) {
							rolledBack = true;
							if (discardSlotCaptureTokenById(tokenId)) {
								slotDebug('discard token (slot access)', { rootName, parentId, id: tokenId, key, prop: String(prop) });
							}
						}
						return propValue;
					},
				});
				const token: __nojsxSlotCaptureToken = { id: tokenId, rootName, component: proxy as any, parentId };
				g.__nojsxSlotCaptureStack.push(token);
				g.__nojsxSlotCaptureData.set(token.id, {});
				slotDebug('create token', { rootName, parentId, id: token.id, key });
				return proxy as any;
			},
		});
	}

	g.__nojsxSlotCaptureWired = true;
	slotDebug('wiring installed', { roots: Object.keys(n) });
}

function getNojsxSlotKeyFromComponent(component: any): string {
	const nameOf = (node: any): string | undefined =>
		node?.__nojsxSlotTemplateName ??
		(typeof node?.template === 'string' ? node.template : node?.template?.name) ??
		(typeof node?.name === 'string' ? node.name : undefined);

	// Prefer generator-stamped template names, but fall back to string `template` (slot placeholder).
	const ownName: string | undefined = nameOf(component);
	if (!component?.__nojsxParent) return ownName ?? 'Slot';

	const parts: string[] = [];
	let cur: any = component;
	while (cur && cur.__nojsxParent) {
		const name: string | undefined = nameOf(cur);
		if (name) parts.push(name);
		// Stop before including the root template name.
		if (!cur.__nojsxParent?.__nojsxParent) break;
		cur = cur.__nojsxParent;
	}
	parts.reverse();
	return parts.join('.') || (ownName ?? 'Slot');
}

function peekSlotCaptureTokenFor(rootName: string, parentId: string | null): __nojsxSlotCaptureToken | undefined {
	const stack = g.__nojsxSlotCaptureStack;
	if (!stack || stack.length === 0) return undefined;
	for (let i = stack.length - 1; i >= 0; i--) {
		const t = stack[i];
		if (t.parentId === parentId && t.rootName === rootName) return t;
	}
	return undefined;
}

function consumeSlotCaptureTokenFor(component: unknown, parentId: string | null): { rootName: string; slots: Record<string, string> } | undefined {
	const stack = g.__nojsxSlotCaptureStack;
	if (!stack || stack.length === 0) return undefined;

	for (let i = stack.length - 1; i >= 0; i--) {
		const t = stack[i];
		if (t.parentId !== parentId) continue;
		if (t.component !== component) continue;
		stack.splice(i, 1);
		const slots = g.__nojsxSlotCaptureData?.get(t.id) ?? {};
		g.__nojsxSlotCaptureData?.delete(t.id);
		return { rootName: t.rootName, slots };
	}
	return undefined;
}

function deriveScopedSlots(tokenSlots: Record<string, string>, scopePrefix: string): Record<string, string> | undefined {
	if (!scopePrefix) return undefined;
	const prefix = scopePrefix + '.';
	let out: Record<string, string> | undefined;
	for (const [k, v] of Object.entries(tokenSlots)) {
		if (!k.startsWith(prefix)) continue;
		(out ??= {})[k.slice(prefix.length)] = v;
	}
	return out;
}

// Track the current component being rendered
// Per-parent render counters to disambiguate repeated sibling components.
// Reset for a parent whenever we enter its wrapped html render.

function escapeHtml(str: unknown): string {
	if (typeof str !== 'string') return String(str);
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderChildren(children: unknown): string {
	if (children == null || children === false) return '';
	if (Array.isArray(children)) return children.map(renderChildren).join('');
	if (typeof children === 'object') return String(children);
	return String(children);
}

function isNojsxComponentConstructor(fn: Function): boolean {
	// Heuristic: NComponent subclasses have a prototype `__html()` method (defined on base class).
	const proto: any = (fn as any)?.prototype;
	return !!proto && typeof proto.__html === 'function';
}


function getIntrinsicContextInfo(): { isInside: boolean; isParent: boolean; isSlot: boolean; contextName: string | null } {
	const contextName = g.__nojsxInsideIntrinsic;

	if (!contextName) {
		return { isInside: false, isParent: false, isSlot: false, contextName: null };
	}

	const component = (g as any)[contextName];
	const isParent = component && typeof component === 'object' && Array.isArray(component.slots);
	const isSlot = component && !isParent; // It's something registered but not a parent with slots

	return { isInside: true, isParent, isSlot, contextName };
}

// Prevent collisions between semantic HTML tags and intrinsic component names.
// Example: COMPONENTS['header'] exists for <n.header>, but native <header>
// inside that component must stay a plain HTML tag (not re-dispatched to Header()).
const NATIVE_HTML_TAGS = new Set<string>([
	'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
	'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
	'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
	'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
	'em', 'embed',
	'fieldset', 'figcaption', 'figure', 'footer', 'form',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
	'i', 'iframe', 'img', 'input', 'ins',
	'kbd',
	'label', 'legend', 'li', 'link',
	'main', 'map', 'mark', 'menu', 'meta', 'meter',
	'nav', 'noscript',
	'object', 'ol', 'optgroup', 'option', 'output',
	'p', 'param', 'picture', 'pre', 'progress',
	'q',
	'rp', 'rt', 'ruby',
	's', 'samp', 'script', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
	'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
	'u', 'ul',
	'var', 'video',
	'wbr',
]);

/**
 * Main JSX runtime entry point used by transpiled `jsx(...)` calls.
 *
 * @param tag - HTML tag name, component constructor/function, fragment symbol, or nojsx slot object.
 * @param props - JSX props, including optional children.
 * @param jsxKey - Optional JSX key propagated to props.
 * @returns Rendered HTML string.
 *
 * @remarks
 * Behavior overview:
 * - Class components are instantiated and rendered via `__html()`.
 * - Function components are invoked directly.
 * - Intrinsic renderers can auto-map top-level native tags (for example `<button>` to `n_button`).
 * - Slot capture/injection wires nested slot content into intrinsic templates.
 *
 * Side effects include global render-context reads/writes, inline handler registration,
 * and slot-capture token management.
 *
 * @example
 * const html = jsx('div', { class: 'card', children: 'Hello' });
 *
 * @example
 * // Equivalent to compiled `<MyComponent title="Hi" />`
 * const html = jsx(MyComponent, { title: 'Hi' });
 */
export function jsx(tag: string | Function | symbol, props?: JSX.HtmlTag, jsxKey?: any): string {
	// JSX evaluates tag expressions (like `n.topbar`) before calling jsx().
	// Ensure the `n.*` getter wiring is installed as soon as possible,
	// and keep retrying until `globalThis.n` exists.
	ensureNojsxSlotCaptureWiring();

	const context = getIntrinsicContextInfo();
	if (jsxKey !== undefined) {
		props = props ? { ...props, key: jsxKey } : { key: jsxKey };
	}

	if (tag === Fragment) {
		const result = renderChildren(props?.children);
		return result;
	}

	if (typeof tag === 'function') {
		const parentId = (globalThis as unknown as nojsxGlobals).__currentComponentId ?? null;
		const nextProps = props ? { ...props, __parentId: parentId } : { __parentId: parentId };

		// Class-based NComponent
		if (isNojsxComponentConstructor(tag)) {
			const preserveActive = componentRegistry.isPreserveChildrenActive();
			const parentRenderParent = componentRegistry.getRenderParent();
			const componentName = String((tag as any)?.name ?? 'Component');
			const explicitKey = (nextProps as any)?.key ?? (nextProps as any)?.__key;
			const reusedId = preserveActive && parentRenderParent
				? componentRegistry.consumePreservedDirectChild(parentRenderParent, componentName, explicitKey)
				: null;

			if (reusedId && componentRegistry.has(reusedId)) {
				const existing = componentRegistry.get(reusedId).result as any;
				if (parentRenderParent && componentRegistry.has(parentRenderParent)) {
					const parentEntry = componentRegistry.get(parentRenderParent);
					parentEntry.childIds.push(reusedId);
					const parentInstance = parentEntry.result as any;
					parentInstance.children = parentInstance.children ?? [];
					if (!parentInstance.children.some((child: any) => child?.id === reusedId)) {
						parentInstance.children.push(existing);
					}
				}
				const cls = (nextProps as any)?.class;
				return injectAttributes('<div></div>', reusedId, cls);
			}

			const instance = new (tag as any)(nextProps);
			const result = String(instance.__html());
			return result;
		}

		// Function component
		const result = (tag as any)(nextProps);
		const stringResult = String(result);
		return stringResult;
	}

	// Handle nojsxComponent slot objects
	if (typeof tag === 'object' && tag !== null) {
		// Supports:
		// - nojsxComponent: { template: fn, slots?: [...] }
		// - slot placeholder: { template: string } (may still have `slots` for structure/typing)
		let templateFunction: Function | undefined;
		const isSlotPlaceholder = typeof (tag as any)?.template === 'string';
		if (isSlotPlaceholder) {
			templateFunction = (p: any) => renderSlotChildren(p?.children);
		} else {
			const nojsxComponent = tag as nojsxComponent;
			templateFunction = typeof (nojsxComponent as any).template === 'function' ? (nojsxComponent as any).template : undefined;
			// Keep verbose object logging behind the debug flag.
			slotDebug('render component slot', {
				name:
					(tag as any)?.__nojsxSlotTemplateName ??
					(typeof (tag as any)?.template === 'string' ? (tag as any).template : (tag as any)?.template?.name) ??
					(tag as any)?.name,
			});
		}

		if (typeof templateFunction !== 'function') {
			throw new Error(`[jsx] Slot template is not a function: ${String(templateFunction)}`); // ${contextStr}${stackStr}
		}
		const parentId = (globalThis as unknown as nojsxGlobals).__currentComponentId;
		const parentIdNormalized = parentId ?? null;
		const skipSlotCapture = !!(tag as any)?.__nojsxNoSlotCapture;
		if (skipSlotCapture) {
			const nextProps = props ? { ...props, __parentId: parentIdNormalized } : { __parentId: parentIdNormalized };
			const result = String(templateFunction(nextProps));
			return result;
		}

		// Slot capture: slot nodes render before their parent root due to JS evaluation order.
		// We capture slot children into a token created when `n.<root>` was evaluated.
		const rootName: string | undefined = (tag as any).__nojsxRootName ?? (tag as any).__nojsxParentIntrinsicName;
		const isRoot = Array.isArray((tag as any).slots) && !!(tag as any).__nojsxIntrinsicName;
		if (!isRoot && rootName) {
			const token = peekSlotCaptureTokenFor(rootName, parentIdNormalized);
			if (token) {
				const slotKey = getNojsxSlotKeyFromComponent(tag as any);
				let slotHtml = '';
				slotHtml = renderChildren(props?.children);
				const map = g.__nojsxSlotCaptureData?.get(token.id);
				if (map) {
					map[slotKey] = slotHtml;
					slotDebug('capture', { rootName, parentId: parentIdNormalized, tokenId: token.id, slotKey, len: slotHtml.length });
				}
			} else {
				slotDebug('capture-miss (no token)', {
					rootName,
					parentId: parentIdNormalized,
					slot:
						(tag as any).__nojsxSlotTemplateName ??
						(typeof (tag as any)?.template === 'string' ? (tag as any).template : (tag as any)?.template?.name) ??
						(tag as any)?.name,
				});
			}
		}

		// Root injection: when the root finally renders, consume its token and pass __slots.
		let injectedSlots: Record<string, string> | undefined;
		let injectedRootName: string | undefined;
		let tokenSlotsForScope: Record<string, string> | undefined;
		if (isRoot) {
			const consumed = consumeSlotCaptureTokenFor(tag, parentIdNormalized);
			if (consumed) {
				injectedSlots = consumed.slots;
				tokenSlotsForScope = consumed.slots;
				injectedRootName = consumed.rootName;
				slotDebug('consume', { rootName: consumed.rootName, parentId: parentIdNormalized, keys: Object.keys(consumed.slots) });
			} else {
				slotDebug('consume-miss (no token)', { rootName: (tag as any).__nojsxIntrinsicName ?? (tag as any).__nojsxRootName, parentId: parentIdNormalized });
			}
		} else if (rootName) {
			// Nested slot templates (e.g. SidebarHeaderTemplate) should also receive __slots,
			// scoped to their own subtree.
			const token = peekSlotCaptureTokenFor(rootName, parentIdNormalized);
			if (token) {
				tokenSlotsForScope = g.__nojsxSlotCaptureData?.get(token.id);
			}
		}

		const parentIntrinsicName: string | undefined = injectedRootName ?? (tag as any).__nojsxParentIntrinsicName;
		const prevInside = g.__nojsxInsideIntrinsic;
		if (parentIntrinsicName) {
			g.__nojsxInsideIntrinsic = parentIntrinsicName;
		}
		const nextProps = props ? { ...props, __parentId: parentIdNormalized } : { __parentId: parentIdNormalized };

		// Inject slots:
		// - Root gets the full map (keys like TopBarMenu, SidebarHeader, SidebarFooter, SidebarGroup...)
		// - Nested templates get a scoped map with their prefix stripped (e.g. SidebarHeaderLeft/Right)
		if (injectedSlots) {
			(nextProps as any).__slots = injectedSlots;
		} else if (tokenSlotsForScope) {
			const scopePrefix = getNojsxSlotKeyFromComponent(tag as any);
			const scoped = deriveScopedSlots(tokenSlotsForScope, scopePrefix);
			if (scoped) {
				(nextProps as any).__slots = scoped;
				slotDebug('inject-scoped', { rootName, scopePrefix, keys: Object.keys(scoped) });
			}
		}
		const result = String(templateFunction(nextProps));
		g.__nojsxInsideIntrinsic = prevInside;
		return result;
	}

	// HTML element
	const tagName = tag as string;
	const { children, __parentId, key: _keyProp, __key, __nojsxAuto, ...attrs } = props || {};
	const hasDataAction = Object.prototype.hasOwnProperty.call(attrs, 'data-action') || Object.prototype.hasOwnProperty.call(attrs, 'dataAction');
	const hasDataCid = Object.prototype.hasOwnProperty.call(attrs, 'data-cid') || Object.prototype.hasOwnProperty.call(attrs, 'dataCid');
	let html = '<' + tagName;

	let needsDataCid = false;
	for (const [attrKey, value] of Object.entries(attrs)) {
		if (value == null || value === false) continue;
		if (typeof value === 'function') {
			const cid = getCurrentRenderContext();
			if (cid && attrKey.startsWith('on') && attrKey.length > 2) {
				const handlerId = registerInlineHandler(cid, value);
				if (attrKey === 'onclick' && !hasDataAction && !hasDataCid) {
					// onclick uses data-action/data-cid for backwards compatibility
					html += ` data-action="${handlerId}" data-cid="${escapeHtml(cid)}"`;
				} else {
					// All other events: oninput, onchange, onkeydown, etc.
					const eventName = attrKey.slice(2).toLowerCase();
					html += ` data-on-${eventName}="${handlerId}"`;
					needsDataCid = true;
				}
			}
			// Never serialize functions into HTML attributes.
			continue;
		}
		if (value === true) {
			html += ' ' + attrKey;
		} else {
			const attrName = attrKey.startsWith('data') ? attrKey.replace(/([A-Z])/g, '-$1').toLowerCase() : attrKey;
			html += ' ' + attrName + '="' + escapeHtml(String(value)) + '"';
		}
	}

	// Ensure data-cid is present when non-click event handlers were registered
	if (needsDataCid && !hasDataCid && !hasDataAction) {
		const cid = getCurrentRenderContext();
		if (cid) {
			html += ` data-cid="${escapeHtml(cid)}"`;
		}
	}

	const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
	if (voidElements.includes(tagName)) {
		const result = html + ' />';
		return result;
	}

	html += '>';
	html += renderChildren(children);
	html += '</' + tagName + '>';
	return html;
}

export type livePreviewJsxOptions = {
	mount?: string | Element;
};

type PreviewProcessLike = {
	env?: Record<string, string | undefined>;
};

declare const process: PreviewProcessLike | undefined;

export function isLivePreviewMode(): boolean {
	const processEnv = typeof process === 'undefined' ? undefined : process.env;
	return !!g.live_preview || !!g.__livePreviewMode || processEnv?.LIVE_PREVIEW === 'true';
}

export async function getLivePreviewHtml(): Promise<string> {
	const html = g.__livePreviewHtml ?? g.__livePreview?.precomputedHtml;
	if (typeof html !== 'string' || !html.trim()) {
		throw new Error('[nojsx] live preview HTML was not precomputed by the runner');
	}

	g.__livePreviewHtml = html;
	return html;
}

function resolveLivePreviewMount(mount?: string | Element): Element | null {
	if (typeof document === 'undefined') return null;
	if (!mount) return document.getElementById('app');
	if (typeof mount === 'string') return document.querySelector(mount);
	return mount;
}

/**
 * Mounts a root JSX/component tag into a browser element for live preview.
 *
 * @param tag - Root tag (typically an outer `NComponent` class like `HelloWorld`).
 * @param props - Optional props passed to the root.
 * @param options - Mount target options.
 * @returns Initial rendered HTML string.
 */
export function livePreviewJSX(tag: string | Function | symbol, props?: JSX.HtmlTag, options: livePreviewJsxOptions = {}): string {
	if (isLivePreviewMode()) {
		const previewHtml = g.__livePreviewHtml ?? g.__livePreview?.precomputedHtml;
		if (typeof previewHtml === 'string' && previewHtml.trim()) {
			g.__livePreviewHtml = previewHtml;
			return previewHtml;
		}
	}

	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return jsx(tag, props);
	}

	bootstrapClientRuntime();
	const mountEl = resolveLivePreviewMount(options.mount);
	if (!mountEl) {
		throw new Error('[nojsx] livePreviewJSX: mount target not found. Expected #app or provided selector/element.');
	}

	if (typeof tag === 'function' && isNojsxComponentConstructor(tag)) {
		const instance = new (tag as any)(props ?? {});
		const initialHtml = String(instance.__html());
		mountEl.innerHTML = initialHtml;
		if (typeof (instance as any).render === 'function') {
			(instance as any).render();
		}
		return initialHtml;
	}

	const html = jsx(tag, props);
	mountEl.innerHTML = html;
	return html;
}

/**
 * Multi-children JSX runtime entry point.
 *
 * @param tag - Same tag contract as {@link jsx}.
 * @param props - Props payload.
 * @param key - Optional key.
 * @returns Rendered HTML string.
 *
 * @remarks
 * This is a thin alias to {@link jsx} and shares identical runtime behavior.
 *
 * @example
 * const html = jsxs('ul', { children: [jsx('li', { children: 'A' }), jsx('li', { children: 'B' })] });
 */
export function jsxs(tag: string | Function | symbol, props?: any, key?: any): string {
	return jsx(tag, props, key);
}

// Match the common JSX dev runtime signature; we ignore the extra args.
/**
 * Development JSX runtime entry point.
 *
 * @param tag - Same tag contract as {@link jsx}.
 * @param props - Props payload.
 * @param key - Optional key.
 * @param _isStaticChildren - Dev-runtime compatibility parameter (unused).
 * @param _source - Optional source metadata used to annotate intrinsic DOM output.
 * @param _self - Dev-runtime compatibility parameter (unused).
 * @returns Rendered HTML string.
 *
 * @remarks
 * For string tags, `_source` is serialized into `data-nojsx-source` before delegating to {@link jsx}.
 * This helps hydration/debug tooling correlate output with source locations.
 *
 * @example
 * const html = jsxDEV('button', { children: 'Save' }, undefined, false, { fileName: 'App.tsx', lineNumber: 12, columnNumber: 5 });
 */
export function jsxDEV(tag: string | Function | symbol, props?: any, key?: any, _isStaticChildren?: any, _source?: any, _self?: any): string {
	// Dev-only source mapping: stamp file/line/col into DOM elements.
	// We intentionally only add this for intrinsic tags (string tag) to avoid polluting
	// component props / affecting component logic.
	if (typeof tag === 'string' && _source != null) {
		let sourceText: string | undefined;
		if (typeof _source === 'string') {
			sourceText = _source;
		} else if (typeof _source === 'object') {
			const s: any = _source as any;
			const file = s?.fileName ?? s?.filename;
			const line = s?.lineNumber ?? s?.line;
			const col = s?.columnNumber ?? s?.column;
			if (file != null && line != null) {
				sourceText = `${String(file)}:${String(line)}:${String(col ?? 0)}`;
			} else {
				try {
					sourceText = JSON.stringify(s);
				} catch {
					sourceText = String(s);
				}
			}
		} else {
			sourceText = String(_source);
		}

		if (sourceText) {
			props = props ? { ...props, datanojsxSource: sourceText } : { datanojsxSource: sourceText };
		}
	}

	return jsx(tag, props, key);
}

// Ensure the `n.*` getters are wired before any JSX evaluates `n.topbar`/`n.sidebar`.
// (JS evaluates the tag expression before calling jsx/jsxs.)
ensureNojsxSlotCaptureWiring();

/**
 * Injects component identity/class attributes into root HTML.
 *
 * @param html - Rendered HTML fragment (expected to contain a root element).
 * @param id - Component id to assign as `data-component-id` and `data-cid` substitutions.
 * @param className - Optional class name to append/insert on the root element.
 * @returns HTML with injected attributes when a root tag is present.
 *
 * @remarks
 * Side effects are limited to string transformation; this function does not touch DOM state.
 */
export function injectAttributes(html: string, id: string, className?: string): string {
	// First, replace any data-cid attributes with the actual component ID
	html = html.replace(/data-cid="\{nContext\.id\}"/g, `data-cid="${id}"`);
	html = html.replace(/data-cid=\{[^}]+\}/g, `data-cid="${id}"`);

	const firstTagEnd = html.indexOf('>');
	if (firstTagEnd === -1) return html;

	const isSelfClosing = html[firstTagEnd - 1] === '/';
	const insertPos = isSelfClosing ? firstTagEnd - 1 : firstTagEnd;

	let attrs = ` data-component-id="${id}"`;

	if (className) {
		const classMatch = html.slice(0, insertPos).match(/\sclass="([^"]*)"/);
		if (classMatch) {
			const existingClass = classMatch[1];
			const newClass = `${existingClass} ${className}`;
			const before = html.slice(0, classMatch.index! + 1);
			const after = html.slice(classMatch.index! + classMatch[0].length);
			return before + `class="${newClass}"` + attrs + after;
		} else {
			attrs += ` class="${className}"`;
		}
	}

	return html.slice(0, insertPos) + attrs + html.slice(insertPos);
}

