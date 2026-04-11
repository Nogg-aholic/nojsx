import { TypedArrayType, type TypedArrayTypes } from './types.js';
import { createTypedArray, getTypedArrayType, toUint8Array } from './encoding.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export enum RpcArgTag {
  Null = 0x00,
  Undefined = 0x09,
  False = 0x01,
  True = 0x02,
  Float64 = 0x03,
  String = 0x04,
  TypedArray = 0x05,
  Array = 0x06,
  Object = 0x07,
  BigInt64 = 0x08,
}

function isTypedArray(value: unknown): value is TypedArrayTypes {
  return ArrayBuffer.isView(value) && (value as { buffer?: unknown }).buffer instanceof ArrayBuffer;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !isTypedArray(value);
}

function align8(n: number): number {
  return (n + 7) & ~7;
}

function measureInto(value: unknown, offset: number): number {
  if (value === null || value === undefined || value === false || value === true) return offset + 1;
  if (typeof value === 'number' || typeof value === 'bigint') return offset + 1 + 8;
  if (typeof value === 'string') {
    const bytes = encoder.encode(value);
    return offset + 1 + 4 + bytes.length;
  }
  if (isTypedArray(value)) {
    const payloadBytes = toUint8Array(value);
    let next = offset + 1 + 1 + 4;
    next = align8(next);
    return next + payloadBytes.length;
  }
  if (Array.isArray(value)) {
    let next = offset + 1 + 4;
    for (const entry of value) next = measureInto(entry, next);
    return next;
  }
  if (isPlainObject(value)) {
    let next = offset + 1 + 4;
    for (const [key, entry] of Object.entries(value)) {
      const keyBytes = encoder.encode(key);
      next += 2 + keyBytes.length;
      next = measureInto(entry, next);
    }
    return next;
  }
  throw new Error(`[RPC] Unsupported arg type: ${Object.prototype.toString.call(value)}`);
}

function writeU16(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeU32(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value >>> 0, true);
  return offset + 4;
}

function writeF64(view: DataView, offset: number, value: number): number {
  view.setFloat64(offset, value, true);
  return offset + 8;
}

function encodeInto(buf: Uint8Array, offset: number, value: unknown): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  if (value === null) {
    buf[offset++] = RpcArgTag.Null;
    return offset;
  }
  if (value === undefined) {
    buf[offset++] = RpcArgTag.Undefined;
    return offset;
  }
  if (value === false) {
    buf[offset++] = RpcArgTag.False;
    return offset;
  }
  if (value === true) {
    buf[offset++] = RpcArgTag.True;
    return offset;
  }
  if (typeof value === 'number') {
    buf[offset++] = RpcArgTag.Float64;
    return writeF64(view, offset, value);
  }
  if (typeof value === 'bigint') {
    buf[offset++] = RpcArgTag.BigInt64;
    view.setBigInt64(offset, value, true);
    return offset + 8;
  }
  if (typeof value === 'string') {
    buf[offset++] = RpcArgTag.String;
    const bytes = encoder.encode(value);
    offset = writeU32(view, offset, bytes.length);
    buf.set(bytes, offset);
    return offset + bytes.length;
  }
  if (isTypedArray(value)) {
    buf[offset++] = RpcArgTag.TypedArray;
    buf[offset++] = getTypedArrayType(value);
    const payloadBytes = toUint8Array(value);
    offset = writeU32(view, offset, payloadBytes.length);
    const aligned = align8(offset);
    buf.fill(0, offset, aligned);
    offset = aligned;
    buf.set(payloadBytes, offset);
    return offset + payloadBytes.length;
  }
  if (Array.isArray(value)) {
    buf[offset++] = RpcArgTag.Array;
    offset = writeU32(view, offset, value.length);
    for (const entry of value) offset = encodeInto(buf, offset, entry);
    return offset;
  }
  if (isPlainObject(value)) {
    buf[offset++] = RpcArgTag.Object;
    const entries = Object.entries(value);
    offset = writeU32(view, offset, entries.length);
    for (const [key, entry] of entries) {
      const keyBytes = encoder.encode(key);
      offset = writeU16(view, offset, keyBytes.length);
      buf.set(keyBytes, offset);
      offset += keyBytes.length;
      offset = encodeInto(buf, offset, entry);
    }
    return offset;
  }

  throw new Error(`[RPC] Unsupported arg type: ${Object.prototype.toString.call(value)}`);
}

export function encodeRpcValue(value: unknown): Uint8Array {
  const end = measureInto(value, 0);
  const buf = new Uint8Array(end);
  encodeInto(buf, 0, value);
  return buf;
}

function readU16(view: DataView, offset: number): [number, number] {
  return [view.getUint16(offset, true), offset + 2];
}

function readU32(view: DataView, offset: number): [number, number] {
  return [view.getUint32(offset, true), offset + 4];
}

function readF64(view: DataView, offset: number): [number, number] {
  return [view.getFloat64(offset, true), offset + 8];
}

export function decodeRpcValue(data: Uint8Array, offset: number): [unknown, number] {
  return decodeRpcValueInternal(data, offset, offset);
}

function decodeRpcValueInternal(data: Uint8Array, offset: number, baseOffset: number): [unknown, number] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = data[offset++] as RpcArgTag;

  switch (tag) {
    case RpcArgTag.Null:
      return [null, offset];
    case RpcArgTag.Undefined:
      return [undefined, offset];
    case RpcArgTag.False:
      return [false, offset];
    case RpcArgTag.True:
      return [true, offset];
    case RpcArgTag.Float64: {
      const [value, next] = readF64(view, offset);
      return [value, next];
    }
    case RpcArgTag.BigInt64:
      return [view.getBigInt64(offset, true), offset + 8];
    case RpcArgTag.String: {
      const [len, next] = readU32(view, offset);
      const start = next;
      const end = start + len;
      return [decoder.decode(data.subarray(start, end)), end];
    }
    case RpcArgTag.TypedArray: {
      const arrayType = data[offset++] as TypedArrayType;
      const [byteLen, next] = readU32(view, offset);
      offset = baseOffset + align8(next - baseOffset);
      const start = offset;
      const end = start + byteLen;
      return [createTypedArray(data.buffer, data.byteOffset + start, byteLen, arrayType), end];
    }
    case RpcArgTag.Array: {
      const [count, next] = readU32(view, offset);
      offset = next;
      const values = new Array(count);
      for (let index = 0; index < count; index += 1) {
        [values[index], offset] = decodeRpcValueInternal(data, offset, baseOffset);
      }
      return [values, offset];
    }
    case RpcArgTag.Object: {
      const [count, next] = readU32(view, offset);
      offset = next;
      const value: Record<string, unknown> = {};
      for (let index = 0; index < count; index += 1) {
        const [keyLen, keyNext] = readU16(view, offset);
        offset = keyNext;
        const key = decoder.decode(data.subarray(offset, offset + keyLen));
        offset += keyLen;
        [value[key], offset] = decodeRpcValueInternal(data, offset, baseOffset);
      }
      return [value, offset];
    }
    default:
      throw new Error(`[RPC] Unknown arg tag: ${tag}`);
  }
}
