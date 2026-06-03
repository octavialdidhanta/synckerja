import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/shared/components/ui/skeleton";

/** Mirrors `HeaderAndTab.tsx` on CRM core routes: title + Dashboard + Leads Management tabs only. */
function LeadsManagementHeaderTabSkeleton() {
  return (
    <div className="min-w-0 max-w-full px-1 py-3">
      <div className="mb-3 min-w-0 space-y-2">
        <Skeleton className="h-7 w-[min(100%,12rem)] max-w-full rounded-md" />
        <Skeleton className="h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
      </div>
      <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
        <nav className="flex min-w-0 flex-nowrap gap-x-6" aria-hidden>
          {["w-28", "w-40"].map((w, i) => (
            <div
              key={i}
              className="flex cursor-default items-center space-x-1.5 border-b-2 border-transparent py-1.5 px-1"
            >
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className={`h-4 shrink-0 rounded-sm ${w}`} />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Mirrors `LeadsFilters`: satu baris utama (search, date, data, services, status menu, clear, PDF, new lead). */
function LeadsManagementFiltersPrimaryRowSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Skeleton className="h-9 min-w-[150px] flex-1 rounded-md" />
      <Skeleton className="h-9 w-[180px] shrink-0 rounded-md" />
      <Skeleton className="h-9 w-36 shrink-0 rounded-md sm:w-40" />
      <Skeleton className="h-9 w-36 shrink-0 rounded-md sm:w-40" />
      <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
      <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
      <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
      <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
    </div>
  );
}

/** Bar kedua saat report (`attributionBarLeads`): attribution label + landing URL contains. */
function LeadsManagementFiltersReportAttributionRowSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Skeleton className="h-9 w-40 shrink-0 rounded-md sm:w-40" />
      <Skeleton className="h-9 min-w-[10rem] flex-1 rounded-md" />
    </div>
  );
}

function LeadsManagementFiltersRowSkeleton({ variant }: { variant: "default" | "report" }) {
  return (
    <div className="flex flex-col gap-1.5">
      <LeadsManagementFiltersPrimaryRowSkeleton />
      {variant === "report" ? <LeadsManagementFiltersReportAttributionRowSkeleton /> : null}
    </div>
  );
}

function LeadsManagementMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-gray-50/90 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-sm" />
            <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-16 rounded-sm" />
            <Skeleton className="h-3 w-24 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

const TABLE_COLS = 20;
const TABLE_ROWS = 8;

function LeadsManagementTableSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="nested-scroll-touch-chain seamless-scroll min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-max caption-bottom text-sm">
          <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <tr className="hover:bg-transparent">
              {Array.from({ length: TABLE_COLS }).map((_, i) => (
                <th key={i} className="bg-gray-50 px-3 py-2.5 text-left whitespace-nowrap">
                  <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
                    <Skeleton className="h-3.5 min-w-[2rem] max-w-[5rem] flex-1 rounded-sm" />
                    <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm opacity-70" />
                    <Skeleton className="h-7 w-7 shrink-0 rounded-md opacity-80" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: TABLE_ROWS }).map((_, r) => (
              <tr key={r} className="h-12 border-b border-gray-100">
                {Array.from({ length: TABLE_COLS }).map((_, c) => (
                  <td key={c} className="px-3 py-2">
                    <Skeleton className="h-4 w-[85%] rounded-sm" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-4 py-2">
        <Skeleton className="h-3 w-48 rounded-sm" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-28 rounded-sm" />
          <Skeleton className="h-3 w-24 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

function LeadsManagementSidebarSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-3 w-24 rounded-sm" />
              <Skeleton className="h-6 w-16 rounded-sm" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function DefaultLeadsManagementBodySkeleton() {
  return (
    <div className="grid min-h-0 h-full min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden">
      <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="mb-2 flex-shrink-0">
            <div className="rounded-md border bg-white p-2">
              <LeadsManagementFiltersRowSkeleton variant="default" />
            </div>
          </div>
          <div className="mb-2 flex-shrink-0">
            <LeadsManagementMetricsSkeleton />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="min-h-0 flex-1 overflow-hidden">
                <LeadsManagementTableSkeleton />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex-shrink-0 border-b px-4 py-1.5">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-40 max-w-full rounded-sm" />
              <Skeleton className="h-3 w-48 max-w-full rounded-sm" />
            </div>
          </div>
          <div className="nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4">
            <LeadsManagementSidebarSkeleton />
          </div>
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-sm" />
              <Skeleton className="h-3 w-16 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportLeadsManagementBodySkeleton() {
  return (
    <div className="flex min-h-0 h-full min-w-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex-shrink-0 border-b p-2">
          <LeadsManagementFiltersRowSkeleton variant="report" />
        </div>
        <div className="flex-shrink-0 px-2 pb-2">
          <LeadsManagementMetricsSkeleton />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-gray-100">
          <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 rounded-sm" />
              <Skeleton className="h-3 w-56 rounded-sm" />
            </div>
            <Skeleton className="h-8 w-32 shrink-0 rounded-md" />
          </div>
          <div className="nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
            <LeadsManagementSidebarSkeleton />
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-4 py-2">
            <Skeleton className="h-3 w-32 rounded-sm" />
            <Skeleton className="h-3 w-24 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

export type LeadsManagementPageSkeletonProps = {
  /**
   * `route`: full mirror of `ConsultantDashboardPage` (guard + Suspense).
   * `embedded`: scroll-inner overlay only (same header + grid; `bg-surface-muted` fill).
   */
  mode?: "route" | "embedded";
  /** When omitted in `route` mode, derived from `?view=report`. In `embedded` mode, pass from parent to avoid double subscription. */
  variant?: "default" | "report";
};

/**
 * Layout-matched shell for `/omnichannel/leads`
 * (Loading Skeleton rule: guard / Suspense / in-page overlay share this component).
 *
 * Filter strip: default = satu baris (selaras `LeadsFilters` tanpa UTM/attribution di bar);
 * report = baris tambahan attribution + landing URL (selaras `attributionBarLeads`).
 * Header tabel: blok mirip sort + filter per kolom.
 */
export function LeadsManagementPageSkeleton({
  mode = "route",
  variant: variantProp,
}: LeadsManagementPageSkeletonProps) {
  const [searchParams] = useSearchParams();
  const variant =
    variantProp ?? (searchParams.get("view") === "report" ? "report" : "default");

  const scrollInner = (
    <div className="flex min-h-full min-w-0 flex-col">
      <div className="mb-1 min-w-0 shrink-0">
        <LeadsManagementHeaderTabSkeleton />
      </div>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
          {variant === "report" ? (
            <ReportLeadsManagementBodySkeleton />
          ) : (
            <DefaultLeadsManagementBodySkeleton />
          )}
        </div>
      </div>
    </div>
  );

  if (mode === "embedded") {
    return (
      <div
        className="flex min-h-full min-w-0 flex-col bg-surface-muted"
        aria-busy
        aria-label="Loading leads management"
      >
        <span className="sr-only">Loading leads management</span>
        {scrollInner}
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans"
      aria-busy
      aria-label="Loading leads management"
    >
      <span className="sr-only">Loading leads management</span>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {scrollInner}
          </div>
        </div>
      </div>
    </div>
  );
}
