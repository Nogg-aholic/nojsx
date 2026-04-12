import { stateCache, stateHydratedKeys, stateSyncCallbacks } from '../../components/components.js';
import { componentRegistry, type nojsxGlobals } from '../../components/registry.js';
import { nojsxWSEvent } from '../events.js';
import { decodeRpcAwaitMessage, decodeRpcCallMessage, decodeRpcReturnMessage, decodeRpcValue } from '@nogg-aholic/nrpc';
import { applyComponentSnapshot } from '../../util/component-snapshot.js';
import { sendRpcReturnToServer } from './sender.js';

const decoder = new TextDecoder();

function handleRenderComponent(data: Uint8Array): void {
  const componentIdLen = data[1];
  const componentId = decoder.decode(data.subarray(2, 2 + componentIdLen));
  const element = document.querySelector(`[data-component-id="${componentId}"]`);
  if (element) {
    const event = new CustomEvent('server-render', { detail: { componentId } });
    element.dispatchEvent(event);
  }
}

function handleUpdateHtml(data: Uint8Array): void {
  const componentIdLen = data[1];
  let offset = 2 + componentIdLen;
  const selectorLen = (data[offset] << 8) | data[offset + 1];
  offset += 2;
  const selector = decoder.decode(data.subarray(offset, offset + selectorLen));
  offset += selectorLen;
  const html = decoder.decode(data.subarray(offset));
  const element = document.querySelector(selector);
  if (!element) return;
  if (html.trim().startsWith('<')) {
    element.outerHTML = html;
  } else {
    element.innerHTML = html;
  }
}

function handleStateSync(data: Uint8Array): void {
  const componentIdLen = data[1];
  const componentId = decoder.decode(data.subarray(2, 2 + componentIdLen));
  let offset = 2 + componentIdLen;
  const keyLen = data[offset++];
  const key = decoder.decode(data.subarray(offset, offset + keyLen));
  offset += keyLen;
  const value = JSON.parse(decoder.decode(data.subarray(offset)));
  const stateKey = `${componentId}:${key}`;
  const previous = stateCache.get(stateKey);
  stateCache.set(stateKey, value);
  stateHydratedKeys.add(stateKey);
  const callbacks = stateSyncCallbacks.get(stateKey);
  callbacks?.forEach((callback) => callback(value, previous));

  if (!componentRegistry.has(componentId)) return;
  const entry = componentRegistry.get(componentId);
  const renderFn = (entry.result as any)?.render;
  if (typeof renderFn === 'function') {
    renderFn.call(entry.result as any);
  }
}

function handleComponentSnapshot(data: Uint8Array): void {
  const componentIdLen = data[1];
  const componentId = decoder.decode(data.subarray(2, 2 + componentIdLen));
  if (!componentRegistry.has(componentId)) return;

  let offset = 2 + componentIdLen;
  const [decoded] = decodeRpcValue(data, offset);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return;

  const entry = componentRegistry.get(componentId);
  applyComponentSnapshot(entry.result as Record<string, unknown>, decoded as Record<string, unknown>);

  const renderFn = (entry.result as any)?.render;
  if (typeof renderFn === 'function') {
    renderFn.call(entry.result as any);
  }
}

function invokeClientMethod(componentId: string, methodName: string, decoded: unknown): unknown {
  const entry = componentRegistry.get(componentId);
  const instance = entry.result as Record<string, unknown>;
  const fn = instance[methodName];
  if (typeof fn !== 'function') {
    throw new Error(`Method not found: ${componentId}.${methodName}`);
  }
  if (decoded == null) return (fn as Function).call(instance);
  if (Array.isArray(decoded)) return (fn as Function).call(instance, ...decoded);
  if (typeof decoded === 'object' && (fn as Function).length > 1) return (fn as Function).call(instance, ...Object.values(decoded as Record<string, unknown>));
  return (fn as Function).call(instance, decoded);
}

function handleRpcFromServer(data: Uint8Array): void {
  const { componentId, methodName, args } = decodeRpcCallMessage(data, nojsxWSEvent.RPC_CALL_S2C);
  invokeClientMethod(componentId, methodName, args);
}

async function handleRpcAwaitFromServer(data: Uint8Array): Promise<void> {
  const { requestId, componentId, methodName, args } = decodeRpcAwaitMessage(data, nojsxWSEvent.RPC_CALL_AWAIT_S2C);

  try {
    const result = await invokeClientMethod(componentId, methodName, args);
    sendRpcReturnToServer(requestId, true, result ?? null);
  } catch (error) {
    sendRpcReturnToServer(requestId, false, String((error as Error)?.message ?? error));
  }
}

function handleRpcReturnFromServer(data: Uint8Array): void {
  const { requestId, ok } = decodeRpcReturnMessage(data, nojsxWSEvent.RPC_RETURN_S2C);
  let payload: unknown;
  try {
    ({ payload } = decodeRpcReturnMessage(data, nojsxWSEvent.RPC_RETURN_S2C));
  } catch (error) {
    payload = String((error as Error)?.message ?? error);
  }

  const globals = globalThis as unknown as nojsxGlobals;
  const pending = globals.__nojsxRpcPending;
  const entry = pending?.get(requestId);
  if (!entry) return;
  pending?.delete(requestId);
  if (ok) entry.resolve(payload);
  else entry.reject(payload);
}

export function clientHandleMessage(data: Uint8Array): void {
  if (data.length === 0) return;
  switch (data[0]) {
    case nojsxWSEvent.RenderComponent_S2C:
      handleRenderComponent(data);
      break;
    case nojsxWSEvent.UpdateHtml_S2C:
      handleUpdateHtml(data);
      break;
    case nojsxWSEvent.StateSync_S2C:
      handleStateSync(data);
      break;
    case nojsxWSEvent.ComponentSnapshot_S2C:
      handleComponentSnapshot(data);
      break;
    case nojsxWSEvent.RPC_CALL_S2C:
      handleRpcFromServer(data);
      break;
    case nojsxWSEvent.RPC_CALL_AWAIT_S2C:
      void handleRpcAwaitFromServer(data);
      break;
    case nojsxWSEvent.RPC_RETURN_S2C:
      handleRpcReturnFromServer(data);
      break;
  }
}
