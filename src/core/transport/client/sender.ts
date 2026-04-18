import { nojsxWSEvent } from '../events.js';
import { sendBinary } from './connection.js';
import { encodeRpcAwaitMessage, encodeRpcCallMessage, encodeRpcReturnMessage, serializeRpcMethodRefs } from '@nogg-aholic/nrpc';

const encoder = new TextEncoder();

export function sendRpcToServer(methodName: string, componentId: string, args: unknown): void {
  sendBinary(encodeRpcCallMessage(nojsxWSEvent.RPC_CALL, methodName, serializeRpcMethodRefs(args ?? null), componentId));
}

export function sendRpcToServerAwait(methodName: string, componentId: string, args: unknown, requestId: number): void {
  sendBinary(encodeRpcAwaitMessage(nojsxWSEvent.RPC_CALL_AWAIT, requestId, methodName, serializeRpcMethodRefs(args ?? null), componentId));
}

export function sendRpcReturnToServer(requestId: number, ok: boolean, payload: unknown): void {
  sendBinary(encodeRpcReturnMessage(nojsxWSEvent.RPC_RETURN, requestId, ok, payload ?? null));
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
