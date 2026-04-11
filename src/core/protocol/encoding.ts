import { TypedArrayType, type TypedArrayTypes } from './types.js';

export function getTypedArrayType(data: TypedArrayTypes): TypedArrayType {
  if (data instanceof Uint8Array) return TypedArrayType.Uint8;
  if (data instanceof Uint16Array) return TypedArrayType.Uint16;
  if (data instanceof Uint32Array) return TypedArrayType.Uint32;
  if (data instanceof Int8Array) return TypedArrayType.Int8;
  if (data instanceof Int16Array) return TypedArrayType.Int16;
  if (data instanceof Int32Array) return TypedArrayType.Int32;
  if (data instanceof Float32Array) return TypedArrayType.Float32;
  if (data instanceof Float64Array) return TypedArrayType.Float64;
  return TypedArrayType.Uint8;
}

export function toUint8Array(data: TypedArrayTypes): Uint8Array {
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export function createTypedArray(
  buffer: ArrayBufferLike,
  byteOffset: number,
  byteLength: number,
  type: TypedArrayType,
): TypedArrayTypes {
  const bytesPerElement =
    type === TypedArrayType.Uint8 || type === TypedArrayType.Int8 ? 1 :
    type === TypedArrayType.Uint16 || type === TypedArrayType.Int16 ? 2 :
    type === TypedArrayType.Uint32 || type === TypedArrayType.Int32 || type === TypedArrayType.Float32 ? 4 :
    type === TypedArrayType.Float64 ? 8 :
    1;

  if (bytesPerElement > 1) {
    if (byteLength % bytesPerElement !== 0) {
      throw new RangeError(`Invalid typed array byteLength ${byteLength} for element size ${bytesPerElement}`);
    }
    if ((byteOffset % bytesPerElement) !== 0) {
      const tmp = new ArrayBuffer(byteLength);
      new Uint8Array(tmp).set(new Uint8Array(buffer, byteOffset, byteLength));
      buffer = tmp;
      byteOffset = 0;
    }
  }

  switch (type) {
    case TypedArrayType.Uint8:
      return new Uint8Array(buffer, byteOffset, byteLength);
    case TypedArrayType.Uint16:
      return new Uint16Array(buffer, byteOffset, byteLength / 2);
    case TypedArrayType.Uint32:
      return new Uint32Array(buffer, byteOffset, byteLength / 4);
    case TypedArrayType.Int8:
      return new Int8Array(buffer, byteOffset, byteLength);
    case TypedArrayType.Int16:
      return new Int16Array(buffer, byteOffset, byteLength / 2);
    case TypedArrayType.Int32:
      return new Int32Array(buffer, byteOffset, byteLength / 4);
    case TypedArrayType.Float32:
      return new Float32Array(buffer, byteOffset, byteLength / 4);
    case TypedArrayType.Float64:
      return new Float64Array(buffer, byteOffset, byteLength / 8);
    default:
      return new Uint8Array(buffer, byteOffset, byteLength);
  }
}
