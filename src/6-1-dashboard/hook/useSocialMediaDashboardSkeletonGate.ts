import { useStickyPageSkeletonGate } from "@/shared/hooks/useStickyPageSkeletonGate";

/**
 * While `rawPending` is true on first load, skeleton stays visible. After first reveal,
 * ignores later pending spikes (tab focus / background refetch).
 */
export function useSocialMediaDashboardSkeletonGate(rawPending: boolean): boolean {
  return useStickyPageSkeletonGate(rawPending);
}
