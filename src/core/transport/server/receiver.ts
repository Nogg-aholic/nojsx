import { stateCache } from '../../components/components.js';
import { componentRegistry } from '../../global/registry.js';
import { nojsxWSEvent } from '../../protocol/events.js';
import { decodeRpcValue } from '../../protocol/rpc-args.js';
import { createComponentSnapshot } from '../../util/component-snapshot.js';
import { constructClientComponentOnServer } from './client-construct.js';
import { sendComponentSnapshot, sendRpcReturn } from './sender.js';
import { invokeUpstreamHostRpc } from './upstream-host-proxy.js';
import type { ServerWebSocket } from 'bun';

const decoder = new TextDecoder();

type ServerLoadResponse = {
  args?: unknown;
  __state?: Record<string, unknown>;
  __snapshot?: Record<string, unknown>;
};

function getGlobalRpcHandler(methodName: string): Function | undefined {
  const globals = globalThis as Record<string, unknown>;
  const candidate = globals[methodName];
  return typeof candidate === 'function' ? candidate : undefined;
}

function isUpstreamHostMethod(methodName: string): boolean {
  return methodName.startsWith('vscode.');
}

function invokeFunction(handler: Function, thisArg: unknown, args: unknown): unknown {
  if (args == null) return handler.call(thisArg);
  if (Array.isArray(args)) return handler.call(thisArg, ...args);
  if (typeof args === 'object' && handler.length > 1) return handler.call(thisArg, ...Object.values(args as Record<string, unknown>));
  return handler.call(thisArg, args);
}

function parseComponentId(componentId: string): { parentId: string | null; componentName: string } {
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

async function ensureServerComponentChain(componentId: string): Promise<void> {
  if (!componentId || componentRegistry.has(componentId)) return;

  const { parentId, componentName } = parseComponentId(componentId);
  if (parentId) {
    await ensureServerComponentChain(parentId);
  }

  if (!componentRegistry.has(componentId)) {
    await constructClientComponentOnServer({ componentId, parentId, componentName });
  }
}

function getServerStateSnapshot(componentId: string): Record<string, unknown> | null {
  const prefix = `${componentId}:`;
  let out: Record<string, unknown> | null = null;
  for (const [key, value] of stateCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    out ??= {};
    out[key.slice(prefix.length)] = value;
  }
  return out;
}

export async function handleRpcAwaitFromClient(data: Uint8Array, requesterSocket?: ServerWebSocket<unknown> | null): Promise<boolean> {
  if (data[0] !== nojsxWSEvent.RPC_CALL_AWAIT) return false;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 1;
  const requestId = view.getUint32(offset, true);
  offset += 4;

  const componentIdLen = data[offset++];
  const componentId = decoder.decode(data.subarray(offset, offset + componentIdLen));
  offset += componentIdLen;

  const methodNameLen = data[offset++];
  const methodName = decoder.decode(data.subarray(offset, offset + methodNameLen));
  offset += methodNameLen;

  let args: unknown;
  try {
    [args] = decodeRpcValue(data, offset);
  } catch (error) {
    sendRpcReturn(requestId, false, String((error as Error)?.message ?? error), requesterSocket);
    return true;
  }

  const existedBefore = componentRegistry.has(componentId);
  if (methodName === 'serverLoad' && !existedBefore) {
    await ensureServerComponentChain(componentId);
  }

  if (isUpstreamHostMethod(methodName)) {
    try {
      const result = await invokeUpstreamHostRpc(methodName, args);
      sendRpcReturn(requestId, true, result ?? null, requesterSocket);
    } catch (error) {
      sendRpcReturn(requestId, false, String((error as Error)?.message ?? error), requesterSocket);
    }
    return true;
  }

  if (!componentRegistry.has(componentId)) {
    const globalHandler = getGlobalRpcHandler(methodName);
    if (typeof globalHandler === 'function') {
      try {
        const result = await Promise.resolve(invokeFunction(globalHandler, undefined, args));
        sendRpcReturn(requestId, true, result ?? null, requesterSocket);
      } catch (error) {
        sendRpcReturn(requestId, false, String((error as Error)?.message ?? error), requesterSocket);
      }
      return true;
    }
    sendRpcReturn(requestId, false, `Component not found: ${componentId}`, requesterSocket);
    return true;
  }

  const entry = componentRegistry.get(componentId);
  const instance = entry.result as Record<string, unknown>;
  const handler = typeof instance[methodName] === 'function'
    ? (instance[methodName] as Function)
    : entry.result.__serverHandlers?.[methodName];

  if (typeof handler !== 'function') {
    if (methodName === 'serverLoad') {
      const payload: ServerLoadResponse = { args: null };
      const snapshot = existedBefore ? getServerStateSnapshot(componentId) : null;
      if (snapshot && Object.keys(snapshot).length > 0) payload.__state = snapshot;
      sendRpcReturn(requestId, true, payload, requesterSocket);
      return true;
    }
    sendRpcReturn(requestId, false, `Server handler not found: ${componentId}.${methodName}`, requesterSocket);
    return true;
  }

  try {
    let result = await Promise.resolve(invokeFunction(handler, entry.result, args));
    if (methodName === 'serverLoad') {
      const snapshot = existedBefore ? getServerStateSnapshot(componentId) : null;
      const payload: ServerLoadResponse = result != null && typeof result === 'object' && 'args' in (result as Record<string, unknown>)
        ? (result as ServerLoadResponse)
        : { args: null };
      if (snapshot && Object.keys(snapshot).length > 0) payload.__state = snapshot;
      payload.__snapshot = createComponentSnapshot(entry.result as Record<string, unknown>);
      result = payload;
    }
    sendRpcReturn(requestId, true, result ?? null, requesterSocket);
    if (methodName !== 'serverLoad') {
      sendComponentSnapshot(componentId, createComponentSnapshot(entry.result as Record<string, unknown>));
    }
  } catch (error) {
    sendRpcReturn(requestId, false, String((error as Error)?.stack ?? (error as Error)?.message ?? error), requesterSocket);
  }

  return true;
}

export function handleClientConstruct(data: Uint8Array): boolean {
  if (data[0] !== nojsxWSEvent.ClientConstruct) return false;
  let offset = 1;
  const idLen = data[offset++];
  const componentId = decoder.decode(data.subarray(offset, offset + idLen));
  offset += idLen;
  const parentLen = data[offset++];
  const parentId = decoder.decode(data.subarray(offset, offset + parentLen)) || null;
  offset += parentLen;
  const nameLen = data[offset++];
  const componentName = decoder.decode(data.subarray(offset, offset + nameLen));
  offset += nameLen;
  const keyLen = data[offset++];
  const componentKey = decoder.decode(data.subarray(offset, offset + keyLen)) || undefined;
  void constructClientComponentOnServer({ componentId, parentId, componentName, componentKey });
  return true;
}
