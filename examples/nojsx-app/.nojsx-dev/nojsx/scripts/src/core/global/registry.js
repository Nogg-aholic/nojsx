// Component Registry
export const nojsxComponentLoaders = {};
export const staticRpcHandlers = new Map();
// Intrinsic renderers are registered by external packages (e.g. UI components).
// This package no longer hard-depends on a local components folder.
if (typeof globalThis !== 'undefined') {
    globalThis.__nojsxComponentLoaders = nojsxComponentLoaders;
    globalThis.__nojsxStaticRpc = globalThis.__nojsxStaticRpc ?? staticRpcHandlers;
}
function matchesPreserveDebugFilter(componentId) {
    if (!componentId)
        return false;
    if (componentId === 'ShellPage.WindowManager#1.ExplorerWindow')
        return true;
    return false;
}
export function shouldLogPreserveForAny(componentIds) {
    for (const componentId of componentIds) {
        if (!componentId)
            continue;
        if (matchesPreserveDebugFilter(componentId))
            return true;
    }
    return false;
}
export class nojsxRegistry {
    registry = new Map();
    renderParent = "";
    preserveChildrenStack = [];
    invokeOnUnload(id) {
        const entry = this.registry.get(id);
        const instance = entry?.result;
        if (!instance || typeof instance.onUnload !== 'function')
            return;
        try {
            const out = instance.onUnload.call(instance);
            if (out && typeof out.then === 'function') {
                out.catch((e) => {
                    console.warn(`[nojsx:onUnload] async onUnload failed for ${id}`, e);
                });
            }
        }
        catch (e) {
            console.warn(`[nojsx:onUnload] onUnload failed for ${id}`, e);
        }
    }
    deleteEntry(id) {
        this.invokeOnUnload(id);
        this.registry.delete(id);
    }
    consumePreservedSubtree(top, rootId) {
        if (!rootId)
            return;
        top.all.delete(rootId);
        const subtreePrefix = `${rootId}.`;
        for (const id of Array.from(top.all)) {
            if (id.startsWith(subtreePrefix)) {
                top.all.delete(id);
            }
        }
    }
    deleteChildrenRecursive(id) {
        // Prefer `parentId` relationships since `childIds` can be stale.
        const childIds = [];
        for (const [childId, entry] of this.registry.entries()) {
            if (entry.parentId === id)
                childIds.push(childId);
        }
        for (const childId of childIds) {
            this.deleteChildrenRecursive(childId);
            this.deleteEntry(childId);
        }
    }
    setRenderParent(id) {
        this.renderParent = id;
    }
    getRenderParent() {
        return this.renderParent;
    }
    beginPreserveChildren(ids, directChildIds = []) {
        this.preserveChildrenStack.push({ all: new Set(ids), direct: [...directChildIds] });
    }
    endPreserveChildren() {
        const top = this.preserveChildrenStack[this.preserveChildrenStack.length - 1];
        if (top) {
            for (const staleId of top.all) {
                this.deleteEntry(staleId);
            }
        }
        this.preserveChildrenStack.pop();
    }
    consumePreservedChildId(id) {
        const top = this.preserveChildrenStack[this.preserveChildrenStack.length - 1];
        if (!top)
            return false;
        if (!top.all.has(id))
            return false;
        this.consumePreservedSubtree(top, id);
        const directIdx = top.direct.indexOf(id);
        if (directIdx !== -1)
            top.direct.splice(directIdx, 1);
        return true;
    }
    consumePreservedDirectChild(parentId, componentName, explicitKey) {
        const top = this.preserveChildrenStack[this.preserveChildrenStack.length - 1];
        if (!top)
            return null;
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
    isPreserveChildrenActive() {
        return this.preserveChildrenStack.length > 0;
    }
    get(id) {
        if (!this.registry.has(id) || this.registry.get(id) === undefined) {
            if (id !== "ShellPage")
                throw new Error(`ComponentRegistry: No entry found for ID ${id}`);
        }
        return this.registry.get(id);
    }
    set(id, entry) {
        if (!this.has(id)) {
            // console.error(`[ComponentRegistry] Registering new component: ${id}`);
            this.registry.set(id, entry);
            if (this.has(this.getRenderParent()))
                this.get(this.getRenderParent())?.childIds.push(id);
            return true;
        }
        else {
            // On re-render/re-registration, remove the old subtree so stale children don't accumulate.
            console.error(`[ComponentRegistry] Re-registering existing component: ${id}, deleting children`);
            this.prepareChildRender(id, entry);
            return false;
        }
    }
    prepareChildRender(id, entry) {
        const preserveActive = this.preserveChildrenStack.length > 0;
        if (!preserveActive) {
            this.deleteChildrenRecursive(id);
        }
        // Preserve the existing per-component instance object across renders.
        // The component factory returns a new "result" object each render, but we want
        // a stable identity per componentId across client re-renders.
        const existingEntry = this.registry.get(id);
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
            const preservedRecord = preservedInstance;
            const nextRecord = nextResult;
            for (const key of Object.keys(nextRecord)) {
                if (reservedInstanceKeys.has(key))
                    continue;
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
        existingEntry.result.children = [];
        // Ensure the entry still points at the preserved instance.
        if (preservedInstance) {
            existingEntry.result = preservedInstance;
        }
    }
    has(id) {
        return this.registry.has(id);
    }
    delete(id) {
        if (!this.registry.has(id))
            return false;
        this.deleteEntry(id);
        return true;
    }
    clear() {
        const ids = Array.from(this.registry.keys());
        for (const id of ids) {
            this.deleteEntry(id);
        }
        this.renderParent = '';
    }
    keys() {
        return this.registry.keys();
    }
    values() {
        return this.registry.values();
    }
    entries() {
        return this.registry.entries();
    }
    get size() {
        return this.registry.size;
    }
    [Symbol.iterator]() {
        return this.registry.entries();
    }
    forEach(callback) {
        this.registry.forEach((entry, id) => callback(entry, id));
    }
}
// Component registry for current render
export const componentRegistry = new nojsxRegistry();
export function clearComponents() {
    componentRegistry.clear();
}
//# sourceMappingURL=registry.js.map