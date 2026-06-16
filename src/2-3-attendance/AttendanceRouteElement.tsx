import { Suspense, lazy, type ReactNode } from "react";
import { PageAccessGuard } from "@/shared/components/PageAccessGuard";
import {
  AttendanceGuardLoadingShell,
  AttendanceRouteSkeleton,
} from "./components/AttendanceSkeletons";

const AttendancePage = lazy(() => import("./AttendancePage"));

const ATTENDANCE_LOADING_SHELL: ReactNode = (
  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
    <AttendanceRouteSkeleton />
  </div>
);

/** Guard + chunk Suspense share the same layout-matched attendance skeleton (no flicker on hard refresh). */
export function AttendanceRouteElement() {
  return (
    <PageAccessGuard
      loadingShell={<AttendanceGuardLoadingShell />}
      loadingShellWrapperClassName="bg-gray-100"
    >
      <Suspense fallback={ATTENDANCE_LOADING_SHELL}>
        <AttendancePage />
      </Suspense>
    </PageAccessGuard>
  );
}
