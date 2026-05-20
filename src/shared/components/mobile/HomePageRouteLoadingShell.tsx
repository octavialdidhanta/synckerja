import { lazy, Suspense } from "react";
import { RouteSkeletonBootShell } from "@/shared/components/route-loading/createDeferredSkeleton";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";

const HomePageSkeleton = lazy(() =>
  import("@/1-home/skeletons/HomePageSkeleton").then((m) => ({
    default: m.HomePageSkeleton,
  })),
);

const AbsensiPageSkeleton = lazy(() =>
  import("@/mobile/1-home/pages/AbsensiPageSkeleton").then((m) => ({
    default: m.AbsensiPageSkeleton,
  })),
);

/**
 * `/` guard loading: desktop `HomePageSkeleton`; mobile `AbsensiPageSkeleton` (same as Suspense fallback).
 */
export function HomePageRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();

  return (
    <Suspense fallback={<RouteSkeletonBootShell />}>
      {isDesktop ? <HomePageSkeleton /> : <AbsensiPageSkeleton />}
    </Suspense>
  );
}
