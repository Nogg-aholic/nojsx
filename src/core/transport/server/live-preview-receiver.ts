type LivePreviewServerMeta = {
  parentId: string | null;
  componentName: string;
  componentKey?: string;
};

export type LivePreviewServerRequest = {
  requestId: number;
  componentId: string;
  methodName: string;
  args: unknown;
  kind?: 'call' | 'get';
  meta?: LivePreviewServerMeta;
};

export type LivePreviewServerRuntime = {
  componentRegistry: {
    has(componentId: string): boolean;
    get(componentId: string): { result: any };
    getRenderParent(): string;
    setRenderParent(componentId: string): void;
  };
  nojsxComponentLoaders: Record<string, (props?: any) => any>;
  hostRoots?: Record<string, unknown>;
};

type LivePreviewServerSession = {
  runtime?: LivePreviewServerRuntime;
  componentMeta: Map<string, LivePreviewServerMeta>;
};

const livePreviewServerSessions = new Map<string, LivePreviewServerSession>();

export function getLivePreviewServerSession(serverSessionId: string): LivePreviewServerSession {
  let session = livePreviewServerSessions.get(serverSessionId);
  if (!session) {
    session = {
      componentMeta: new Map<string, LivePreviewServerMeta>(),
    };
    livePreviewServerSessions.set(serverSessionId, session);
  }
  return session;
}

export function parseComponentIdForConstruct(componentId: string): { parentId: string | null; componentName: string } {
  const lastDot = componentId.lastIndexOf('.');
  const parentId = lastDot === -1 ? null : componentId.slice(0, lastDot);
  let componentName = lastDot === -1 ? componentId : componentId.slice(lastDot + 1);
  const colon = componentName.indexOf(':');
  const hash = componentName.indexOf('#');
  let cut = -1;
  if (colon !== -1) cut = colon;
  if (hash !== -1) cut = cut === -1 ? hash : Math.min(cut, hash);
  if (cut !== -1) componentName = componentName.slice(0, cut);
  return { parentId, componentName };
}

export function constructServerComponent(session: LivePreviewServerSession, componentId: string, meta?: LivePreviewServerMeta): any {
  const runtime = session.runtime;
  if (!runtime) {
    throw new Error('Live preview server runtime is not initialized.');
  }

  const { componentRegistry, nojsxComponentLoaders } = runtime;
  if (componentRegistry.has(componentId)) {
    return componentRegistry.get(componentId).result;
  }

  const parsed = parseComponentIdForConstruct(componentId);
  const resolvedMeta: LivePreviewServerMeta = {
    parentId: meta?.parentId ?? parsed.parentId ?? null,
    componentName: meta?.componentName ?? parsed.componentName,
    componentKey: meta?.componentKey,
  };
  session.componentMeta.set(componentId, resolvedMeta);

  const construct = nojsxComponentLoaders?.[resolvedMeta.componentName];
  if (typeof construct !== 'function') {
    throw new Error(`Live preview loader not found for ${resolvedMeta.componentName}`);
  }

  const previousParent = componentRegistry.getRenderParent();
  try {
    componentRegistry.setRenderParent(resolvedMeta.parentId ?? '');
    return construct({ __id: componentId, __parentId: resolvedMeta.parentId, key: resolvedMeta.componentKey });
  } finally {
    componentRegistry.setRenderParent(previousParent ?? '');
  }
}

function ensureServerComponentChain(session: LivePreviewServerSession, componentId: string, meta?: LivePreviewServerMeta): any {
  const runtime = session.runtime;
  if (!runtime) {
    throw new Error('Live preview server runtime is not initialized.');
  }

  const { componentRegistry } = runtime;
  if (componentRegistry.has(componentId)) {
    return componentRegistry.get(componentId).result;
  }

  const parsed = parseComponentIdForConstruct(componentId);
  const resolvedMeta: LivePreviewServerMeta = {
    parentId: meta?.parentId ?? parsed.parentId ?? null,
    componentName: meta?.componentName ?? parsed.componentName,
    componentKey: meta?.componentKey,
  };
  session.componentMeta.set(componentId, resolvedMeta);

  if (resolvedMeta.parentId && !componentRegistry.has(resolvedMeta.parentId)) {
    const knownParentMeta = session.componentMeta.get(resolvedMeta.parentId);
    const parsedParent = parseComponentIdForConstruct(resolvedMeta.parentId);
    ensureServerComponentChain(session, resolvedMeta.parentId, knownParentMeta ?? {
      parentId: parsedParent.parentId,
      componentName: parsedParent.componentName,
    });
  }

  return constructServerComponent(session, componentId, resolvedMeta);
}

function invokeHandler(handler: Function, instance: any, args: unknown): any {
  if (args == null) return handler.call(instance);
  if (Array.isArray(args)) return handler.call(instance, ...args);
  return handler.call(instance, args);
}

function invokeStaticHandler(handler: Function, args: unknown): any {
  if (args == null) return handler();
  if (Array.isArray(args)) return handler(...args);
  return handler(args);
}

function resolveHostPath(hostRoots: Record<string, unknown> | undefined, path: string): { parent: unknown; value: unknown } {
  if (!hostRoots) {
    throw new Error(`Host roots are not available for ${path}`);
  }
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) {
    throw new Error('Host path cannot be empty.');
  }

  let current: unknown = hostRoots[parts[0]];
  if (current === undefined) {
    throw new Error(`Host root not found: ${parts[0]}`);
  }

  let parent: unknown = hostRoots;
  for (let index = 1; index < parts.length; index += 1) {
    parent = current;
    current = (current as Record<string, unknown> | undefined)?.[parts[index]];
    if (current === undefined) {
      throw new Error(`Host path not found: ${path}`);
    }
  }

  return { parent, value: current };
}

export async function dispatchLivePreviewServerRpc(serverSessionId: string, request: LivePreviewServerRequest): Promise<unknown> {
  const session = getLivePreviewServerSession(serverSessionId);
  const runtime = session.runtime;
  if (!runtime) {
    throw new Error('Live preview server runtime is not initialized.');
  }

  const { componentRegistry } = runtime;
  const parsed = parseComponentIdForConstruct(request.componentId);
  session.componentMeta.set(request.componentId, {
    parentId: request.meta?.parentId ?? parsed.parentId,
    componentName: request.meta?.componentName ?? parsed.componentName,
    componentKey: request.meta?.componentKey,
  });

  let instance = componentRegistry.has(request.componentId)
    ? componentRegistry.get(request.componentId).result
    : null;

  if (!instance) {
    const knownMeta = session.componentMeta.get(request.componentId);
    const constructMeta: LivePreviewServerMeta | undefined = request.meta ?? knownMeta;
    if (constructMeta || request.methodName === 'serverLoad') {
		  instance = ensureServerComponentChain(session, request.componentId, constructMeta);
    }
  }

  if (!instance) {
    throw new Error(`Component not found: ${request.componentId}`);
  }

  const handler = (instance as any)?.[request.methodName];
  if (typeof handler !== 'function') {
    const resolved = resolveHostPath(runtime.hostRoots, request.methodName);
    if (request.kind === 'get') {
      return resolved.value;
    }
    if (typeof resolved.value !== 'function') {
      throw new Error(`Host method not callable: ${request.methodName}`);
    }
    return await invokeHandler(resolved.value as Function, resolved.parent, request.args);
  }

  const result = await invokeHandler(handler, instance, request.args);
  if (request.methodName === 'serverLoad' && (result == null || typeof result !== 'object' || !('args' in (result as any)))) {
    throw new Error(`serverLoad must return an object with an args property for ${request.componentId}`);
  }
  return result;
}
