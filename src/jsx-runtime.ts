// Custom JSX runtime that passes parent context to components

//import type {} from './core/jsx.namespace.generated.js';

// Must run before importing any generated component modules.
import './jsx-globals.js';
import { nojsxGlobals } from './core/components/registry.js';
import { componentRegistry } from './core/components/registry.js';
import type { nojsxComponent } from './core/types/index.js';
import { renderSlotChildren, join as _join } from './core/util/util.js';
import { NComponent, NComponentProps } from './core/components/components.js';

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

	// Wire proxy implementations (see jsx-globals.ts)
	(g as any).__nojsx_jsx_impl = jsx;
	(g as any).__nojsx_jsxs_impl = jsxs;
	(g as any).__nojsx_jsxDEV_impl = jsxDEV;

	// Also expose direct globals for callers that read after init.
	g.Fragment = g.Fragment ?? Fragment;
	g.jsx = g.jsx ?? jsx;
	g.jsxs = g.jsxs ?? jsxs;
	g.jsxDEV = g.jsxDEV ?? jsxDEV;
	(g as any).getInlineHandler = (g as any).getInlineHandler ?? getInlineHandler;
	(g as any).getInlineOnclick = (g as any).getInlineOnclick ?? getInlineOnclick;
	(g as any).getInlineEventHandler = (g as any).getInlineEventHandler ?? getInlineEventHandler;
	// Some emitters/tools use _jsxDEV as a global.
	g._jsxDEV = g._jsxDEV ?? g.jsxDEV;
	// Avoid touching the imported binding during module-cycle initialization.
	// Consumers that need the constructor should import it directly.
}

// Ensure runtime globals exist before any helper runs.
ensureNojsxGlobalsInitialized();


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
	if (typeof children === 'function') {
		if ((children as any).__nojsxDeferredComponentRender === true) {
			return String((children as any)());
		}
		return '';
	}
	if (typeof children === 'object') return String(children);
	return String(children);
}

function createDeferredNojsxComponentRender(tag: Function, nextProps: NComponentProps & { __parentId?: string | null }): () => string {
	const evaluate = () => {
		const preserveActive = componentRegistry.isPreserveChildrenActive();
		const parentRenderParent = componentRegistry.getRenderParent();
		const componentName = String((tag)?.name ?? 'Component');
		const explicitKey = (nextProps as NComponentProps)?.key ?? (nextProps as NComponentProps)?.__key;
		const reusedId = preserveActive && parentRenderParent
			? componentRegistry.consumePreservedDirectChild(parentRenderParent, componentName, explicitKey)
			: null;

		if (reusedId && componentRegistry.has(reusedId)) {
			const existing = componentRegistry.get(reusedId).result;
			if (parentRenderParent && componentRegistry.has(parentRenderParent)) {
				const parentEntry = componentRegistry.get(parentRenderParent);
				parentEntry.childIds.push(reusedId);
				const parentInstance = parentEntry.result;
				parentInstance.children = parentInstance.children ?? [];
				if (!parentInstance.children.some((child) => child?.id === reusedId)) {
					parentInstance.children.push(existing);
				}
			}
			const cls = (nextProps as any)?.class;
			return injectAttributes('<div></div>', reusedId, cls);
		}

		const instance = new (tag as any)(nextProps);
		return String(instance.__html());
	};

	(evaluate as any).__nojsxDeferredComponentRender = true;
	return evaluate;
}

function isNojsxComponentConstructor(fn: Function): boolean {
	// Heuristic: NComponent subclasses have a prototype `__html()` method (defined on base class).
	const proto: any = (fn as any)?.prototype;
	return !!proto && typeof proto.__html === 'function';
}

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
 * - String tags render to HTML with inline-handler data attributes when needed.
 *
 * @example
 * const html = jsx('div', { class: 'card', children: 'Hello' });
 *
 * @example
 * // Equivalent to compiled `<MyComponent title="Hi" />`
 * const html = jsx(MyComponent, { title: 'Hi' });
 */
export function jsx(tag: string | Function | symbol, props?: JSX.HtmlTag, jsxKey?: any): string {
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
			return createDeferredNojsxComponentRender(tag, nextProps) as unknown as string;
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
		const isSlotPlaceholder = typeof (tag as nojsxComponent)?.template === 'string';
		if (isSlotPlaceholder) {
			templateFunction = (p: any) => renderSlotChildren(p?.children);
		} else {
			const nojsxComponent = tag as nojsxComponent;
			templateFunction = typeof (nojsxComponent).template === 'function' ? (nojsxComponent).template : undefined;
		}

		if (typeof templateFunction !== 'function') {
			throw new Error(`[jsx] Slot template is not a function: ${String(templateFunction)}`);
		}
		const parentId = (globalThis as unknown as nojsxGlobals).__currentComponentId;
		const parentIdNormalized = parentId ?? null;
		const nextProps = props ? { ...props, __parentId: parentIdNormalized } : { __parentId: parentIdNormalized };
		const result = String(templateFunction(nextProps));
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
	const trimmed = html.trimStart();
	if (!trimmed.startsWith('<')) return `<div data-component-id="${id}"${className ? ` class="${className}"` : ''}>${html}</div>`;
	const secondTagStart = trimmed.indexOf('<', trimmed.indexOf('>') + 1);
	if (secondTagStart !== -1 && !trimmed.slice(secondTagStart).startsWith('</')) {
		return `<div data-component-id="${id}"${className ? ` class="${className}"` : ''}>${html}</div>`;
	}

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

