import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import {
  ATTENDANCE_FULL_COLUMN,
  ATTENDANCE_MAIN_GRID,
  ATTENDANCE_TABLE_SECTION,
} from "../layout/attendanceLayout";
import {
  ATTENDANCE_SETTINGS_CARD_FOOTER,
  ATTENDANCE_SETTINGS_CARD_HEADER,
  ATTENDANCE_SETTINGS_GRID,
  ATTENDANCE_SETTINGS_MAIN_COLUMN,
  ATTENDANCE_SETTINGS_NAV_COLUMN,
  ATTENDANCE_SETTINGS_SCROLL_PANE,
  ATTENDANCE_SETTINGS_TABLE_SECTION,
} from "../layout/attendanceSettingsLayout";

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

/** Mirrors `HeaderAndTab`: title, subtitle, `nav` with `space-x-6` tab row (no container border-b). */
function AttendanceHeaderSkeleton() {
  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <Skeleton className="mb-0.5 h-7 w-64 max-w-[90%]" />
        <Skeleton className="h-3 w-full max-w-xl" />
      </div>
      <div className="-mb-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}

/** One penalty / metric card: label, value, subline + icon (matches PenaltyStatistics cards). */
function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-20 max-w-full" />
          <Skeleton className="h-3 w-36 max-w-full" />
        </div>
        <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

/** Compact metric (matches AttendanceAnalyticsDashboard overview cards). */
function AnalyticsMetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
      </div>
      <div className="px-4 pb-4">
        <Skeleton className="mb-1 h-8 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/**
 * Mirrors `DashboardOverview` inside `AttendanceWorkspace`: metrics + charts + panel footer.
 */
function DashboardBody() {
  return (
    <div className={ATTENDANCE_TABLE_SECTION}>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-4">
          {/* PenaltyStatistics: grid-cols-4 */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>

          {/* RecentPenaltiesWidget (1) + PenaltyTrendsChart (2) */}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="flex h-full min-h-[220px] flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="flex-1 space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-[85%] max-w-[200px]" />
                        <Skeleton className="h-3 w-[55%] max-w-[140px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="flex h-full min-h-[220px] flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <Skeleton className="mb-1 h-5 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex flex-1 flex-col justify-end p-4 pt-2">
                  <Skeleton className="h-48 w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>

          {/* AttendanceAnalyticsDashboard: 4 overview cards */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <AnalyticsMetricCardSkeleton key={i} />
            ))}
          </div>

          {/* Weekly trend + pie / distribution */}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[320px] flex-col rounded-lg border border-border bg-card shadow-sm"
              >
                <div className="border-b border-border px-4 py-3">
                  <Skeleton className="mb-1 h-5 w-48" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
                <div className="flex flex-1 items-center justify-center p-4">
                  <Skeleton className="h-[260px] w-full max-w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-44 max-w-[55%]" />
            <Skeleton className="h-3 w-24 max-w-[40%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Matches `AttendanceToolbar`: search + status + date + reset. */
function RecordsToolbarSkeleton() {
  return (
    <div className="bg-card mb-2 shrink-0 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-1">
        <Skeleton className="h-9 min-w-[200px] flex-1 rounded-md" />
        <Skeleton className="h-9 w-full rounded-md sm:w-40" />
        <Skeleton className="h-9 min-w-[140px] rounded-md sm:min-w-[180px]" />
        <div className="ml-auto flex items-center gap-1.5">
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors `AttendanceCalendarView`: month nav + legend + day grid (calendar view). */
function RecordsCalendarMainSkeleton() {
  return (
    <div className="bg-card flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-6 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square min-h-[2.5rem] rounded-md border border-border/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mirrors `EnhancedAttendanceSidebar` “Live Analytics” card + scroll area. */
function RecordsSidebarSkeleton() {
  return (
    <div className="h-full min-h-0 px-4 py-4 sm:px-6">
      <div className="space-y-2">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-3 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="bg-success h-2 w-2 rounded-full opacity-50" />
            </div>
          </div>
          <div className="space-y-2 px-3 pb-3">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-success-muted relative rounded p-1.5 text-center">
                <Skeleton className="mx-auto h-6 w-10 bg-background/50" />
                <Skeleton className="mx-auto mt-1 h-3 w-12 bg-background/50" />
              </div>
              <div className="bg-warning-muted rounded p-1.5 text-center">
                <Skeleton className="mx-auto h-6 w-10 bg-background/50" />
                <Skeleton className="mx-auto mt-1 h-3 w-10 bg-background/50" />
              </div>
              <div className="bg-destructive/10 rounded p-1.5 text-center">
                <Skeleton className="mx-auto h-6 w-10 bg-background/50" />
                <Skeleton className="mx-auto mt-1 h-3 w-12 bg-background/50" />
              </div>
              <div className="bg-info-muted rounded p-1.5 text-center">
                <Skeleton className="mx-auto h-6 w-10 bg-background/50" />
                <Skeleton className="mx-auto mt-1 h-3 w-9 bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <Skeleton className="mb-2 h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full max-w-[200px]" />
              <Skeleton className="h-3 w-full max-w-[120px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** `/attendance/attendance` — mirrors `EmployeeAttendanceTab` layout (calendar + sidebar + footers). */
function RecordsBody() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
          <RecordsToolbarSkeleton />
          <div className={ATTENDANCE_TABLE_SECTION}>
            <div className="bg-card flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4">
                <RecordsCalendarMainSkeleton />
              </div>
              <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-44 max-w-[55%]" />
                  <Skeleton className="h-3 w-24 max-w-[40%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-12 flex min-h-0 flex-col xl:col-span-3">
          <div className={ATTENDANCE_TABLE_SECTION}>
            <div className="bg-card flex h-full min-h-0 flex-col rounded-lg border border-border shadow-sm">
              <div className="min-h-0 flex-1 overflow-hidden">
                <RecordsSidebarSkeleton />
              </div>
              <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-36 max-w-[55%]" />
                  <Skeleton className="h-3 w-20 max-w-[40%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mirrors `AttendanceSettingsLayout` (grid 3+9, dual cards + table section). */
function SettingsBody() {
  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <div className={ATTENDANCE_SETTINGS_GRID}>
        <div className={ATTENDANCE_SETTINGS_NAV_COLUMN}>
          <div className={ATTENDANCE_SETTINGS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:h-full">
              <div className={ATTENDANCE_SETTINGS_CARD_HEADER}>
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="mt-1 h-3 w-full max-w-[220px]" />
              </div>
              <div className={cn(ATTENDANCE_SETTINGS_SCROLL_PANE, "p-3")}>
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-full rounded-md border border-border bg-card p-3"
                    >
                      <div className="flex items-start space-x-3">
                        <Skeleton className="h-9 w-9 shrink-0 rounded-md bg-muted" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-4 w-36 max-w-[85%]" />
                            <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
                          </div>
                          <Skeleton className="h-3 w-full max-w-[200px]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={ATTENDANCE_SETTINGS_CARD_FOOTER}>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={ATTENDANCE_SETTINGS_MAIN_COLUMN}>
          <div className={ATTENDANCE_SETTINGS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:h-full">
              <div className={ATTENDANCE_SETTINGS_CARD_HEADER}>
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-full max-w-lg" />
                </div>
              </div>
              <div className={ATTENDANCE_SETTINGS_SCROLL_PANE}>
                <div className="min-w-0 space-y-4 p-4">
                  <Skeleton className="h-10 w-full max-w-full rounded-md" />
                  <Skeleton className="h-10 w-full max-w-full rounded-md" />
                  <Skeleton className="h-32 w-full max-w-full rounded-md" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                  <Skeleton className="h-24 w-full rounded-md" />
                  <Skeleton className="h-10 w-40 max-w-full rounded-md" />
                </div>
              </div>
              <div className={ATTENDANCE_SETTINGS_CARD_FOOTER}>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AttendanceModuleSkeleton({
  variant,
}: {
  variant: AttendanceSkeletonVariant;
}) {
  const aria = useAttendanceLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <AttendanceHeaderSkeleton />
                </div>
                <div className={ATTENDANCE_MAIN_GRID}>
                  <div className={ATTENDANCE_FULL_COLUMN}>
                    {variant === "dashboard" ? <DashboardBody /> : null}
                    {variant === "attendance" ? <RecordsBody /> : null}
                    {variant === "settings" ? <SettingsBody /> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** `PageAccessGuard` `loadingShell`: same skeleton as in-route overlay, path-aware. */
export function AttendanceGuardLoadingShell() {
  const { pathname } = useLocation();
  const variant = getAttendanceSkeletonVariant(pathname);
  return <AttendanceModuleSkeleton variant={variant} />;
}

/** Lazy-route Suspense fallback: path-aware shell (dashboard / records / settings). */
export function AttendanceRouteSkeleton() {
  const { pathname } = useLocation();
  const variant = getAttendanceSkeletonVariant(pathname);
  return <AttendanceModuleSkeleton variant={variant} />;
}
