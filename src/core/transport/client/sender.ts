import { nojsxWSEvent } from '../../protocol/events.js';
import { encodeRpcValue } from '../../protocol/rpc-args.js';
import { sendBinary } from './connection.js';

const encoder = new TextEncoder();

type RpcNamedReference = {
  __nojsxRpcName?: string;
};

function serializeRpcArgs(value: unknown): unknown {
  const rpcName = (value as RpcNamedReference | undefined)?.__nojsxRpcName;
  if (typeof rpcName === 'string' && rpcName.length > 0) {
    return { __nojsxRpcName: rpcName };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeRpcArgs(entry));
  }

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = serializeRpcArgs(entry);
    }
    return out;
  }

  return value;
}

export function sendRpcToServer(methodName: string, componentId: string, args: unknown): void {
  const componentIdBytes = encoder.encode(componentId);
  const methodNameBytes = encoder.encode(methodName);
  const argsBytes = encodeRpcValue(serializeRpcArgs(args ?? null));

  const buf = new Uint8Array(1 + 1 + componentIdBytes.length + 1 + methodNameBytes.length + argsBytes.length);
  let offset = 0;
  buf[offset++] = nojsxWSEvent.RPC_CALL;
  buf[offset++] = componentIdBytes.length;
  buf.set(componentIdBytes, offset);
  offset += componentIdBytes.length;
  buf[offset++] = methodNameBytes.length;
  buf.set(methodNameBytes, offset);
  offset += methodNameBytes.length;
  buf.set(argsBytes, offset);

  sendBinary(buf);
}

export function sendRpcToServerAwait(methodName: string, componentId: string, args: unknown, requestId: number): void {
  const componentIdBytes = encoder.encode(componentId);
  const methodNameBytes = encoder.encode(methodName);
  const argsBytes = encodeRpcValue(serializeRpcArgs(args ?? null));

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

  sendBinary(buf);
}

export function sendRpcReturnToServer(requestId: number, ok: boolean, payload: unknown): void {
  const payloadBytes = encodeRpcValue(payload ?? null);
  const buf = new Uint8Array(1 + 4 + 1 + payloadBytes.length);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let offset = 0;
  buf[offset++] = nojsxWSEvent.RPC_RETURN;
  view.setUint32(offset, requestId >>> 0, true);
  offset += 4;
  buf[offset++] = ok ? 1 : 0;
  buf.set(payloadBytes, offset);

  sendBinary(buf);
}

export function sendClientConstruct(componentId: string, parentId: string | null, componentName: string, componentKey?: string | null): void {
  const idBytes = encoder.encode(componentId);
  const parentBytes = encoder.encode(parentId ?? '');
  const nameBytes = encoder.encode(componentName);
  const keyBytes = encoder.encode(componentKey ?? '');

  const buf = new Uint8Array(1 + 1 + idBytes.length + 1 + parentBytes.length + 1 + nameBytes.length + 1 + keyBytes.length);
  let offset = 0;
  buf[offset++] = nojsxWSEvent.ClientConstruct;
  buf[offset++] = idBytes.length;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = parentBytes.length;
  buf.set(parentBytes, offset);
  offset += parentBytes.length;
  buf[offset++] = nameBytes.length;
  buf.set(nameBytes, offset);
  offset += nameBytes.length;
  buf[offset++] = keyBytes.length;
  buf.set(keyBytes, offset);

  sendBinary(buf);
}

export function sendClientRender(componentId: string): void {
  const componentIdBytes = encoder.encode(componentId);
  const buf = new Uint8Array(1 + 1 + componentIdBytes.length);
  buf[0] = nojsxWSEvent.ClientRender;
  buf[1] = componentIdBytes.length;
  buf.set(componentIdBytes, 2);
  sendBinary(buf);
}
