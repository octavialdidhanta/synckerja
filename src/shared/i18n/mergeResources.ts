/** Utilities to merge nested JSON resources with flat dot-key dictionaries (legacy TS bundle). */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Turn `"sidebar.home.title"` → nested `{ sidebar: { home: { title: "..." } } }` for i18next.
 * Deeper keys are applied first so a short scalar key (e.g. `incomes.transaction`) cannot
 * overwrite an existing namespace (e.g. `foo.bar.baz.*`).
 */
export function flatTranslationRecordToNested(flat: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const entries = Object.entries(flat).sort(
    ([a], [b]) => b.split(".").filter(Boolean).length - a.split(".").filter(Boolean).length,
  );

  for (const [key, value] of entries) {
    const parts = key.split(".").filter(Boolean);
    if (parts.length === 0) continue;
    let cur: Record<string, unknown> = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      const existing = cur[p];
      if (!isPlainObject(existing)) {
        cur[p] = {};
      }
      cur = cur[p] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    const existing = cur[leaf];
    if (isPlainObject(existing)) {
      continue;
    }
    cur[leaf] = value;
  }
  return root;
}

/** Deep-merge objects; override wins. Arrays and primitives replace wholesale. */
export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(result[k])) {
      result[k] = deepMerge(result[k] as Record<string, unknown>, v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function cloneJsonResource<T>(data: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data)) as T;
}
