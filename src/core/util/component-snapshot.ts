function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneSnapshotValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneSnapshotValue(entry)) as T;
  }
  if (ArrayBuffer.isView(value)) {
    const typed = value as unknown as { slice?: () => unknown };
    if (typeof typed.slice === 'function') {
      return typed.slice() as T;
    }
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = cloneSnapshotValue(entry);
    }
    return out as T;
  }
  return value;
}

const excludedSnapshotKeys = new Set([
  'id',
  'nContext',
  'parent',
  'children',
  'props',
  '__props',
  '__serverHandlers',
  '__mapped',
]);

export function createComponentSnapshot(instance: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(instance)) {
    if (excludedSnapshotKeys.has(key)) continue;
    if (typeof value === 'function') continue;
    out[key] = cloneSnapshotValue(value);
  }
  return out;
}

export function applyComponentSnapshot(instance: Record<string, unknown>, snapshot: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    instance[key] = cloneSnapshotValue(value);
  }
}