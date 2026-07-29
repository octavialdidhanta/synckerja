const STORAGE_PREFIX = "share.publish.mentionRecents.";
const MAX_RECENTS = 24;

function storageKey(organizationId: string): string {
  return `${STORAGE_PREFIX}${organizationId}`;
}

/** Normalize handle without leading @; lowercase for storage key, keep display casing from first save. */
export function normalizeMentionHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/\s+/g, "");
}

export function readMentionRecents(organizationId: string | null | undefined): string[] {
  if (!organizationId || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map(normalizeMentionHandle)
      .filter(Boolean)
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function rememberMentionHandle(
  organizationId: string | null | undefined,
  handle: string,
): string[] {
  if (!organizationId || typeof localStorage === "undefined") return [];
  const normalized = normalizeMentionHandle(handle);
  if (!normalized) return readMentionRecents(organizationId);

  const prev = readMentionRecents(organizationId);
  const next = [
    normalized,
    ...prev.filter((h) => h.toLowerCase() !== normalized.toLowerCase()),
  ].slice(0, MAX_RECENTS);

  try {
    localStorage.setItem(storageKey(organizationId), JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  return next;
}

export function filterMentionHandles(handles: string[], query: string): string[] {
  const q = normalizeMentionHandle(query).toLowerCase();
  if (!q) return handles.slice(0, 8);
  return handles
    .filter((h) => h.toLowerCase().includes(q))
    .slice(0, 8);
}
