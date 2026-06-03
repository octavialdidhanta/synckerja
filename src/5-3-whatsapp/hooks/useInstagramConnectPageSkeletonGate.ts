import { useStickyPageSkeletonGate } from "@/shared/hooks/useStickyPageSkeletonGate";

/**
 * Skeleton overlay for blocking loads only. After first hide, does not re-show on later
 * `blockingPending` spikes (e.g. ensureInstagramVerifyToken) — avoids flicker on tab return.
 */
export function useInstagramConnectPageSkeletonGate(blockingPending: boolean): boolean {
  return useStickyPageSkeletonGate(blockingPending);
}
