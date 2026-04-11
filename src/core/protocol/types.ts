/**
 * Typed array identifiers for the binary RPC protocol.
 */
export enum TypedArrayType {
  Uint8 = 0,
  Uint16 = 1,
  Uint32 = 2,
  Int8 = 3,
  Int16 = 4,
  Int32 = 5,
  Float32 = 6,
  Float64 = 7,
}

export type TypedArrayTypes =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;
