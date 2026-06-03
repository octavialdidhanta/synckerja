import { useStickyPageSkeletonGate } from "@/shared/hooks/useStickyPageSkeletonGate";

export function useVisitSchedulingPageSkeletonGate(rawPending: boolean): boolean {
  return useStickyPageSkeletonGate(rawPending);
}
