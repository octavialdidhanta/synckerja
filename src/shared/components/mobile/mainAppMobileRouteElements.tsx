import { lazy, Suspense, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ModernHomePage } from "@/1-home";
import { ProfileSettings } from "@/1-home/settings";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { AbsensiPageSkeleton } from "@/mobile/1-home/pages/AbsensiPageSkeleton";

const MobileAbsensi = lazy(() => import("@/mobile/1-home/pages/Absensi"));
const MobileSchedule = lazy(() => import("@/mobile/1-schedule/pages/Schedule"));
const MobileClientVisit = lazy(() => import("@/mobile/1-client-visit/pages/ClientVisit"));
const MobileAttendanceReports = lazy(() => import("@/mobile/1-reports/pages/Reports"));
const MobileProfileParity = lazy(() => import("@/mobile/1-profile/pages/Profile"));

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
  if (isDesktop) return <ModernHomePage />;
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
  if (isDesktop) return <ProfileSettings />;
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
