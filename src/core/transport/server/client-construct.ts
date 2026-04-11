import { componentRegistry, type nojsxGlobals } from '../../global/registry.js';

export async function constructClientComponentOnServer(args: {
  componentId: string;
  parentId: string | null;
  componentName: string;
  componentKey?: string;
}): Promise<void> {
  const { componentId, parentId, componentName, componentKey } = args;

  if (componentRegistry.has(componentId)) return;

  const loaders = (globalThis as unknown as nojsxGlobals).__nojsxComponentLoaders;
  const construct = loaders?.[componentName];
  if (!construct) {
    throw new Error(`[Server] ClientConstruct: component not found: ${componentName}`);
  }

  const props: Record<string, unknown> = { __parentId: parentId || null, __id: componentId };
  if (componentKey && componentKey.length > 0) {
    props.key = componentKey;
  }

  const prevRenderParent = componentRegistry.getRenderParent();
  if (parentId) {
    componentRegistry.setRenderParent(parentId);
  }

  construct(props);
  componentRegistry.setRenderParent(prevRenderParent ?? '');

  const entry = componentRegistry.get(componentId);
  if (!entry) {
    throw new Error(`[Server] ClientConstruct failed for ${componentId}`);
  }

  for (const [_id, childEntry] of componentRegistry) {
    if (childEntry.parentId !== componentId) continue;
    const parentInstance = entry.result as any;
    const childInstance = childEntry.result as any;
    if (!parentInstance || !childInstance) continue;
    childInstance.parent = parentInstance;
    parentInstance.children = parentInstance.children ?? [];
    if (!parentInstance.children.includes(childInstance)) {
      parentInstance.children.push(childInstance);
    }
  }
}
