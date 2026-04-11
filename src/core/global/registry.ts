// Component Registry

import { NComponent } from '../components/components.js';
import {
    requestUpstreamHostOpenApiDocument,
    requestUpstreamHostOpenApiScalarHtml,
} from '../transport/server/upstream-host-openapi.js';


export const nojsxComponentLoaders: Record<string, (props?: any) => NComponent> = {};
export const functionToMethodName: WeakMap<Function, { componentId: string; methodName: string }> = new WeakMap();

export type nojsxGlobals = {
    __nojsxComponentLoaders?: Record<string, (props?: any) => NComponent>;
	__currentComponentId?: string | null;
    __functionToMethodName?: WeakMap<Function, { componentId: string; methodName: string }>;
    __nojsxHostRpcProxyCache?: Map<string, unknown>;
    vscode?: unknown;
    getDocs?: ((symbolOrReference: { __nojsxRpcName?: string }) => Promise<unknown>) & { __nojsxRpcName?: string };
    getDocsHtml?: ((symbolOrReference: { __nojsxRpcName?: string }) => Promise<string>) & { __nojsxRpcName?: string };
    __nojsxRpcPending?: Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>;
    __nojsxRpcNextId?: number;
    __nojsxServerComponentMeta?: Map<string, { parentId: string | null; componentName: string; componentKey?: string }>;
};

function createHostRpcProxy(pathParts: string[] = []): unknown {
    const globals = globalThis as unknown as nojsxGlobals;
    globals.__nojsxHostRpcProxyCache = globals.__nojsxHostRpcProxyCache ?? new Map<string, unknown>();
    const cacheKey = pathParts.join('.');
    if (globals.__nojsxHostRpcProxyCache.has(cacheKey)) {
        return globals.__nojsxHostRpcProxyCache.get(cacheKey);
    }

    const proxy = new Proxy(function () {}, {
        get(_target, property) {
            if (property === '__nojsxRpcName') {
                return cacheKey;
            }
            if (property === 'then' && cacheKey.length === 0) {
                return undefined;
            }
            if (typeof property === 'symbol') {
                return undefined;
            }
            return createHostRpcProxy([...pathParts, String(property)]);
        },
        apply() {
            throw new Error(`Host RPC reference ${cacheKey || '<root>'} cannot be invoked directly. Use callHostAsync().`);
        },
    });

    globals.__nojsxHostRpcProxyCache.set(cacheKey, proxy);
    return proxy;
}

function createGlobalRpcShim<TArgs extends unknown[], TResult>(methodName: string): ((...args: TArgs) => Promise<TResult>) & { __nojsxRpcName?: string } {
    const shim = (async (...args: TArgs): Promise<TResult> => {
        if (typeof window === 'undefined') {
            if (methodName === 'getDocs') {
                return requestUpstreamHostOpenApiDocument(args[0] as { __nojsxRpcName?: string }) as Promise<TResult>;
            }
            if (methodName === 'getDocsHtml') {
                return requestUpstreamHostOpenApiScalarHtml(args[0] as { __nojsxRpcName?: string }) as Promise<TResult>;
            }
            throw new Error(`Unknown global RPC shim: ${methodName}`);
        }
        throw new Error(`${methodName} cannot be invoked directly on the client. Use this.callOnServerAsync().`);
    }) as ((...args: TArgs) => Promise<TResult>) & { __nojsxRpcName?: string };
    shim.__nojsxRpcName = methodName;
    return shim;
}

// Intrinsic renderers are registered by external packages (e.g. UI components).
// This package no longer hard-depends on a local components folder.
if (typeof globalThis !== 'undefined') {
	(globalThis as unknown as nojsxGlobals).__nojsxComponentLoaders = nojsxComponentLoaders;
    (globalThis as unknown as nojsxGlobals).__functionToMethodName = functionToMethodName;
    (globalThis as unknown as nojsxGlobals).__nojsxHostRpcProxyCache = (globalThis as unknown as nojsxGlobals).__nojsxHostRpcProxyCache ?? new Map();
    (globalThis as unknown as nojsxGlobals).vscode = (globalThis as unknown as nojsxGlobals).vscode ?? createHostRpcProxy(['vscode']);
    (globalThis as unknown as nojsxGlobals).getDocs = (globalThis as unknown as nojsxGlobals).getDocs ?? createGlobalRpcShim('getDocs');
    (globalThis as unknown as nojsxGlobals).getDocsHtml = (globalThis as unknown as nojsxGlobals).getDocsHtml ?? createGlobalRpcShim('getDocsHtml');
    (globalThis as unknown as nojsxGlobals).__nojsxRpcPending = (globalThis as unknown as nojsxGlobals).__nojsxRpcPending ?? new Map();
    (globalThis as unknown as nojsxGlobals).__nojsxRpcNextId = (globalThis as unknown as nojsxGlobals).__nojsxRpcNextId ?? 1;
    (globalThis as unknown as nojsxGlobals).__nojsxServerComponentMeta = (globalThis as unknown as nojsxGlobals).__nojsxServerComponentMeta ?? new Map();
    
}

// Base context interface
export interface nContext {
	id: string;
	key: string;
    name: string;
}

// Component Registry Entry
export interface nojsxContext {
    result: NComponent;
	nContext: nContext;
	parentId: string | null;
	childIds: string[];
}

function matchesPreserveDebugFilter(componentId: string): boolean {
    if (!componentId) return false;
    if (componentId === 'ShellPage.WindowManager#1.ExplorerWindow') return true;
    return false;
}

export function shouldLogPreserveForAny(componentIds: Array<string | null | undefined>): boolean {
    for (const componentId of componentIds) {
        if (!componentId) continue;
        if (matchesPreserveDebugFilter(componentId)) return true;
    }
    return false;
}



export class nojsxRegistry {
    private registry = new Map<string, nojsxContext>();
    private renderParent = "";
    private preserveChildrenStack: Array<{ all: Set<string>; direct: string[] }> = [];
    private invokeOnUnload(id: string): void {
        const entry = this.registry.get(id);
        const instance = entry?.result as any;
        if (!instance || typeof instance.onUnload !== 'function') return;
        try {
            const out = instance.onUnload.call(instance);
            if (out && typeof out.then === 'function') {
                (out as Promise<unknown>).catch((e) => {
                    console.warn(`[nojsx:onUnload] async onUnload failed for ${id}`, e);
                });
            }
        } catch (e) {
            console.warn(`[nojsx:onUnload] onUnload failed for ${id}`, e);
        }
    }

    private deleteEntry(id: string): void {
        this.invokeOnUnload(id);
        this.registry.delete(id);
    }

    private consumePreservedSubtree(top: { all: Set<string>; direct: string[] }, rootId: string): void {
        if (!rootId) return;
        top.all.delete(rootId);
        const subtreePrefix = `${rootId}.`;
        for (const id of Array.from(top.all)) {
            if (id.startsWith(subtreePrefix)) {
                top.all.delete(id);
            }
        }
    }
    private deleteChildrenRecursive(id: string): void {
        // Prefer `parentId` relationships since `childIds` can be stale.
        const childIds: string[] = [];
        for (const [childId, entry] of this.registry.entries()) {
            if (entry.parentId === id) childIds.push(childId);
        }

        for (const childId of childIds) {
            this.deleteChildrenRecursive(childId);
            this.deleteEntry(childId);
        }
    }

    setRenderParent(id: string): void {
        this.renderParent = id;
    }

    getRenderParent(): string {
        return this.renderParent;
    }

    beginPreserveChildren(ids: string[], directChildIds: string[] = []): void {
        this.preserveChildrenStack.push({ all: new Set(ids), direct: [...directChildIds] });
    }

    endPreserveChildren(): void {
        const top = this.preserveChildrenStack[this.preserveChildrenStack.length - 1];
        if (top) {
            for (const staleId of top.all) {
                this.deleteEntry(staleId);
            }
        }
        this.preserveChildrenStack.pop();
    }

    consumePreservedChildId(id: string): boolean {
        const top = this.preserveChildrenStack[this.preserveChildrenStack.length - 1];
        if (!top) return false;
        if (!top.all.has(id)) return false;
        this.consumePreservedSubtree(top, id);
        const directIdx = top.direct.indexOf(id);
        if (directIdx !== -1) top.direct.splice(directIdx, 1);
        return true;
    }

    consumePreservedDirectChild(parentId: string, componentName: string, explicitKey?: string | number): string | null {
        const top = this.preserveChildrenStack[this.preserveChildrenStack.length - 1];
        if (!top) return null;

        const base = `${parentId}.${componentName}`;
        if (explicitKey !== undefined && explicitKey !== null && explicitKey !== '') {
            const keyed = `${base}:${String(explicitKey)}`;
            const keyedIdx = top.direct.indexOf(keyed);
            if (keyedIdx !== -1) {
                top.direct.splice(keyedIdx, 1);
                this.consumePreservedSubtree(top, keyed);
                return keyed;
            }
        }

        const directPattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?::[^.]+|#[^.]+)?$`);
        const matchIdx = top.direct.findIndex((id) => directPattern.test(id));
        if (matchIdx === -1) {
            return null;
        }

        const id = top.direct[matchIdx];
        top.direct.splice(matchIdx, 1);
        this.consumePreservedSubtree(top, id);
        return id;
    }

    isPreserveChildrenActive(): boolean {
        return this.preserveChildrenStack.length > 0;
    }


    get(id: string): nojsxContext {
        if (!this.registry.has(id) || this.registry.get(id) === undefined) {
            if(id !== "ShellPage")
            throw new Error(`ComponentRegistry: No entry found for ID ${id}`);
        }
        return this.registry.get(id)!;
    }

    set(id: string, entry: nojsxContext): boolean {
        if (!this.has(id)) {
           // console.error(`[ComponentRegistry] Registering new component: ${id}`);
            this.registry.set(id, entry);
            if(this.has(this.getRenderParent()))
                this.get(this.getRenderParent())?.childIds.push(id);
            return true;
        } else {
            // On re-render/re-registration, remove the old subtree so stale children don't accumulate.
            console.error(`[ComponentRegistry] Re-registering existing component: ${id}, deleting children`);
            this.prepareChildRender(id, entry);
            return false;
        }
    }

    public prepareChildRender(id: string, entry: nojsxContext) {
        const preserveActive = this.preserveChildrenStack.length > 0;
        if (!preserveActive) {
            this.deleteChildrenRecursive(id);
        }

        // Preserve the existing per-component instance object across renders.
        // The component factory returns a new "result" object each render, but we want
        // a stable identity per componentId across client re-renders.
        const existingEntry = this.registry.get(id)!;
        const preservedInstance = existingEntry.result;
        const nextResult = entry.result;

        // Merge the newly produced result into the preserved instance.
        // Keep core instance keys stable (env-specific methods, parent/children pointers, etc).
        if (preservedInstance && nextResult && preservedInstance !== nextResult) {
            const reservedInstanceKeys = new Set([
                // identity
                'id',
                // core capabilities (env-specific)
                'render',
                'updateHtml',
                'getShell',
                // graph pointers
                'parent',
                'children',
            ]);

            const preservedRecord = preservedInstance as unknown as Record<string, unknown>;
            const nextRecord = nextResult as unknown as Record<string, unknown>;
            for (const key of Object.keys(nextRecord)) {
                if (reservedInstanceKeys.has(key)) continue;
                preservedRecord[key] = nextRecord[key];
            }

			// Refresh non-enumerable/private construction state needed by rerendered children.
			preservedRecord.parent = nextRecord.parent;
			preservedRecord.__props = nextRecord.__props;
			preservedRecord.nContext = nextRecord.nContext;
        }

        // Update the registry entry metadata in-place.
        existingEntry.nContext = entry.nContext;
        existingEntry.parentId = entry.parentId;
        existingEntry.childIds = [];
        (existingEntry.result).children = [];

        // Ensure the entry still points at the preserved instance.
        if (preservedInstance) {
            existingEntry.result = preservedInstance;
        }
    }

    has(id: string): boolean {
        return this.registry.has(id);
    }

    delete(id: string): boolean {
        if (!this.registry.has(id)) return false;
        this.deleteEntry(id);
        return true;
    }

    clear(): void {
        const ids = Array.from(this.registry.keys());
        for (const id of ids) {
            this.deleteEntry(id);
        }
        this.renderParent = '';
    }

    keys(): IterableIterator<string> {
        return this.registry.keys();
    }

    values(): IterableIterator<nojsxContext> {
        return this.registry.values();
    }

    entries(): IterableIterator<[string, nojsxContext]> {
        return this.registry.entries();
    }

    get size(): number {
        return this.registry.size;
    }

    [Symbol.iterator](): IterableIterator<[string, nojsxContext]> {
        return this.registry.entries();
    }

    forEach(callback: (entry: nojsxContext, id: string) => void): void {
        this.registry.forEach((entry, id) => callback(entry, id));
    }
}


// Component registry for current render
export const componentRegistry = new nojsxRegistry();


export function clearComponents(): void {
	componentRegistry.clear();
}

