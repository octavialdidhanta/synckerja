/**
 * Node 25+ ships its own Web Storage globals. Without `--localstorage-file`
 * they come back undefined and shadow jsdom's, so tests calling
 * `localStorage.clear()` crash on Node 25/26. When storage is missing or
 * unusable, install a small in-memory Storage so tests behave the same on every Node version.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function storageWorks(name: "localStorage" | "sessionStorage"): boolean {
  try {
    const storage = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
    if (!storage || typeof storage.clear !== "function") return false;
    const probe = "__vitest_storage_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (storageWorks(name)) continue;
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
  if (typeof window !== "undefined" && window !== globalThis) {
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
  }
}
