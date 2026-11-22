/**
 * Plays original footage straight from the laptop bank-footage folder.
 * The browser asks once for the folder (File System Access API, Chrome/Edge);
 * the handle is kept in IndexedDB so later visits only need a permission click.
 * Nothing is uploaded.
 */

const DB_NAME = "synckerja_content_studio";
const STORE = "kv";
const KEY = "bank_footage_dir";

type Perm = "granted" | "denied" | "prompt";

interface DirHandle {
  name: string;
  kind: "directory";
  getDirectoryHandle(name: string): Promise<DirHandle>;
  getFileHandle(name: string): Promise<{ getFile(): Promise<File> }>;
  queryPermission?(opts: { mode: "read" }): Promise<Perm>;
  requestPermission?(opts: { mode: "read" }): Promise<Perm>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { id?: string; mode?: "read" | "readwrite" }) => Promise<DirHandle>;
};

export const localBankSupported = (): boolean =>
  typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve((r.result as T) ?? null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
  } catch {
    /* storage can be blocked; the user just picks the folder again next time */
  }
}

let dir: DirHandle | null = null;

export type BankState = "unsupported" | "none" | "needs-permission" | "ready";

export async function loadBankState(): Promise<{ state: BankState; name: string | null }> {
  if (!localBankSupported()) return { state: "unsupported", name: null };
  if (!dir) dir = await kvGet<DirHandle>(KEY);
  if (!dir) return { state: "none", name: null };
  const p = (await dir.queryPermission?.({ mode: "read" })) ?? "granted";
  return { state: p === "granted" ? "ready" : "needs-permission", name: dir.name };
}

/** Must run inside a click. Asks for permission again, or opens the folder picker. */
export async function connectBank(forcePick = false): Promise<{ state: BankState; name: string | null }> {
  if (!localBankSupported()) return { state: "unsupported", name: null };
  if (!forcePick && dir) {
    const p = (await dir.requestPermission?.({ mode: "read" })) ?? "granted";
    if (p === "granted") return { state: "ready", name: dir.name };
  }
  try {
    const picked = await (window as PickerWindow).showDirectoryPicker!({ id: "bank_footage", mode: "read" });
    dir = picked;
    await kvSet(KEY, picked);
    return { state: "ready", name: picked.name };
  } catch {
    return loadBankState();
  }
}

/** Resolves a file_key such as "PIK1/sate babi/clip.mp4" inside the chosen folder. */
export async function openBankFile(fileKey: string): Promise<File> {
  if (!dir) throw new Error("no-folder");
  const parts = fileKey.split(/[\\/]+/).filter(Boolean);
  if (!parts.length) throw new Error("not-found");
  let cur: DirHandle = dir;
  try {
    for (const p of parts.slice(0, -1)) cur = await cur.getDirectoryHandle(p);
    const fh = await cur.getFileHandle(parts[parts.length - 1]);
    return await fh.getFile();
  } catch {
    throw new Error("not-found");
  }
}
