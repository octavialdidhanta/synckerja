import { logger } from "@/shared/lib/logger";

/** Shared page-access result cache (used by useDepartmentAccess + permission mutations). */
export const accessCache = new Map<
  string,
  { result: boolean; timestamp: number; configHash: string }
>();

export const ACCESS_CACHE_TTL = 30000;

let lastClearTime = 0;
const MIN_CLEAR_INTERVAL = 5000;

/** Clear cached canAccessPage results when permission config changes. */
export const clearAccessCache = () => {
  const now = Date.now();
  if (now - lastClearTime < MIN_CLEAR_INTERVAL) {
    return;
  }
  accessCache.clear();
  lastClearTime = now;
};

export const debugAccessCache = () => {
  logger.debug("Access Cache Debug:");
  logger.debug("Cache size:", accessCache.size);
  accessCache.forEach((value, key) => {
    logger.debug(`  ${key}:`, value);
  });
};

export const forceClearCache = () => {
  accessCache.clear();
};

if (typeof window !== "undefined") {
  (window as unknown as { debugAccessCache?: typeof debugAccessCache }).debugAccessCache =
    debugAccessCache;
  (window as unknown as { forceClearCache?: typeof forceClearCache }).forceClearCache =
    forceClearCache;
  (window as unknown as { clearAccessCache?: typeof clearAccessCache }).clearAccessCache =
    clearAccessCache;
}
