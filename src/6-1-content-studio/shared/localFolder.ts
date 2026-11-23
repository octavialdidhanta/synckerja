/**
 * Reads original files straight from a folder on the laptop.
 * The browser asks once for the folder (File System Access API, Chrome/Edge);
 * the handle is kept in IndexedDB so later visits only need a permission click.
 * Nothing is uploaded.
 */

const DB_NAME = "synckerja_content_studio";
const STORE = "kv";

type Perm = "granted" | "denied" | "prompt";

export interface DirHandle {
  name: string;
  kind: "directory";
  getDirectoryHandle(name: string): Promise<DirHandle>;
  getFileHandle(name: string): Promise<{ getFile(): Promise<File> }>;
  entries?(): AsyncIterableIterator<[string, { kind: "file" | "directory"; name: string }]>;
  queryPermission?(opts: { mode: "read" }): Promise<Perm>;
  requestPermission?(opts: { mode: "read" }): Promise<Perm>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { id?: string; mode?: "read" | "readwrite" }) => Promise<DirHandle>;
};

export type FolderState = "unsupported" | "none" | "needs-permission" | "ready";

export const localFolderSupported = (): boolean =>
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

export interface LocalFolder {
  load(): Promise<{ state: FolderState; name: string | null }>;
  /** Must run inside a click. Asks for permission again, or opens the folder picker. */
  connect(forcePick?: boolean): Promise<{ state: FolderState; name: string | null }>;
  /** Resolves a relative path such as "PIK1/sate babi/clip.mp4" inside the chosen folder. */
  open(relPath: string): Promise<File>;
  /** File names directly inside the chosen folder. */
  listFiles(): Promise<string[]>;
}

const NO_ORG: LocalFolder = {
  load: async () => ({ state: localFolderSupported() ? "none" : "unsupported", name: null }),
  connect: async () => ({ state: localFolderSupported() ? "none" : "unsupported", name: null }),
  open: async () => {
    throw new Error("no-folder");
  },
  listFiles: async () => [],
};

/**
 * One remembered folder per kind (bank-footage, referensi …) and per organization:
 * a folder picked in one org never shows up in another org.
 */
export function createLocalFolder(kind: string, pickerId: string): (organizationId: string | null | undefined) => LocalFolder {
  const byOrg = new Map<string, LocalFolder>();
  return (organizationId) => {
    if (!organizationId) return NO_ORG;
    let f = byOrg.get(organizationId);
    if (!f) {
      f = folderFor(`${kind}:${organizationId}`, `${pickerId}_${organizationId.slice(0, 8)}`);
      byOrg.set(organizationId, f);
    }
    return f;
  };
}

function folderFor(storageKey: string, pickerId: string): LocalFolder {
  let dir: DirHandle | null = null;

  const load: LocalFolder["load"] = async () => {
    if (!localFolderSupported()) return { state: "unsupported", name: null };
    if (!dir) dir = await kvGet<DirHandle>(storageKey);
    if (!dir) return { state: "none", name: null };
    const p = (await dir.queryPermission?.({ mode: "read" })) ?? "granted";
    return { state: p === "granted" ? "ready" : "needs-permission", name: dir.name };
  };

  const connect: LocalFolder["connect"] = async (forcePick = false) => {
    if (!localFolderSupported()) return { state: "unsupported", name: null };
    if (!forcePick && dir) {
      const p = (await dir.requestPermission?.({ mode: "read" })) ?? "granted";
      if (p === "granted") return { state: "ready", name: dir.name };
    }
    try {
      const picked = await (window as PickerWindow).showDirectoryPicker!({ id: pickerId, mode: "read" });
      dir = picked;
      await kvSet(storageKey, picked);
      return { state: "ready", name: picked.name };
    } catch {
      return load();
    }
  };

  const open: LocalFolder["open"] = async (relPath) => {
    if (!dir) throw new Error("no-folder");
    const parts = relPath.split(/[\\/]+/).filter(Boolean);
    if (!parts.length) throw new Error("not-found");
    let cur: DirHandle = dir;
    try {
      for (const p of parts.slice(0, -1)) cur = await cur.getDirectoryHandle(p);
      const fh = await cur.getFileHandle(parts[parts.length - 1]);
      return await fh.getFile();
    } catch {
      throw new Error("not-found");
    }
  };

  const listFiles: LocalFolder["listFiles"] = async () => {
    if (!dir?.entries) return [];
    const out: string[] = [];
    for await (const [name, h] of dir.entries()) if (h.kind === "file") out.push(name);
    return out.sort();
  };

  return { load, connect, open, listFiles };
}
