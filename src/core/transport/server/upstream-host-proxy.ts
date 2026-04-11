import { nojsxWSEvent } from '../../protocol/events.js';
import { decodeRpcValue, encodeRpcValue } from '../../protocol/rpc-args.js';

type UpstreamGlobals = typeof globalThis & {
  __nojsxUpstreamHostRpcEndpoint?: string;
  __nojsxResolvedUpstreamHostRpcEndpoint?: string;
  __nojsxUpstreamHostRpcWsEndpoint?: string;
  __nojsxResolvedUpstreamHostRpcWsEndpoint?: string;
};

function normalizeHostArgs(args: unknown): unknown[] {
  if (args == null) return [];
  if (Array.isArray(args)) return args;
  return [args];
}

export function getUpstreamHostRpcEndpoint(): string {
  const globals = globalThis as UpstreamGlobals;
  const resolvedEndpoint = globals.__nojsxResolvedUpstreamHostRpcEndpoint;
  if (typeof resolvedEndpoint === 'string' && resolvedEndpoint.length > 0) {
    return resolvedEndpoint;
  }
  const globalEndpoint = globals.__nojsxUpstreamHostRpcEndpoint;
  if (typeof globalEndpoint === 'string' && globalEndpoint.length > 0) {
    return globalEndpoint;
  }

  const envEndpoint = typeof process === 'undefined' ? undefined : process.env.NOJSX_UPSTREAM_HOST_RPC_ENDPOINT;
  if (typeof envEndpoint === 'string' && envEndpoint.length > 0) {
    return envEndpoint;
  }

  return 'http://127.0.0.1:43111/rpc';
}

export async function resolveUpstreamHostRpcEndpoint(): Promise<string> {
  const globals = globalThis as UpstreamGlobals;
  const knownEndpoint = getUpstreamHostRpcEndpoint();
  if (knownEndpoint !== 'http://127.0.0.1:43111/rpc') {
    globals.__nojsxResolvedUpstreamHostRpcEndpoint = knownEndpoint;
    return knownEndpoint;
  }

  if (typeof window !== 'undefined') {
    return knownEndpoint;
  }

  const discovered = await discoverInstalledProxyRpcEndpoint();
  const resolved = discovered ?? knownEndpoint;
  globals.__nojsxResolvedUpstreamHostRpcEndpoint = resolved;
  return resolved;
}

export function getUpstreamHostRpcWsEndpoint(): string {
  const globals = globalThis as UpstreamGlobals;
  const resolvedEndpoint = globals.__nojsxResolvedUpstreamHostRpcWsEndpoint;
  if (typeof resolvedEndpoint === 'string' && resolvedEndpoint.length > 0) {
    return resolvedEndpoint;
  }

  const globalEndpoint = globals.__nojsxUpstreamHostRpcWsEndpoint;
  if (typeof globalEndpoint === 'string' && globalEndpoint.length > 0) {
    return globalEndpoint;
  }

  const derived = deriveWsEndpoint(getUpstreamHostRpcEndpoint());
  globals.__nojsxResolvedUpstreamHostRpcWsEndpoint = derived;
  return derived;
}

export async function resolveUpstreamHostRpcWsEndpoint(): Promise<string> {
  const globals = globalThis as UpstreamGlobals;
  const explicit = globals.__nojsxUpstreamHostRpcWsEndpoint;
  if (typeof explicit === 'string' && explicit.length > 0) {
    globals.__nojsxResolvedUpstreamHostRpcWsEndpoint = explicit;
    return explicit;
  }

  const discovered = await discoverInstalledProxyWsEndpoint();
  const resolved = discovered ?? deriveWsEndpoint(await resolveUpstreamHostRpcEndpoint());
  globals.__nojsxResolvedUpstreamHostRpcWsEndpoint = resolved;
  return resolved;
}

async function discoverInstalledProxyRpcEndpoint(): Promise<string | null> {
  try {
    const [{ readFile }, os, path] = await Promise.all([
      import('node:fs/promises'),
      import('node:os'),
      import('node:path'),
    ]);
    const candidates = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Code - Insiders', 'User', 'globalStorage', 'local.vscode-api-proxy', 'server-info.json'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'local.vscode-api-proxy', 'server-info.json'),
    ];

    for (const filePath of candidates) {
      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as { rpcEndpoint?: unknown };
        if (typeof parsed.rpcEndpoint === 'string' && parsed.rpcEndpoint.length > 0) {
          return parsed.rpcEndpoint;
        }
      } catch {
        // Ignore invalid or transient files.
      }
    }
  } catch {
    // Ignore environments without node builtins.
  }

  return null;
}

async function discoverInstalledProxyWsEndpoint(): Promise<string | null> {
  try {
    const [{ readFile }, os, path] = await Promise.all([
      import('node:fs/promises'),
      import('node:os'),
      import('node:path'),
    ]);
    const candidates = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'Code - Insiders', 'User', 'globalStorage', 'local.vscode-api-proxy', 'server-info.json'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'local.vscode-api-proxy', 'server-info.json'),
    ];

    for (const filePath of candidates) {
      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as { wsRpcEndpoint?: unknown; rpcEndpoint?: unknown };
        if (typeof parsed.wsRpcEndpoint === 'string' && parsed.wsRpcEndpoint.length > 0) {
          return parsed.wsRpcEndpoint;
        }
        if (typeof parsed.rpcEndpoint === 'string' && parsed.rpcEndpoint.length > 0) {
          return deriveWsEndpoint(parsed.rpcEndpoint);
        }
      } catch {
        // Ignore invalid or transient files.
      }
    }
  } catch {
    // Ignore environments without node builtins.
  }

  return null;
}

export async function invokeUpstreamHostRpcPath(path: readonly string[], args: readonly unknown[] = []): Promise<unknown> {
  if (!path.length) {
    throw new Error('Upstream host RPC path cannot be empty.');
  }

  const endpoint = await resolveUpstreamHostRpcWsEndpoint();
  const methodName = path.join('.');

  return new Promise<unknown>((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    socket.binaryType = 'arraybuffer';
    const requestId = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        // ignore close errors
      }
      reject(error);
    };

    const succeed = (value: unknown) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        // ignore close errors
      }
      resolve(value);
    };

    socket.onopen = () => {
      try {
        socket.send(Uint8Array.from(encodeRpcAwaitMessage(requestId, methodName, [...args])));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };

    socket.onmessage = (event) => {
      try {
        const payload = new Uint8Array(event.data);
        const response = decodeRpcReturnMessage(payload);
        if (response.requestId !== requestId) {
          return;
        }
        if (!response.ok) {
          fail(new Error(String(response.payload)));
          return;
        }
        succeed(response.payload);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };

    socket.onerror = () => {
      fail(new Error(`Upstream host RPC websocket failed: ${endpoint}`));
    };

    socket.onclose = () => {
      if (!settled) {
        fail(new Error(`Upstream host RPC websocket closed before response: ${endpoint}`));
      }
    };
  });
}

export async function invokeUpstreamHostRpc(methodName: string, args: unknown): Promise<unknown> {
  const path = methodName.split('.').filter(Boolean);
  if (path.length === 0) {
    throw new Error('Upstream host RPC path cannot be empty.');
  }

  const normalizedPath = path[0] === 'vscode' ? path.slice(1) : path;
  if (normalizedPath.length === 0) {
    throw new Error('Upstream host RPC path cannot target only the vscode root namespace.');
  }

  return invokeUpstreamHostRpcPath(normalizedPath, normalizeHostArgs(args));
}

function deriveWsEndpoint(httpEndpoint: string): string {
  const url = new URL(httpEndpoint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = url.pathname.endsWith('/rpc') ? `${url.pathname.slice(0, -4)}/ws` : '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function encodeRpcAwaitMessage(requestId: number, methodName: string, args: unknown): Uint8Array {
  const encoder = new TextEncoder();
  const componentIdBytes = encoder.encode('');
  const methodNameBytes = encoder.encode(methodName);
  const argsBytes = encodeRpcValue(args ?? null);
  const buf = new Uint8Array(1 + 4 + 1 + componentIdBytes.length + 1 + methodNameBytes.length + argsBytes.length);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.RPC_CALL_AWAIT;
  view.setUint32(offset, requestId >>> 0, true);
  offset += 4;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);
  offset += componentIdBytes.length;
  buf[offset++] = methodNameBytes.length;
  buf.set(methodNameBytes, offset);
  offset += methodNameBytes.length;
  buf.set(argsBytes, offset);

  return buf;
}

function decodeRpcReturnMessage(data: Uint8Array): { requestId: number; ok: boolean; payload: unknown } {
  if (data[0] !== nojsxWSEvent.RPC_RETURN_S2C) {
    throw new Error(`Unexpected upstream RPC event: ${data[0]}`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const requestId = view.getUint32(1, true);
  const ok = data[5] === 1;
  const [payload] = decodeRpcValue(data, 6);
  return { requestId, ok, payload };
}