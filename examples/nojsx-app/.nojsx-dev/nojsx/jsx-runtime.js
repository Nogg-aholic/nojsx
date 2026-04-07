// Custom JSX runtime that passes parent context to components
//import type {} from './core/jsx.namespace.generated.js';
// Must run before importing any generated component modules.
import './jsx-globals.js';
import { componentRegistry } from './core/global/registry.js';
import { bootstrapClientRuntime } from './core/util/client-bootstrap.js';
import { renderSlotChildren, join as _join } from './core/util/util.js';
import { NComponent } from './core/components/components.js';
// Make join function globally available
globalThis.join = _join;
/**
 * Runtime fragment symbol used by transpiled JSX fragment syntax.
 *
 * @remarks
 * This value is read from `globalThis` and initialized during runtime bootstrapping.
 */
export const Fragment = globalThis.Fragment;
function ensureNojsxGlobalsInitialized() {
    // Core render context
    g.__currentComponentId = g.__currentComponentId ?? null;
    // Inline event handlers (onclick, oninput, onchange, etc.)
    // All handlers share one Map keyed by "componentId:handlerId".
    g.__nojsxInlineHandlerNextId = g.__nojsxInlineHandlerNextId ?? 1;
    g.__nojsxInlineHandlers = g.__nojsxInlineHandlers ?? new Map();
    g.__nojsxInlineHandlersByComponent = g.__nojsxInlineHandlersByComponent ?? new Map();
    // Slot capture globals
    g.__nojsxSlotCaptureWired = g.__nojsxSlotCaptureWired ?? false;
    g.__nojsxSlotCaptureNextId = g.__nojsxSlotCaptureNextId ?? 1;
    g.__nojsxSlotCaptureStack = g.__nojsxSlotCaptureStack ?? [];
    g.__nojsxSlotCaptureData = g.__nojsxSlotCaptureData ?? new Map();
    g.__nojsxDebugSlots = g.__nojsxDebugSlots ?? false;
    // Wire proxy implementations (see jsx-globals.ts)
    g.__nojsx_jsx_impl = jsx;
    g.__nojsx_jsxs_impl = jsxs;
    g.__nojsx_jsxDEV_impl = jsxDEV;
    // Also expose direct globals for callers that read after init.
    g.Fragment = g.Fragment ?? Fragment;
    g.jsx = g.jsx ?? jsx;
    g.jsxs = g.jsxs ?? jsxs;
    g.jsxDEV = g.jsxDEV ?? jsxDEV;
    g.livePreviewJSX = g.livePreviewJSX ?? livePreviewJSX;
    g.getLivePreviewHtml = g.getLivePreviewHtml ?? getLivePreviewHtml;
    g.isLivePreviewMode = g.isLivePreviewMode ?? isLivePreviewMode;
    // Some emitters/tools use _jsxDEV as a global.
    g._jsxDEV = g._jsxDEV ?? g.jsxDEV;
    g.NComponent = g.NComponent ?? NComponent;
}
// Ensure runtime globals exist before any helper runs.
ensureNojsxGlobalsInitialized();
bootstrapClientRuntime();
export function clearInlineHandlersForComponent(componentId) {
    const byComponent = g.__nojsxInlineHandlersByComponent;
    const handlers = g.__nojsxInlineHandlers;
    if (!byComponent || !handlers)
        return;
    const keys = byComponent.get(componentId);
    if (!keys)
        return;
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
function registerInlineHandler(componentId, fn) {
    g.__nojsxInlineHandlerNextId = g.__nojsxInlineHandlerNextId ?? 1;
    g.__nojsxInlineHandlers = g.__nojsxInlineHandlers ?? new Map();
    g.__nojsxInlineHandlersByComponent = g.__nojsxInlineHandlersByComponent ?? new Map();
    const handlerId = `__i${g.__nojsxInlineHandlerNextId++}`;
    const key = `${componentId}:${handlerId}`;
    g.__nojsxInlineHandlers.set(key, fn);
    let set = g.__nojsxInlineHandlersByComponent.get(componentId);
    if (!set) {
        set = new Set();
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
export function getInlineHandler(componentId, handlerId) {
    const map = g.__nojsxInlineHandlers;
    if (!map)
        return undefined;
    return map.get(`${componentId}:${handlerId}`);
}
/** @deprecated Use getInlineHandler instead. Kept for backwards compatibility. */
export function getInlineOnclick(componentId, actionName) {
    return getInlineHandler(componentId, actionName);
}
/** @deprecated Use getInlineHandler instead. Kept for backwards compatibility. */
export function getInlineEventHandler(componentId, handlerId) {
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
export function setRenderContext(id) {
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
export function getCurrentRenderContext() {
    return g.__currentComponentId ?? null;
}
function slotDebug(...args) {
    void args;
}
function discardSlotCaptureTokenById(id) {
    const stack = g.__nojsxSlotCaptureStack;
    if (!stack || stack.length === 0)
        return false;
    for (let i = stack.length - 1; i >= 0; i--) {
        const t = stack[i];
        if (t.id !== id)
            continue;
        stack.splice(i, 1);
        g.__nojsxSlotCaptureData?.delete(id);
        return true;
    }
    return false;
}
function ensureNojsxSlotCaptureWiring() {
    if (g.__nojsxSlotCaptureWired)
        return;
    g.__nojsxSlotCaptureNextId = g.__nojsxSlotCaptureNextId ?? 1;
    g.__nojsxSlotCaptureStack = g.__nojsxSlotCaptureStack ?? [];
    g.__nojsxSlotCaptureData = g.__nojsxSlotCaptureData ?? new Map();
    const n = g.n;
    if (!n || typeof n !== 'object') {
        // `globalThis.n` may not be initialized yet (intrinsics-generated module loads later).
        // Don't mark as wired; we'll retry on the next render.
        slotDebug('wiring skipped: globalThis.n not ready');
        return;
    }
    for (const key of Object.keys(n)) {
        const desc = Object.getOwnPropertyDescriptor(n, key);
        if (desc?.get)
            continue;
        const value = n[key];
        if (!value || typeof value !== 'object')
            continue;
        Object.defineProperty(n, key, {
            enumerable: true,
            configurable: true,
            get() {
                const parentId = g.__currentComponentId ?? null;
                // Capture even without an active render context; parentId may be null.
                // This keeps slot passing working for plain function components that don't set __currentComponentId.
                const rootName = value.__nojsxIntrinsicName ?? value.__nojsxRootName ?? value.__nojsxRootName ?? `n${key}`;
                g.__nojsxSlotCaptureNextId = g.__nojsxSlotCaptureNextId ?? 1;
                g.__nojsxSlotCaptureStack = g.__nojsxSlotCaptureStack ?? [];
                g.__nojsxSlotCaptureData = g.__nojsxSlotCaptureData ?? new Map();
                const tokenId = g.__nojsxSlotCaptureNextId++;
                let rolledBack = false;
                const proxy = new Proxy(value, {
                    get(target, prop, receiver) {
                        const propValue = Reflect.get(target, prop, receiver);
                        // If this access is only to reach a slot placeholder (e.g. `n.layoutsplitter.items`),
                        // discard the token created by the base `n.layoutsplitter` access.
                        if (!rolledBack && propValue && typeof propValue === 'object' && propValue.__nojsxRootName === rootName) {
                            rolledBack = true;
                            if (discardSlotCaptureTokenById(tokenId)) {
                                slotDebug('discard token (slot access)', { rootName, parentId, id: tokenId, key, prop: String(prop) });
                            }
                        }
                        return propValue;
                    },
                });
                const token = { id: tokenId, rootName, component: proxy, parentId };
                g.__nojsxSlotCaptureStack.push(token);
                g.__nojsxSlotCaptureData.set(token.id, {});
                slotDebug('create token', { rootName, parentId, id: token.id, key });
                return proxy;
            },
        });
    }
    g.__nojsxSlotCaptureWired = true;
    slotDebug('wiring installed', { roots: Object.keys(n) });
}
function getNojsxSlotKeyFromComponent(component) {
    const nameOf = (node) => node?.__nojsxSlotTemplateName ??
        (typeof node?.template === 'string' ? node.template : node?.template?.name) ??
        (typeof node?.name === 'string' ? node.name : undefined);
    // Prefer generator-stamped template names, but fall back to string `template` (slot placeholder).
    const ownName = nameOf(component);
    if (!component?.__nojsxParent)
        return ownName ?? 'Slot';
    const parts = [];
    let cur = component;
    while (cur && cur.__nojsxParent) {
        const name = nameOf(cur);
        if (name)
            parts.push(name);
        // Stop before including the root template name.
        if (!cur.__nojsxParent?.__nojsxParent)
            break;
        cur = cur.__nojsxParent;
    }
    parts.reverse();
    return parts.join('.') || (ownName ?? 'Slot');
}
function peekSlotCaptureTokenFor(rootName, parentId) {
    const stack = g.__nojsxSlotCaptureStack;
    if (!stack || stack.length === 0)
        return undefined;
    for (let i = stack.length - 1; i >= 0; i--) {
        const t = stack[i];
        if (t.parentId === parentId && t.rootName === rootName)
            return t;
    }
    return undefined;
}
function consumeSlotCaptureTokenFor(component, parentId) {
    const stack = g.__nojsxSlotCaptureStack;
    if (!stack || stack.length === 0)
        return undefined;
    for (let i = stack.length - 1; i >= 0; i--) {
        const t = stack[i];
        if (t.parentId !== parentId)
            continue;
        if (t.component !== component)
            continue;
        stack.splice(i, 1);
        const slots = g.__nojsxSlotCaptureData?.get(t.id) ?? {};
        g.__nojsxSlotCaptureData?.delete(t.id);
        return { rootName: t.rootName, slots };
    }
    return undefined;
}
function deriveScopedSlots(tokenSlots, scopePrefix) {
    if (!scopePrefix)
        return undefined;
    const prefix = scopePrefix + '.';
    let out;
    for (const [k, v] of Object.entries(tokenSlots)) {
        if (!k.startsWith(prefix))
            continue;
        (out ??= {})[k.slice(prefix.length)] = v;
    }
    return out;
}
// Track the current component being rendered
// Per-parent render counters to disambiguate repeated sibling components.
// Reset for a parent whenever we enter its wrapped html render.
function escapeHtml(str) {
    if (typeof str !== 'string')
        return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function renderChildren(children) {
    if (children == null || children === false)
        return '';
    if (Array.isArray(children))
        return children.map(renderChildren).join('');
    if (typeof children === 'object')
        return String(children);
    return String(children);
}
function isNojsxComponentConstructor(fn) {
    // Heuristic: NComponent subclasses have a prototype `__html()` method (defined on base class).
    const proto = fn?.prototype;
    return !!proto && typeof proto.__html === 'function';
}
function getIntrinsicContextInfo() {
    const contextName = g.__nojsxInsideIntrinsic;
    if (!contextName) {
        return { isInside: false, isParent: false, isSlot: false, contextName: null };
    }
    const component = g[contextName];
    const isParent = component && typeof component === 'object' && Array.isArray(component.slots);
    const isSlot = component && !isParent; // It's something registered but not a parent with slots
    return { isInside: true, isParent, isSlot, contextName };
}
// Prevent collisions between semantic HTML tags and intrinsic component names.
// Example: COMPONENTS['header'] exists for <n.header>, but native <header>
// inside that component must stay a plain HTML tag (not re-dispatched to Header()).
const NATIVE_HTML_TAGS = new Set([
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
export function jsx(tag, props, jsxKey) {
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
        const parentId = globalThis.__currentComponentId ?? null;
        const nextProps = props ? { ...props, __parentId: parentId } : { __parentId: parentId };
        // Class-based NComponent
        if (isNojsxComponentConstructor(tag)) {
            const preserveActive = componentRegistry.isPreserveChildrenActive();
            const parentRenderParent = componentRegistry.getRenderParent();
            const componentName = String(tag?.name ?? 'Component');
            const explicitKey = nextProps?.key ?? nextProps?.__key;
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
                const cls = nextProps?.class;
                return injectAttributes('<div></div>', reusedId, cls);
            }
            const instance = new tag(nextProps);
            const result = String(instance.__html());
            return result;
        }
        // Function component
        const result = tag(nextProps);
        const stringResult = String(result);
        return stringResult;
    }
    // Handle nojsxComponent slot objects
    if (typeof tag === 'object' && tag !== null) {
        // Supports:
        // - nojsxComponent: { template: fn, slots?: [...] }
        // - slot placeholder: { template: string } (may still have `slots` for structure/typing)
        let templateFunction;
        const isSlotPlaceholder = typeof tag?.template === 'string';
        if (isSlotPlaceholder) {
            templateFunction = (p) => renderSlotChildren(p?.children);
        }
        else {
            const nojsxComponent = tag;
            templateFunction = typeof nojsxComponent.template === 'function' ? nojsxComponent.template : undefined;
            // Keep verbose object logging behind the debug flag.
            slotDebug('render component slot', {
                name: tag?.__nojsxSlotTemplateName ??
                    (typeof tag?.template === 'string' ? tag.template : tag?.template?.name) ??
                    tag?.name,
            });
        }
        if (typeof templateFunction !== 'function') {
            throw new Error(`[jsx] Slot template is not a function: ${String(templateFunction)}`); // ${contextStr}${stackStr}
        }
        const parentId = globalThis.__currentComponentId;
        const parentIdNormalized = parentId ?? null;
        const skipSlotCapture = !!tag?.__nojsxNoSlotCapture;
        if (skipSlotCapture) {
            const nextProps = props ? { ...props, __parentId: parentIdNormalized } : { __parentId: parentIdNormalized };
            const result = String(templateFunction(nextProps));
            return result;
        }
        // Slot capture: slot nodes render before their parent root due to JS evaluation order.
        // We capture slot children into a token created when `n.<root>` was evaluated.
        const rootName = tag.__nojsxRootName ?? tag.__nojsxParentIntrinsicName;
        const isRoot = Array.isArray(tag.slots) && !!tag.__nojsxIntrinsicName;
        if (!isRoot && rootName) {
            const token = peekSlotCaptureTokenFor(rootName, parentIdNormalized);
            if (token) {
                const slotKey = getNojsxSlotKeyFromComponent(tag);
                let slotHtml = '';
                slotHtml = renderChildren(props?.children);
                const map = g.__nojsxSlotCaptureData?.get(token.id);
                if (map) {
                    map[slotKey] = slotHtml;
                    slotDebug('capture', { rootName, parentId: parentIdNormalized, tokenId: token.id, slotKey, len: slotHtml.length });
                }
            }
            else {
                slotDebug('capture-miss (no token)', {
                    rootName,
                    parentId: parentIdNormalized,
                    slot: tag.__nojsxSlotTemplateName ??
                        (typeof tag?.template === 'string' ? tag.template : tag?.template?.name) ??
                        tag?.name,
                });
            }
        }
        // Root injection: when the root finally renders, consume its token and pass __slots.
        let injectedSlots;
        let injectedRootName;
        let tokenSlotsForScope;
        if (isRoot) {
            const consumed = consumeSlotCaptureTokenFor(tag, parentIdNormalized);
            if (consumed) {
                injectedSlots = consumed.slots;
                tokenSlotsForScope = consumed.slots;
                injectedRootName = consumed.rootName;
                slotDebug('consume', { rootName: consumed.rootName, parentId: parentIdNormalized, keys: Object.keys(consumed.slots) });
            }
            else {
                slotDebug('consume-miss (no token)', { rootName: tag.__nojsxIntrinsicName ?? tag.__nojsxRootName, parentId: parentIdNormalized });
            }
        }
        else if (rootName) {
            // Nested slot templates (e.g. SidebarHeaderTemplate) should also receive __slots,
            // scoped to their own subtree.
            const token = peekSlotCaptureTokenFor(rootName, parentIdNormalized);
            if (token) {
                tokenSlotsForScope = g.__nojsxSlotCaptureData?.get(token.id);
            }
        }
        const parentIntrinsicName = injectedRootName ?? tag.__nojsxParentIntrinsicName;
        const prevInside = g.__nojsxInsideIntrinsic;
        if (parentIntrinsicName) {
            g.__nojsxInsideIntrinsic = parentIntrinsicName;
        }
        const nextProps = props ? { ...props, __parentId: parentIdNormalized } : { __parentId: parentIdNormalized };
        // Inject slots:
        // - Root gets the full map (keys like TopBarMenu, SidebarHeader, SidebarFooter, SidebarGroup...)
        // - Nested templates get a scoped map with their prefix stripped (e.g. SidebarHeaderLeft/Right)
        if (injectedSlots) {
            nextProps.__slots = injectedSlots;
        }
        else if (tokenSlotsForScope) {
            const scopePrefix = getNojsxSlotKeyFromComponent(tag);
            const scoped = deriveScopedSlots(tokenSlotsForScope, scopePrefix);
            if (scoped) {
                nextProps.__slots = scoped;
                slotDebug('inject-scoped', { rootName, scopePrefix, keys: Object.keys(scoped) });
            }
        }
        const result = String(templateFunction(nextProps));
        g.__nojsxInsideIntrinsic = prevInside;
        return result;
    }
    // HTML element
    const tagName = tag;
    const { children, __parentId, key: _keyProp, __key, __nojsxAuto, ...attrs } = props || {};
    const hasDataAction = Object.prototype.hasOwnProperty.call(attrs, 'data-action') || Object.prototype.hasOwnProperty.call(attrs, 'dataAction');
    const hasDataCid = Object.prototype.hasOwnProperty.call(attrs, 'data-cid') || Object.prototype.hasOwnProperty.call(attrs, 'dataCid');
    let html = '<' + tagName;
    let needsDataCid = false;
    for (const [attrKey, value] of Object.entries(attrs)) {
        if (value == null || value === false)
            continue;
        if (typeof value === 'function') {
            const cid = getCurrentRenderContext();
            if (cid && attrKey.startsWith('on') && attrKey.length > 2) {
                const handlerId = registerInlineHandler(cid, value);
                if (attrKey === 'onclick' && !hasDataAction && !hasDataCid) {
                    // onclick uses data-action/data-cid for backwards compatibility
                    html += ` data-action="${handlerId}" data-cid="${escapeHtml(cid)}"`;
                }
                else {
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
        }
        else {
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
export function isLivePreviewMode() {
    const processEnv = typeof process === 'undefined' ? undefined : process.env;
    return !!g.live_preview || !!g.__livePreviewMode || processEnv?.LIVE_PREVIEW === 'true';
}
export async function getLivePreviewHtml() {
    const html = g.__livePreviewHtml ?? g.__livePreview?.precomputedHtml;
    if (typeof html !== 'string' || !html.trim()) {
        throw new Error('[nojsx] live preview HTML was not precomputed by the runner');
    }
    g.__livePreviewHtml = html;
    return html;
}
function resolveLivePreviewMount(mount) {
    if (typeof document === 'undefined')
        return null;
    if (!mount)
        return document.getElementById('app');
    if (typeof mount === 'string')
        return document.querySelector(mount);
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
export function livePreviewJSX(tag, props, options = {}) {
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
        const instance = new tag(props ?? {});
        const initialHtml = String(instance.__html());
        mountEl.innerHTML = initialHtml;
        if (typeof instance.render === 'function') {
            instance.render();
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
export function jsxs(tag, props, key) {
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
export function jsxDEV(tag, props, key, _isStaticChildren, _source, _self) {
    // Dev-only source mapping: stamp file/line/col into DOM elements.
    // We intentionally only add this for intrinsic tags (string tag) to avoid polluting
    // component props / affecting component logic.
    if (typeof tag === 'string' && _source != null) {
        let sourceText;
        if (typeof _source === 'string') {
            sourceText = _source;
        }
        else if (typeof _source === 'object') {
            const s = _source;
            const file = s?.fileName ?? s?.filename;
            const line = s?.lineNumber ?? s?.line;
            const col = s?.columnNumber ?? s?.column;
            if (file != null && line != null) {
                sourceText = `${String(file)}:${String(line)}:${String(col ?? 0)}`;
            }
            else {
                try {
                    sourceText = JSON.stringify(s);
                }
                catch {
                    sourceText = String(s);
                }
            }
        }
        else {
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
export function injectAttributes(html, id, className) {
    // First, replace any data-cid attributes with the actual component ID
    html = html.replace(/data-cid="\{nContext\.id\}"/g, `data-cid="${id}"`);
    html = html.replace(/data-cid=\{[^}]+\}/g, `data-cid="${id}"`);
    const firstTagEnd = html.indexOf('>');
    if (firstTagEnd === -1)
        return html;
    const isSelfClosing = html[firstTagEnd - 1] === '/';
    const insertPos = isSelfClosing ? firstTagEnd - 1 : firstTagEnd;
    let attrs = ` data-component-id="${id}"`;
    if (className) {
        const classMatch = html.slice(0, insertPos).match(/\sclass="([^"]*)"/);
        if (classMatch) {
            const existingClass = classMatch[1];
            const newClass = `${existingClass} ${className}`;
            const before = html.slice(0, classMatch.index + 1);
            const after = html.slice(classMatch.index + classMatch[0].length);
            return before + `class="${newClass}"` + attrs + after;
        }
        else {
            attrs += ` class="${className}"`;
        }
    }
    return html.slice(0, insertPos) + attrs + html.slice(insertPos);
}
