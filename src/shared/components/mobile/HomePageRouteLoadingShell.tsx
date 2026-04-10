import { HomePageSkeleton } from "@/1-home/skeletons/HomePageSkeleton";
import { AbsensiPageSkeleton } from "@/mobile/1-home/pages/AbsensiPageSkeleton";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";

/**
 * `/` guard loading: desktop `HomePageSkeleton`; mobile `AbsensiPageSkeleton` (same as Suspense fallback).
 */
export function HomePageRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();

  if (isDesktop) {
    return <HomePageSkeleton />;
  }

  return <AbsensiPageSkeleton />;
}
