import { NComponent } from "../components/components";

export type NonFunctionPropertyNames<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

export type ComponentSnapshot<T extends NComponent> = Pick<T, NonFunctionPropertyNames<T>>;

type SnapshotRecord = Record<string, unknown>;
const renderRelevantSnapshotKeysByInstance = new WeakMap<NComponent, ReadonlySet<string>>();

function isEqualSnapshotValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!isEqualSnapshotValue(a[i], b[i])) return false;
    }
    return true;
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    const aView = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const bView = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    if (aView.length !== bView.length) return false;
    for (let i = 0; i < aView.length; i += 1) {
      if (aView[i] !== bView[i]) return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!(key in b)) return false;
      if (!isEqualSnapshotValue(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

export function areSnapshotsEqual(a: unknown, b: unknown): boolean {
  return isEqualSnapshotValue(a, b);
}

type TrackedSnapshotProperty = {
  key: string;
  configurable: boolean;
  enumerable: boolean;
  writable: boolean;
  value: unknown;
};

export function captureRenderRelevantSnapshotKeys<T>(instance: NComponent, render: () => T): T {
  const trackedKeys = new Set<string>();
  const descriptors = new Map<string, TrackedSnapshotProperty>();

  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(instance))) {
    if (excludedSnapshotKeys.has(key)) continue;
    if (!('value' in descriptor)) continue;
    if (typeof descriptor.value === 'function') continue;
    if (!descriptor.configurable) continue;

    let currentValue = descriptor.value;
    descriptors.set(key, {
      key,
      configurable: descriptor.configurable ?? true,
      enumerable: descriptor.enumerable ?? true,
      writable: descriptor.writable ?? true,
      value: currentValue,
    });

    Object.defineProperty(instance, key, {
      configurable: true,
      enumerable: descriptor.enumerable ?? true,
      get() {
        trackedKeys.add(key);
        return currentValue;
      },
      set(value: unknown) {
        currentValue = value;
      },
    });
  }

  try {
    return render();
  } finally {
    for (const descriptor of descriptors.values()) {
      Object.defineProperty(instance, descriptor.key, {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        writable: descriptor.writable,
        value: (instance as SnapshotRecord)[descriptor.key],
      });
    }
    renderRelevantSnapshotKeysByInstance.set(instance, trackedKeys);
  }
}

function getRenderRelevantSnapshotKeys(instance: NComponent): ReadonlySet<string> {
  return renderRelevantSnapshotKeysByInstance.get(instance) ?? new Set<string>();
}

export function classifySnapshotChange<T extends NComponent>(
  instance: T,
  previous: Partial<ComponentSnapshot<T>> | null | undefined,
  next: Partial<ComponentSnapshot<T>> | null | undefined,
): 'none' | 'sync-only' | 'render' {
  if (areSnapshotsEqual(previous, next)) return 'none';
  const prevRecord = (previous ?? {}) as SnapshotRecord;
  const nextRecord = (next ?? {}) as SnapshotRecord;
  const keys = new Set([...Object.keys(prevRecord), ...Object.keys(nextRecord)]);
  const renderRelevantKeys = getRenderRelevantSnapshotKeys(instance);

  for (const key of keys) {
    if (isEqualSnapshotValue(prevRecord[key], nextRecord[key])) continue;
    if (renderRelevantKeys.has(key)) return 'render';
  }

  return 'sync-only';
}

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