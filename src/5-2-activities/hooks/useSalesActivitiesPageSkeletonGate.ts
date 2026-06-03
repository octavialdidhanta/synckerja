import { useStickyPageSkeletonGate } from "@/shared/hooks/useStickyPageSkeletonGate";

/** Debounce + rAF; no re-overlay after first reveal (tab/window refetch). */
export function useSalesActivitiesPageSkeletonGate(rawPending: boolean): boolean {
  return useStickyPageSkeletonGate(rawPending);
}
