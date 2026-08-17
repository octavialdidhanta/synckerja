import { useStickyPageSkeletonGate } from '@/shared/hooks/useStickyPageSkeletonGate';

export function useCustomerVisitsPageSkeletonGate(rawPending: boolean): boolean {
  return useStickyPageSkeletonGate(rawPending);
}
