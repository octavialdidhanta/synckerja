import { lazy, Suspense, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { HomePageSkeleton } from "@/1-home/skeletons/HomePageSkeleton";
import { AbsensiPageSkeleton } from "@/mobile/1-home/pages/AbsensiPageSkeleton";

const MobileAbsensi = lazy(() => import("@/mobile/1-home/pages/Absensi"));
const MobileSchedule = lazy(() => import("@/mobile/1-schedule/pages/Schedule"));
const MobileClientVisit = lazy(() => import("@/mobile/1-client-visit/pages/ClientVisit"));
const MobileAttendanceReports = lazy(() => import("@/mobile/1-reports/pages/Reports"));
const MobileProfileParity = lazy(() => import("@/mobile/1-profile/pages/Profile"));
const DesktopModernHomePage = lazy(() => import("@/1-home/pages/ModernHomePage"));
const DesktopProfileSettings = lazy(() =>
  import("@/1-home/settings").then((m) => ({ default: m.ProfileSettings })),
);

function MobileParitySuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-background" aria-busy>
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function MobileHomeSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AbsensiPageSkeleton />}>{children}</Suspense>
  );
}

export function HomeRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return (
      <Suspense fallback={<HomePageSkeleton />}>
        <DesktopModernHomePage />
      </Suspense>
    );
  }
  return (
    <MobileHomeSuspense>
      <MobileAbsensi />
    </MobileHomeSuspense>
  );
}

export function ScheduleRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) return <Navigate to="/operations/sales/jadwal-kunjungan" replace />;
  return (
    <MobileParitySuspense>
      <MobileSchedule />
    </MobileParitySuspense>
  );
}

export function ClientVisitRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) return <Navigate to="/operations/sales/client-visits" replace />;
  return (
    <MobileParitySuspense>
      <MobileClientVisit />
    </MobileParitySuspense>
  );
}

/** Bottom nav "Reports" — attendance (reference mobile), not Daily Task Report. */
export function MobileAttendanceReportsRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) return <Navigate to="/attendance" replace />;
  return (
    <MobileParitySuspense>
      <MobileAttendanceReports />
    </MobileParitySuspense>
  );
}

export function ProfileRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return (
      <MobileParitySuspense>
        <DesktopProfileSettings />
      </MobileParitySuspense>
    );
  }
  return (
    <MobileParitySuspense>
      <MobileProfileParity />
    </MobileParitySuspense>
  );
}

/** Canonical `/profile` for bottom nav; desktop users go to settings profile. */
export function ProfileTabRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) return <Navigate to="/settings/profile" replace />;
  return (
    <MobileParitySuspense>
      <MobileProfileParity />
    </MobileParitySuspense>
  );
}
