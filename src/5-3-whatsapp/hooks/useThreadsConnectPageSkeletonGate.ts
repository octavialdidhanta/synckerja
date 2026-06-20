import { useStickyPageSkeletonGate } from '@/shared/hooks/useStickyPageSkeletonGate';

export function useThreadsConnectPageSkeletonGate(blockingPending: boolean): boolean {
  return useStickyPageSkeletonGate(blockingPending);
}
