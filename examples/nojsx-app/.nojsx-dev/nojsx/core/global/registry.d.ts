import { NComponent } from '../components/components.js';
export declare const nojsxComponentLoaders: Record<string, (props?: any) => NComponent>;
export declare const staticRpcHandlers: Map<string, Function>;
export type nojsxGlobals = {
    __nojsxComponentLoaders?: Record<string, (props?: any) => NComponent>;
    __currentComponentId?: string | null;
    __nojsxStaticRpc?: Map<string, Function>;
};
export interface nContext {
    id: string;
    key: string;
    name: string;
}
export interface nojsxContext {
    result: NComponent;
    nContext: nContext;
    parentId: string | null;
    childIds: string[];
}
export declare function shouldLogPreserveForAny(componentIds: Array<string | null | undefined>): boolean;
export declare class nojsxRegistry {
    private registry;
    private renderParent;
    private preserveChildrenStack;
    private invokeOnUnload;
    private deleteEntry;
    private consumePreservedSubtree;
    private deleteChildrenRecursive;
    setRenderParent(id: string): void;
    getRenderParent(): string;
    beginPreserveChildren(ids: string[], directChildIds?: string[]): void;
    endPreserveChildren(): void;
    consumePreservedChildId(id: string): boolean;
    consumePreservedDirectChild(parentId: string, componentName: string, explicitKey?: string | number): string | null;
    isPreserveChildrenActive(): boolean;
    get(id: string): nojsxContext;
    set(id: string, entry: nojsxContext): boolean;
    prepareChildRender(id: string, entry: nojsxContext): void;
    has(id: string): boolean;
    delete(id: string): boolean;
    clear(): void;
    keys(): IterableIterator<string>;
    values(): IterableIterator<nojsxContext>;
    entries(): IterableIterator<[string, nojsxContext]>;
    get size(): number;
    [Symbol.iterator](): IterableIterator<[string, nojsxContext]>;
    forEach(callback: (entry: nojsxContext, id: string) => void): void;
}
export declare const componentRegistry: nojsxRegistry;
export declare function clearComponents(): void;
