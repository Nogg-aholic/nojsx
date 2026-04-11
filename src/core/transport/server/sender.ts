import type { ServerWebSocket } from 'bun';
import { nojsxWSEvent } from '../../protocol/events.js';
import { encodeRpcValue } from '../../protocol/rpc-args.js';

const encoder = new TextEncoder();

const connectedSockets = new Set<ServerWebSocket<unknown>>();

export function setSocket(ws: ServerWebSocket<unknown> | null): void {
  if (!ws) return;
  connectedSockets.add(ws);
}

export function getSocket(): ServerWebSocket<unknown> | null {
  for (const ws of connectedSockets) {
    if (ws.readyState === 1) return ws;
  }
  return null;
}

export function deleteSocket(ws: ServerWebSocket<unknown> | null): void {
  if (!ws) return;
  connectedSockets.delete(ws);
}

export function isConnected(): boolean {
  for (const ws of connectedSockets) {
    if (ws.readyState === 1) return true;
  }
  return false;
}

function sendToSocket(ws: ServerWebSocket<unknown> | null | undefined, payload: Uint8Array): void {
  if (!ws || ws.readyState !== 1) return;
  ws.sendBinary(payload);
}

function broadcast(payload: Uint8Array): void {
  for (const ws of Array.from(connectedSockets)) {
    if (ws.readyState !== 1) {
      connectedSockets.delete(ws);
      continue;
    }
    ws.sendBinary(payload);
  }
}

export function sendRpcReturn(requestId: number, ok: boolean, payload: unknown, targetSocket?: ServerWebSocket<unknown> | null): void {
  const payloadBytes = encodeRpcValue(payload ?? null);
  const buf = new Uint8Array(1 + 4 + 1 + payloadBytes.length);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.RPC_RETURN_S2C;
  view.setUint32(offset, requestId >>> 0, true);
  offset += 4;
  buf[offset++] = ok ? 1 : 0;
  buf.set(payloadBytes, offset);

  sendToSocket(targetSocket ?? getSocket(), buf);
}

export function sendRenderComponent(componentId: string): void {
  const componentIdBytes = encoder.encode(componentId);
  const buf = new Uint8Array(1 + 1 + componentIdBytes.length);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.RenderComponent_S2C;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);

  broadcast(buf);
}

export function sendStateSync(componentId: string, key: string, value: unknown): void {
  const componentIdBytes = encoder.encode(componentId);
  const keyBytes = encoder.encode(key);
  const valueBytes = encoder.encode(JSON.stringify(value));
  const buf = new Uint8Array(1 + 1 + componentIdBytes.length + 1 + keyBytes.length + valueBytes.length);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.StateSync_S2C;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);
  offset += componentIdBytes.length;
  buf[offset++] = keyBytes.length;
  buf.set(keyBytes, offset);
  offset += keyBytes.length;
  buf.set(valueBytes, offset);

  broadcast(buf);
}

export function sendComponentSnapshot(componentId: string, snapshot: unknown): void {
  const componentIdBytes = encoder.encode(componentId);
  const snapshotBytes = encodeRpcValue(snapshot ?? null);
  const buf = new Uint8Array(1 + 1 + componentIdBytes.length + snapshotBytes.length);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.ComponentSnapshot_S2C;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);
  offset += componentIdBytes.length;
  buf.set(snapshotBytes, offset);

  broadcast(buf);
}

export function sendUpdateHtml(componentId: string, selector: string, html: string): void {
  const componentIdBytes = encoder.encode(componentId);
  const selectorBytes = encoder.encode(selector);
  const htmlBytes = encoder.encode(html);
  const buf = new Uint8Array(1 + 1 + componentIdBytes.length + 2 + selectorBytes.length + htmlBytes.length);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.UpdateHtml_S2C;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);
  offset += componentIdBytes.length;
  buf[offset++] = (selectorBytes.length >> 8) & 0xff;
  buf[offset++] = selectorBytes.length & 0xff;
  buf.set(selectorBytes, offset);
  offset += selectorBytes.length;
  buf.set(htmlBytes, offset);

  broadcast(buf);
}

export function sendRpcCall(componentId: string, methodName: string, args: unknown): void {
  const componentIdBytes = encoder.encode(componentId);
  const methodNameBytes = encoder.encode(methodName);
  const argsBytes = encodeRpcValue(args ?? null);
  const buf = new Uint8Array(1 + 1 + componentIdBytes.length + 1 + methodNameBytes.length + argsBytes.length);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.RPC_CALL_S2C;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);
  offset += componentIdBytes.length;
  buf[offset++] = methodNameBytes.length;
  buf.set(methodNameBytes, offset);
  offset += methodNameBytes.length;
  buf.set(argsBytes, offset);

  broadcast(buf);
}

export function sendRpcCallAwait(componentId: string, methodName: string, args: unknown, requestId: number): void {
  const componentIdBytes = encoder.encode(componentId);
  const methodNameBytes = encoder.encode(methodName);
  const argsBytes = encodeRpcValue(args ?? null);
  const buf = new Uint8Array(1 + 4 + 1 + componentIdBytes.length + 1 + methodNameBytes.length + argsBytes.length);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.RPC_CALL_AWAIT_S2C;
  view.setUint32(offset, requestId >>> 0, true);
  offset += 4;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);
  offset += componentIdBytes.length;
  buf[offset++] = methodNameBytes.length;
  buf.set(methodNameBytes, offset);
  offset += methodNameBytes.length;
  buf.set(argsBytes, offset);

  broadcast(buf);
}
