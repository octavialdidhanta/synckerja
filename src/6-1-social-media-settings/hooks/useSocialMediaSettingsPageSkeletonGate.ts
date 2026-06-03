import { useStickyPageSkeletonGate } from "@/shared/hooks/useStickyPageSkeletonGate";

export function useSocialMediaSettingsPageSkeletonGate(rawPending: boolean): boolean {
  return useStickyPageSkeletonGate(rawPending);
}
