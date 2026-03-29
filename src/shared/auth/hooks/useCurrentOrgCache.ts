const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getLocalStorageCache = (key: string): string | null => {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) return data;
    }
  } catch {
    // ignore
  }
  return null;
};

const setLocalStorageCache = (key: string, data: string | null): void => {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // ignore
  }
};

const orgCache = new Map<string, { data: string | null; timestamp: number }>();

export function getCurrentOrgFromCache(): string | null {
  try {
    const keys = Object.keys(localStorage);
    const key = keys.find((k) => k.startsWith('org-cache-'));
    if (key) return getLocalStorageCache(key);
  } catch {
    // ignore
  }
  return null;
}

export function clearCurrentOrgCacheForUser(userId: string): void {
  orgCache.delete(`org-${userId}`);
  try {
    localStorage.removeItem(`org-cache-${userId}`);
  } catch {
    // ignore
  }
}

export function setCurrentOrgCacheForUser(userId: string, organizationId: string): void {
  const cacheKey = `org-${userId}`;
  const localStorageKey = `org-cache-${userId}`;
  orgCache.set(cacheKey, { data: organizationId, timestamp: Date.now() });
  setLocalStorageCache(localStorageKey, organizationId);
}
