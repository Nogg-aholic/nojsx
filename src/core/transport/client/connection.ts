import { clientHandleMessage } from './receiver.js';

let ws: WebSocket | null = null;
let connectPromise: Promise<void> | null = null;

type nojsxConnectionGlobals = typeof globalThis & {
  __nojsxDisableWebSocket?: boolean;
  // build script sets this onto shell
  __nojsxWebSocketUrl?: string;
  __nojsxWebSocketFailed?: boolean;
};

function getConnectionGlobals(): nojsxConnectionGlobals {
  return globalThis as nojsxConnectionGlobals;
}

function resolveSocketUrl(): string | undefined {
  const g = getConnectionGlobals();
  if (typeof g.__nojsxWebSocketUrl === 'string' && g.__nojsxWebSocketUrl.length > 0) {
    return g.__nojsxWebSocketUrl;
  }
  if (typeof window === 'undefined') return undefined;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (location.host) {
    return `${protocol}//${location.host}/ws`;
  }
  return undefined;
}

export function connect(): Promise<void> {
  const g = getConnectionGlobals();
  if (g.__nojsxDisableWebSocket || g.__nojsxWebSocketFailed) {
    return Promise.resolve();
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }
  if (connectPromise) {
    return connectPromise;
  }

  const url = resolveSocketUrl(); 
  if (!url) {
    return Promise.reject(new Error('WebSocket URL required on server'));
  }

  connectPromise = new Promise((resolve, reject) => {
    try {
    	ws = new WebSocket(url);
    } catch (error) {
      connectPromise = null;
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    ws.binaryType = 'arraybuffer';

    let wasConnected = false;

    ws.onopen = () => {
      wasConnected = true;
      connectPromise = null;
      resolve();
    };

    ws.onerror = () => {
      connectPromise = null;
      reject(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      const shouldReload = wasConnected && typeof window !== 'undefined';
      ws = null;
      connectPromise = null;
      if (shouldReload) {
        window.setTimeout(() => window.location.reload(), 1000);
      }
    };

    ws.onmessage = (event) => {
      clientHandleMessage(new Uint8Array(event.data));
    };
  });

  return connectPromise;
}

export function isConnected(): boolean {
  const g = getConnectionGlobals();
  if (g.__nojsxDisableWebSocket) return true;
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function getSocket(): WebSocket | null {
  return ws;
}

export function sendBinary(data: Uint8Array): void {
  const g = getConnectionGlobals();
  if (g.__nojsxDisableWebSocket) {
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not connected.');
  }
  const payload = new Uint8Array(data.byteLength);
  payload.set(data);
  ws.send(payload);
}

export async function ensureConnected(): Promise<void> {
  if (isConnected()) return;
  await connect();
}
