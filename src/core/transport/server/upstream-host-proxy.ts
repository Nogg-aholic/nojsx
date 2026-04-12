import { decodeRpcReturnMessage, encodeRpcAwaitMessage} from '@nogg-aholic/nrpc';
import { nojsxWSEvent } from '../events.js';

type PendingUpstreamRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type UpstreamGlobals = typeof globalThis & {
  __nojsxUpstreamHostRpcEndpoint?: string;
  __nojsxResolvedUpstreamHostRpcEndpoint?: string;
  __nojsxUpstreamHostRpcWsEndpoint?: string;
  __nojsxResolvedUpstreamHostRpcWsEndpoint?: string;
  __nojsxUpstreamHostRpcEndpoints?: Record<string, string>;
  __nojsxResolvedUpstreamHostRpcEndpoints?: Record<string, string>;
  __nojsxUpstreamHostRpcWsEndpoints?: Record<string, string>;
  __nojsxResolvedUpstreamHostRpcWsEndpoints?: Record<string, string>;
};

export type UpstreamHostRpcConfig = {
  rpcEndpoint?: string;
  wsEndpoint?: string;
};

type UpstreamConnectionState = {
  socket: WebSocket | null;
  socketEndpoint: string | null;
  connectPromise: Promise<void> | null;
  nextRequestId: number;
  pendingRequests: Map<number, PendingUpstreamRequest>;
};

const upstreamConnections = new Map<string, UpstreamConnectionState>();



function normalizeHostArgs(args: unknown): unknown[] {
  if (args == null) return [];
  if (Array.isArray(args)) return args;
  return [args];
}

function getUpstreamConnectionState(upstreamId: string): UpstreamConnectionState {
  let state = upstreamConnections.get(upstreamId);
  if (state) {
    return state;
  }
  state = {
    socket: null,
    socketEndpoint: null,
    connectPromise: null,
    nextRequestId: 1,
    pendingRequests: new Map<number, PendingUpstreamRequest>(),
  };
  upstreamConnections.set(upstreamId, state);
  return state;
}

function getUpstreamHostRpcEndpoint(upstreamId: string): string {
  const globals = globalThis as UpstreamGlobals;
  const resolvedEndpoint = globals.__nojsxResolvedUpstreamHostRpcEndpoints?.[upstreamId]
    ?? (upstreamId === 'default' ? globals.__nojsxResolvedUpstreamHostRpcEndpoint : undefined);
  if (typeof resolvedEndpoint === 'string' && resolvedEndpoint.length > 0) {
    return resolvedEndpoint;
  }
  const globalEndpoint = globals.__nojsxUpstreamHostRpcEndpoints?.[upstreamId]
    ?? (upstreamId === 'default' ? globals.__nojsxUpstreamHostRpcEndpoint : undefined);
  if (typeof globalEndpoint === 'string' && globalEndpoint.length > 0) {
    return globalEndpoint;
  }

  throw new Error('Upstream host RPC endpoint is not configured. Set it from server startup before connecting.');
}

async function resolveUpstreamHostRpcEndpoint(upstreamId: string): Promise<string> {
  const globals = globalThis as UpstreamGlobals;
  const knownEndpoint = getUpstreamHostRpcEndpoint(upstreamId);
  globals.__nojsxResolvedUpstreamHostRpcEndpoints = globals.__nojsxResolvedUpstreamHostRpcEndpoints ?? {};
  globals.__nojsxResolvedUpstreamHostRpcEndpoints[upstreamId] = knownEndpoint;
  if (upstreamId === 'default') {
    globals.__nojsxResolvedUpstreamHostRpcEndpoint = knownEndpoint;
  }
  return knownEndpoint;
}

async function resolveUpstreamHostRpcWsEndpoint(upstreamId: string): Promise<string> {
  const globals = globalThis as UpstreamGlobals;
  const resolved = globals.__nojsxResolvedUpstreamHostRpcWsEndpoints?.[upstreamId]
    ?? (upstreamId === 'default' ? globals.__nojsxResolvedUpstreamHostRpcWsEndpoint : undefined);
  if (typeof resolved === 'string' && resolved.length > 0) {
    return resolved;
  }

  const explicit = globals.__nojsxUpstreamHostRpcWsEndpoints?.[upstreamId]
    ?? (upstreamId === 'default' ? globals.__nojsxUpstreamHostRpcWsEndpoint : undefined);
  if (typeof explicit === 'string' && explicit.length > 0) {
    globals.__nojsxResolvedUpstreamHostRpcWsEndpoints = globals.__nojsxResolvedUpstreamHostRpcWsEndpoints ?? {};
    globals.__nojsxResolvedUpstreamHostRpcWsEndpoints[upstreamId] = explicit;
    if (upstreamId === 'default') {
      globals.__nojsxResolvedUpstreamHostRpcWsEndpoint = explicit;
    }
    return explicit;
  }

  const nextResolved = deriveWsEndpoint(await resolveUpstreamHostRpcEndpoint(upstreamId));
  globals.__nojsxResolvedUpstreamHostRpcWsEndpoints = globals.__nojsxResolvedUpstreamHostRpcWsEndpoints ?? {};
  globals.__nojsxResolvedUpstreamHostRpcWsEndpoints[upstreamId] = nextResolved;
  if (upstreamId === 'default') {
    globals.__nojsxResolvedUpstreamHostRpcWsEndpoint = nextResolved;
  }
  return nextResolved;
}

function deriveWsEndpoint(httpEndpoint: string): string {
  const url = new URL(httpEndpoint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = url.pathname.endsWith('/rpc') ? `${url.pathname.slice(0, -4)}/ws` : '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function configureUpstreamHostRpc(upstreamId: string, config: UpstreamHostRpcConfig): void {
  const globals = globalThis as UpstreamGlobals;
  globals.__nojsxUpstreamHostRpcEndpoints = globals.__nojsxUpstreamHostRpcEndpoints ?? {};
  globals.__nojsxResolvedUpstreamHostRpcEndpoints = globals.__nojsxResolvedUpstreamHostRpcEndpoints ?? {};
  globals.__nojsxUpstreamHostRpcWsEndpoints = globals.__nojsxUpstreamHostRpcWsEndpoints ?? {};
  globals.__nojsxResolvedUpstreamHostRpcWsEndpoints = globals.__nojsxResolvedUpstreamHostRpcWsEndpoints ?? {};
  if (typeof config.rpcEndpoint === 'string' && config.rpcEndpoint.length > 0) {
    globals.__nojsxUpstreamHostRpcEndpoints[upstreamId] = config.rpcEndpoint;
    globals.__nojsxResolvedUpstreamHostRpcEndpoints[upstreamId] = config.rpcEndpoint;
    if (upstreamId === 'default') {
      globals.__nojsxUpstreamHostRpcEndpoint = config.rpcEndpoint;
      globals.__nojsxResolvedUpstreamHostRpcEndpoint = config.rpcEndpoint;
    }
  }
  if (typeof config.wsEndpoint === 'string' && config.wsEndpoint.length > 0) {
    globals.__nojsxUpstreamHostRpcWsEndpoints[upstreamId] = config.wsEndpoint;
    globals.__nojsxResolvedUpstreamHostRpcWsEndpoints[upstreamId] = config.wsEndpoint;
    if (upstreamId === 'default') {
      globals.__nojsxUpstreamHostRpcWsEndpoint = config.wsEndpoint;
      globals.__nojsxResolvedUpstreamHostRpcWsEndpoint = config.wsEndpoint;
    }
  } else if (typeof config.rpcEndpoint === 'string' && config.rpcEndpoint.length > 0) {
    const wsEndpoint = deriveWsEndpoint(config.rpcEndpoint);
    globals.__nojsxUpstreamHostRpcWsEndpoints[upstreamId] = wsEndpoint;
    globals.__nojsxResolvedUpstreamHostRpcWsEndpoints[upstreamId] = wsEndpoint;
    if (upstreamId === 'default') {
      globals.__nojsxUpstreamHostRpcWsEndpoint = wsEndpoint;
      globals.__nojsxResolvedUpstreamHostRpcWsEndpoint = wsEndpoint;
    }
  }
}

function rejectPendingUpstreamRequests(state: UpstreamConnectionState, error: Error): void {
  for (const [requestId, pending] of Array.from(state.pendingRequests.entries())) {
    state.pendingRequests.delete(requestId);
    pending.reject(error);
  }
}

function clearUpstreamSocketState(state: UpstreamConnectionState): void {
  state.socket = null;
  state.socketEndpoint = null;
  state.connectPromise = null;
}

function nextUpstreamRequestId(state: UpstreamConnectionState): number {
  const requestId = state.nextRequestId >>> 0;
  state.nextRequestId = (requestId + 1) >>> 0;
  return requestId;
}

function attachUpstreamSocketHandlers(state: UpstreamConnectionState, socket: WebSocket, endpoint: string): void {
  socket.binaryType = 'arraybuffer';

  socket.onmessage = (event) => {
    try {
      const payload = new Uint8Array(event.data);
      const response = decodeRpcReturnMessage(payload, nojsxWSEvent.RPC_RETURN_S2C);
      const pending = state.pendingRequests.get(response.requestId);
      if (!pending) {
        return;
      }

      state.pendingRequests.delete(response.requestId);
      if (!response.ok) {
        pending.reject(new Error(String(response.payload)));
        return;
      }
      pending.resolve(response.payload);
    } catch (error) {
      const message = error instanceof Error ? error : new Error(String(error));
      rejectPendingUpstreamRequests(state, message);
    }
  };

  socket.onerror = () => {
    const error = new Error(`Upstream host RPC websocket failed: ${endpoint}`);
    rejectPendingUpstreamRequests(state, error);
  };

  socket.onclose = () => {
    const error = new Error(`Upstream host RPC websocket closed: ${endpoint}`);
    clearUpstreamSocketState(state);
    rejectPendingUpstreamRequests(state, error);
  };
}

export async function connectUpstreamHostRpc(upstreamId = 'default'): Promise<void> {
  const state = getUpstreamConnectionState(upstreamId);
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    return;
  }

  if (state.connectPromise) {
    return state.connectPromise;
  }

  state.connectPromise = (async () => {
    const endpoint = await resolveUpstreamHostRpcWsEndpoint(upstreamId);

    if (state.socket && state.socket.readyState === WebSocket.OPEN && state.socketEndpoint === endpoint) {
      return;
    }

    if (state.socket && state.socket.readyState === WebSocket.CONNECTING && state.socketEndpoint === endpoint) {
      return new Promise<void>((resolve, reject) => {
        const socket = state.socket!;
        const handleOpen = () => {
          cleanup();
          resolve();
        };
        const handleClose = () => {
          cleanup();
          reject(new Error(`Upstream host RPC websocket closed before ready: ${endpoint}`));
        };
        const cleanup = () => {
          socket.removeEventListener('open', handleOpen);
          socket.removeEventListener('close', handleClose);
        };
        socket.addEventListener('open', handleOpen, { once: true });
        socket.addEventListener('close', handleClose, { once: true });
      });
    }

    const socket = new WebSocket(endpoint);
    state.socket = socket;
    state.socketEndpoint = endpoint;
    attachUpstreamSocketHandlers(state, socket, endpoint);

    await new Promise<void>((resolve, reject) => {
      const handleOpen = () => {
        cleanup();
        resolve();
      };
      const handleClose = () => {
        cleanup();
        reject(new Error(`Upstream host RPC websocket closed before ready: ${endpoint}`));
      };
      const handleError = () => {
        cleanup();
        reject(new Error(`Upstream host RPC websocket failed before ready: ${endpoint}`));
      };
      const cleanup = () => {
        socket.removeEventListener('open', handleOpen);
        socket.removeEventListener('close', handleClose);
        socket.removeEventListener('error', handleError);
      };
      socket.addEventListener('open', handleOpen, { once: true });
      socket.addEventListener('close', handleClose, { once: true });
      socket.addEventListener('error', handleError, { once: true });
    });
  })();

  try {
    await state.connectPromise;
  } finally {
    state.connectPromise = null;
  }
}

export function disconnectUpstreamHostRpc(upstreamId = 'default'): void {
  const state = getUpstreamConnectionState(upstreamId);
  const socket = state.socket;
  clearUpstreamSocketState(state);
  if (!socket) {
    return;
  }
  try {
    socket.close();
  } catch {
    // Ignore close errors.
  }
}

export function isUpstreamHostRpcConnected(upstreamId = 'default'): boolean {
  const state = getUpstreamConnectionState(upstreamId);
  return !!state.socket && state.socket.readyState === WebSocket.OPEN;
}

async function invokeUpstreamHostRpcPath(upstreamId: string, path: readonly string[], args: readonly unknown[] = []): Promise<unknown> {
  if (!path.length) {
    throw new Error('Upstream host RPC path cannot be empty.');
  }

  const methodName = path.join('.');
  await connectUpstreamHostRpc(upstreamId);

  const state = getUpstreamConnectionState(upstreamId);
  const socket = state.socket;
  const endpoint = state.socketEndpoint;
  if (!socket || socket.readyState !== WebSocket.OPEN || !endpoint) {
    throw new Error('Upstream host RPC websocket is not connected.');
  }

  return new Promise<unknown>((resolve, reject) => {
    const requestId = nextUpstreamRequestId(state);
    state.pendingRequests.set(requestId, { resolve, reject });

    try {
      socket.send(Uint8Array.from(encodeRpcAwaitMessage(nojsxWSEvent.RPC_CALL_AWAIT, requestId, methodName, [...args])));
    } catch (error) {
      state.pendingRequests.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function invokeUpstreamHostRpc(methodName: string, args: unknown): Promise<unknown> {
  const path = methodName.split('.').filter(Boolean);
  if (path.length === 0) {
    throw new Error('Upstream host RPC path cannot be empty.');
  }

  const upstreamId = path[0];
  const normalizedPath = path.slice(1);
  if (normalizedPath.length === 0) {
    throw new Error(`Upstream host RPC path cannot target only the ${upstreamId} root namespace.`);
  }

  return invokeUpstreamHostRpcPath(upstreamId, normalizedPath, normalizeHostArgs(args));
}

//TODO: check reconnect 