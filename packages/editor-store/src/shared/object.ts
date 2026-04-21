export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMerge<T>(base: T, incoming: unknown): T {
  if (incoming === undefined) {
    return base;
  }

  if (Array.isArray(base) && Array.isArray(incoming)) {
    return incoming as T;
  }

  if (isPlainObject(base) && isPlainObject(incoming)) {
    const result: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(incoming)) {
      result[key] = deepMerge(result[key as keyof typeof result], value);
    }

    return result as T;
  }

  return incoming as T;
}

export function setValueAtPath<T extends object>(
  target: T,
  path: string | string[],
  value: unknown,
): T {
  const segments = Array.isArray(path) ? path : path.split(".");

  if (segments.length === 0) {
    return target;
  }

  const root = cloneValue(target) as Record<string, unknown>;
  let cursor: Record<string, unknown> = root;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const nextValue = cursor[segment];

    if (!isPlainObject(nextValue)) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]!] = value;

  return root as T;
}
