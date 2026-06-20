import { useStickyPageSkeletonGate } from '@/shared/hooks/useStickyPageSkeletonGate';

export function useFacebookConnectPageSkeletonGate(blockingPending: boolean): boolean {
  return useStickyPageSkeletonGate(blockingPending);
}
