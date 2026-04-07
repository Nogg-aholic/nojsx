import './jsx-globals.js';
/**
 * Runtime fragment symbol used by transpiled JSX fragment syntax.
 *
 * @remarks
 * This value is read from `globalThis` and initialized during runtime bootstrapping.
 */
export declare const Fragment: symbol;
export declare function clearInlineHandlersForComponent(componentId: string): void;
/**
 * Looks up an inline handler previously registered during render.
 *
 * @param componentId - Component render context id.
 * @param handlerId - Generated handler id (for example `__i1`).
 * @returns Registered function when present, otherwise `undefined`.
 */
export declare function getInlineHandler(componentId: string, handlerId: string): Function | undefined;
/** @deprecated Use getInlineHandler instead. Kept for backwards compatibility. */
export declare function getInlineOnclick(componentId: string, actionName: string): Function | undefined;
/** @deprecated Use getInlineHandler instead. Kept for backwards compatibility. */
export declare function getInlineEventHandler(componentId: string, handlerId: string): Function | undefined;
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
export declare function setRenderContext(id: string | null): string | null;
/**
 * Reads the active component render context id.
 *
 * @returns Current component id or `null`.
 */
export declare function getCurrentRenderContext(): string | null;
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
export declare function jsx(tag: string | Function | symbol, props?: JSX.HtmlTag, jsxKey?: any): string;
export type livePreviewJsxOptions = {
    mount?: string | Element;
};
export declare function isLivePreviewMode(): boolean;
export declare function getLivePreviewHtml(): Promise<string>;
/**
 * Mounts a root JSX/component tag into a browser element for live preview.
 *
 * @param tag - Root tag (typically an outer `NComponent` class like `HelloWorld`).
 * @param props - Optional props passed to the root.
 * @param options - Mount target options.
 * @returns Initial rendered HTML string.
 */
export declare function livePreviewJSX(tag: string | Function | symbol, props?: JSX.HtmlTag, options?: livePreviewJsxOptions): string;
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
export declare function jsxs(tag: string | Function | symbol, props?: any, key?: any): string;
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
export declare function jsxDEV(tag: string | Function | symbol, props?: any, key?: any, _isStaticChildren?: any, _source?: any, _self?: any): string;
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
export declare function injectAttributes(html: string, id: string, className?: string): string;
