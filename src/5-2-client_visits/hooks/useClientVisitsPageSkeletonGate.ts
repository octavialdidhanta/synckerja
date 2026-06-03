import { useStickyPageSkeletonGate } from "@/shared/hooks/useStickyPageSkeletonGate";

export function useClientVisitsPageSkeletonGate(rawPending: boolean): boolean {
  return useStickyPageSkeletonGate(rawPending);
}
