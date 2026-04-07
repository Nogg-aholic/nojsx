import { nContext } from '../global/registry.js';
/**
 * Indicates whether the current runtime is non-browser.
 *
 * @remarks
 * `true` when `window` is unavailable, `false` in browser execution.
 */
export declare const isServer: boolean;
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
export declare function wrapHtmlWithRenderContext(fn: () => string): (componentId: string, className?: string) => string;
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
/**
 * Base class for stateful nojsx components.
 *
 * @remarks
 * Instances are registered in the component registry and run in a client-only runtime.
 * - `render` patches DOM on the client.
 * - Initial client construction returns placeholder HTML and starts async load.
 */
export declare abstract class NComponent {
    abstract html: (() => JSX.Element) | ((componentId: string, className?: string) => JSX.Element);
    [key: string]: any;
    id: string;
    nContext: nContext;
    parent: NComponent | null;
    children: NComponent[];
    getShell: () => import("../types/index.js").ShellBridgeExtended;
    onLoad?: (args?: any) => any;
    onUnload?: (args?: any) => any;
    render: () => void;
    updateHtml: (selector: string, html: string) => void;
    private __props?;
    private __didLoad;
    private __runOnLoadOnce;
    private __renderHtml;
    constructor(name: string, props?: NComponentProps);
    __html(): string;
}
