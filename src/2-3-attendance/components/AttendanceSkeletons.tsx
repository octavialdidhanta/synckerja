import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useLocation } from "react-router-dom";

export type AttendanceSkeletonVariant = "dashboard" | "attendance" | "settings";

export function getAttendanceSkeletonVariant(pathname: string): AttendanceSkeletonVariant {
  if (pathname.includes("/attendance/settings")) return "settings";
  if (pathname.includes("/attendance/attendance")) return "attendance";
  return "dashboard";
}

function useAttendanceLoadingAria() {
  const { t } = useAppTranslation();
  return t("layout.attendanceModule.loadingAria", "Loading attendance");
}

function AttendanceHeaderSkeleton() {
  return (
    <div className="mb-1 shrink-0 px-1 py-3">
      <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
      <Skeleton className="mb-4 h-3 w-full max-w-xl" />
      <div className="border-border flex flex-wrap gap-4 border-b pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28" />
        ))}
      </div>
    </div>
  );
}

function DashboardBody() {
  return (
    <div className="border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border p-4 shadow-sm">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="min-h-0 flex-1 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

function RecordsBody() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
          <div className="mb-2 shrink-0 rounded-md border border-border bg-card p-2">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-full max-w-[200px]" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="col-span-12 flex min-h-0 flex-col xl:col-span-3">
          <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card p-4 shadow-sm">
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsBody() {
  return (
    <div className="border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border p-4 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

export function AttendanceModuleSkeleton({ variant }: { variant: AttendanceSkeletonVariant }) {
  const aria = useAttendanceLoadingAria();
  return (
    <div
      className="bg-background flex h-full min-h-0 min-w-0 flex-1 flex-col font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3">
        <AttendanceHeaderSkeleton />
        {variant === "dashboard" ? <DashboardBody /> : null}
        {variant === "attendance" ? <RecordsBody /> : null}
        {variant === "settings" ? <SettingsBody /> : null}
      </div>
    </div>
  );
}

/** Lazy-route Suspense fallback: path-aware shell (dashboard / records / settings). */
export function AttendanceRouteSkeleton() {
  const { pathname } = useLocation();
  const variant = getAttendanceSkeletonVariant(pathname);
  return <AttendanceModuleSkeleton variant={variant} />;
}
