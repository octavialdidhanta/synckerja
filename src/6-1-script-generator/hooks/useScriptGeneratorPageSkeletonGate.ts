import { useStickyPageSkeletonGate } from '@/shared/hooks/useStickyPageSkeletonGate';

export function useScriptGeneratorPageSkeletonGate(rawPending: boolean): boolean {
  return useStickyPageSkeletonGate(rawPending);
}
