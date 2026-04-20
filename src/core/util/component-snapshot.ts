import { NComponent } from "../components/components";

export type NonFunctionPropertyNames<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

export type ComponentSnapshot<T extends NComponent> = Pick<T, NonFunctionPropertyNames<T>>;

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

export function createComponentSnapshot<T extends NComponent>(instance: T): Partial<ComponentSnapshot<T>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(instance)) {
    if (excludedSnapshotKeys.has(key)) continue;
    if (typeof value === 'function') continue;
    out[key] = cloneSnapshotValue(value);
  }
  return out as Partial<ComponentSnapshot<T>>;
}

export function applyComponentSnapshot<T extends NComponent>(instance: T, snapshot: Partial<ComponentSnapshot<T>>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    instance[key as keyof T] = cloneSnapshotValue(value) as T[keyof T];
  }
}