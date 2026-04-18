import {
  decodeRpcReturnMessage,
  decodeRpcReturnMessageWithCodec,
  encodeRpcAwaitMessage,
  encodeRpcAwaitMessageWithCodec,
  type RpcMethodCodec,
} from '@nogg-aholic/nrpc';

export type UpstreamHostRpcWsProfile = {
  callAwaitEvent: number;
  returnEvent: number;
};

const DEFAULT_UPSTREAM_HOST_RPC_WS_PROFILE: UpstreamHostRpcWsProfile = {
  callAwaitEvent: 0x0b,
  returnEvent: 0x2a,
};

type PendingUpstreamRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  codec?: RpcMethodCodec<any[], any>;
};

type UpstreamGlobals = typeof globalThis & {
  __nojsxInvokeUpstreamHostRpc?: (methodName: string, args: unknown) => Promise<unknown>;
};

type CodecResolver = (methodName: string) => RpcMethodCodec<any[], any> | undefined;

export type UpstreamHostRpcConfig = {
  rpcEndpoint?: string;
  wsEndpoint?: string;
  codecRegistry?:
    | Map<string, RpcMethodCodec<any[], any>>
    | ReadonlyMap<string, RpcMethodCodec<any[], any>>
    | Iterable<readonly [string, RpcMethodCodec<any[], any>]>
    | CodecResolver
    | Record<string, RpcMethodCodec<any[], any>>;
  wsProfile?: UpstreamHostRpcWsProfile;
};

type UpstreamConnectionState = {
  socket: WebSocket | null;
  socketEndpoint: string | null;
  connectPromise: Promise<void> | null;
  nextRequestId: number;
  pendingRequests: Map<number, PendingUpstreamRequest>;
  rpcEndpoint: string | null;
  wsEndpoint: string | null;
  codecResolver?: CodecResolver;
  wsProfile: UpstreamHostRpcWsProfile;
};

const upstreamConnections = new Map<string, UpstreamConnectionState>();

function createCodecResolver(
  codecRegistry: UpstreamHostRpcConfig['codecRegistry'],
): CodecResolver | undefined {
  if (!codecRegistry) {
    return undefined;
  }

  if (typeof codecRegistry === 'function') {
    return codecRegistry;
  }

  if (typeof (codecRegistry as Iterable<readonly [string, RpcMethodCodec<any[], any>]>)[Symbol.iterator] === 'function') {
    const entries = Array.from(codecRegistry as Iterable<readonly [string, RpcMethodCodec<any[], any>]>);
    const registry = new Map<string, RpcMethodCodec<any[], any>>(entries);
    return (methodName: string) => registry.get(methodName);
  }

  const registry = new Map<string, RpcMethodCodec<any[], any>>(Object.entries(codecRegistry as Record<string, RpcMethodCodec<any[], any>>));
  return (methodName: string) => registry.get(methodName);
}



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
    rpcEndpoint: null,
    wsEndpoint: null,
    codecResolver: undefined,
    wsProfile: { ...DEFAULT_UPSTREAM_HOST_RPC_WS_PROFILE },
  };
  upstreamConnections.set(upstreamId, state);
  return state;
}

function getUpstreamHostRpcEndpoint(upstreamId: string): string {
  const state = getUpstreamConnectionState(upstreamId);
  if (typeof state.rpcEndpoint === 'string' && state.rpcEndpoint.length > 0) {
    return state.rpcEndpoint;
  }

  throw new Error(`Upstream host RPC endpoint is not configured for ${upstreamId}. Set it from server startup before connecting.`);
}

async function resolveUpstreamHostRpcEndpoint(upstreamId: string): Promise<string> {
  return getUpstreamHostRpcEndpoint(upstreamId);
}

async function resolveUpstreamHostRpcWsEndpoint(upstreamId: string): Promise<string> {
  const state = getUpstreamConnectionState(upstreamId);
  if (typeof state.wsEndpoint === 'string' && state.wsEndpoint.length > 0) {
    return state.wsEndpoint;
  }

  return deriveWsEndpoint(await resolveUpstreamHostRpcEndpoint(upstreamId));
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
  const state = getUpstreamConnectionState(upstreamId);
  state.rpcEndpoint = typeof config.rpcEndpoint === 'string' && config.rpcEndpoint.length > 0 ? config.rpcEndpoint : null;
  state.wsEndpoint = typeof config.wsEndpoint === 'string' && config.wsEndpoint.length > 0 ? config.wsEndpoint : null;
  state.codecResolver = createCodecResolver(config.codecRegistry);
  state.wsProfile = {
    ...DEFAULT_UPSTREAM_HOST_RPC_WS_PROFILE,
    ...(config.wsProfile ?? {}),
  };
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
      const requestId = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(1, true);
      const pending = state.pendingRequests.get(requestId);
      if (!pending) {
        return;
      }

      const response = pending.codec
        ? decodeRpcReturnMessageWithCodec(payload, pending.codec, state.wsProfile.returnEvent)
        : decodeRpcReturnMessage(payload, state.wsProfile.returnEvent);

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
    const codec = state.codecResolver?.(methodName);
    state.pendingRequests.set(requestId, { resolve, reject, codec });

    try {
      const payload = codec
        ? encodeRpcAwaitMessageWithCodec(state.wsProfile.callAwaitEvent, requestId, methodName, [...args], codec)
        : encodeRpcAwaitMessage(state.wsProfile.callAwaitEvent, requestId, methodName, [...args]);
      socket.send(Uint8Array.from(payload));
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

(globalThis as UpstreamGlobals).__nojsxInvokeUpstreamHostRpc = invokeUpstreamHostRpc;

//TODO: check reconnect 