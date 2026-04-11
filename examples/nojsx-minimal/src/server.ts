/** @jsxImportSource nojsx */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ServerWebSocket } from 'bun';
import { nojsxWSEvent } from '../dist/nojsx/core/protocol/events.js';
import { handleClientConstruct, handleRpcAwaitFromClient } from '../dist/nojsx/core/transport/server/receiver.js';
import { deleteSocket, setSocket } from '../dist/nojsx/core/transport/server/sender.js';

const srcRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.dirname(srcRoot);
const devRoot = path.join(appRoot, 'dist');
const generatedLoadersPath = path.join(devRoot, 'src', '__nojsx_component_loaders.js');
const liveReloadStampPath = path.join(devRoot, '.nojsx-live-reload.json');
const port = Number(process.env.PORT || 4174);
const liveReloadClients = new Set<WritableStreamDefaultWriter<string>>();

await import(pathToFileURL(generatedLoadersPath).href);

function broadcastLiveReload(version: number): void {
  const payload = `data: ${JSON.stringify({ version })}\n\n`;
  for (const writer of Array.from(liveReloadClients)) {
    void writer.write(payload).catch(() => {
      liveReloadClients.delete(writer);
      void writer.close().catch(() => {});
    });
  }
}

async function readLiveReloadVersion(): Promise<number> {
  try {
    const raw = await readFile(liveReloadStampPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: number };
    return Number(parsed.version ?? 0);
  } catch {
    return 0;
  }
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.js' || ext === '.mjs'
    ? 'text/javascript; charset=utf-8'
    : ext === '.json'
      ? 'application/json; charset=utf-8'
      : ext === '.html'
        ? 'text/html; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : ext === '.map'
            ? 'application/json; charset=utf-8'
            : 'application/octet-stream';
}

function responseHeaders(contentTypeValue: string): HeadersInit {
  return {
    'content-type': contentTypeValue,
    'cache-control': 'no-cache',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': '*',
  };
}

function resolveSafePath(root: string, relativePath: string): string | null {
  const normalizedRelative = relativePath.replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(root, normalizedRelative);
  const relativeToRoot = path.relative(root, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return absolutePath;
}

function normalizeRequestPath(url: URL): string {
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return 'index.html';
  }

  const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!pathname.includes('.') && !pathname.startsWith('src/') && !pathname.startsWith('nojsx/')) {
    return 'index.html';
  }

  return pathname;
}

const decoder = new TextDecoder();

const server = Bun.serve<{ type: 'main' }>({
  port,
  development: true,
  async fetch(request: Request, server) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/ws') {
      const upgraded = server.upgrade(request, { data: { type: 'main' } });
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 400 });
      }
      return undefined;
    }


    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': '*',
          'access-control-max-age': '86400',
        },
      });
    }

    if (requestUrl.pathname === '/__nojsx_live_reload') {
      const stream = new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(new TextEncoder().encode(chunk));
        },
      });
      const writer = stream.writable.getWriter();
      liveReloadClients.add(writer);

      const version = await readLiveReloadVersion();
      await writer.write('retry: 1000\n');
      await writer.write(`data: ${JSON.stringify({ version })}\n\n`);

      request.signal.addEventListener('abort', () => {
        liveReloadClients.delete(writer);
        void writer.close().catch(() => {});
      }, { once: true });

      return new Response(stream.readable, {
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': '*',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        },
      });
    }

    if (requestUrl.pathname === '/__nojsx_live_reload/publish' && request.method === 'POST') {
      const payload = await request.json().catch(() => null) as { version?: number } | null;
      const version = Number(payload?.version ?? 0) || Date.now();
      await Bun.write(liveReloadStampPath, JSON.stringify({ version }));
      broadcastLiveReload(version);
      return Response.json({ ok: true, version }, {
        headers: {
          'cache-control': 'no-cache',
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
    }
    const relativePath = normalizeRequestPath(requestUrl);
    let absolutePath = resolveSafePath(devRoot, relativePath);

    if (!absolutePath) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!path.extname(absolutePath)) {
      const withJs = `${absolutePath}.js`;
      const asIndexJs = path.join(absolutePath, 'index.js');
      if (existsSync(withJs)) {
        absolutePath = withJs;
      } else if (existsSync(asIndexJs)) {
        absolutePath = asIndexJs;
      }
    }

    if (!existsSync(absolutePath)) {
      return new Response('Not Found', { status: 404 });
    }

    const body = await readFile(absolutePath);
    return new Response(body, {
      status: 200,
      headers: responseHeaders(contentType(absolutePath)),
    });
  },
  websocket: {
    open(ws: ServerWebSocket<{ type: 'main' }>) {
      setSocket(ws);
    },
    close(ws: ServerWebSocket<{ type: 'main' }>) {
      deleteSocket(ws);
    },
    message(ws: ServerWebSocket<{ type: 'main' }>, message) {
      void (async () => {
        if (typeof message === 'string') return;
        const data = new Uint8Array(message);
        if (data.length === 0) return;

        switch (data[0]) {
          case nojsxWSEvent.ClientConstruct:
            handleClientConstruct(data);
            break;
          case nojsxWSEvent.RPC_CALL_AWAIT:
            await handleRpcAwaitFromClient(data, ws);
            break;
          case nojsxWSEvent.ClientRender: {
            const componentIdLen = data[1];
            const componentId = decoder.decode(data.subarray(2, 2 + componentIdLen));
            console.log('[nojsx-minimal] client render', componentId);
            break;
          }
          default:
            console.warn(`[nojsx-minimal] unhandled ws event: 0x${data[0].toString(16)}`);
        }
      })();
    },
  },
});

console.log(`[nojsx-minimal] dev server http://127.0.0.1:${server.port}`);
