import { Skeleton } from '@/shared/components/ui/skeleton';
import { SocialMediaHeaderSkeleton } from '@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton';

type SocialMediaDashboardSkeletonMode = 'route' | 'overlay';

/** Mirrors SocialMediaMetrics: 4 cards, title + icon + 2 metric rows each */
function MetricsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-[7.5rem] max-w-[85%]" />
            <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-7" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-7" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors SocialMediaFilters: search + bell + 2 selects + month + Add Content */
function FiltersRowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 min-w-[min(100%,220px)] flex-1 rounded-md" />
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
        <Skeleton className="h-9 w-48 shrink-0 rounded-md" />
        <Skeleton className="h-9 w-48 shrink-0 rounded-md" />
        <Skeleton className="h-9 w-[11rem] shrink-0 rounded-md" />
        <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

/** Mirrors ContentPlannerTab top block: fixed ~130px table with many columns */
function PerformanceEmployeeTableSkeleton() {
  const colCount = 10;
  return (
    <div
      className="h-[130px] w-full shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white"
      aria-hidden
    >
      <div className="flex h-10 items-stretch border-b border-gray-200 bg-white">
        {Array.from({ length: colCount }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="flex min-w-0 flex-1 items-center justify-center border-r border-gray-200 px-1 last:border-r-0"
          >
            <Skeleton className="h-5 w-[80%] max-w-[5.5rem] rounded-sm" />
          </div>
        ))}
      </div>
      {[0, 1].map((row) => (
        <div
          key={`r-${row}`}
          className="flex h-10 items-stretch border-b border-gray-100 last:border-b-0"
        >
          {Array.from({ length: colCount }).map((_, i) => (
            <div
              key={`c-${row}-${i}`}
              className="flex min-w-0 flex-1 items-center justify-center border-r border-gray-100 px-1 last:border-r-0"
            >
              <Skeleton className="h-4 w-[70%] max-w-[4rem] rounded-sm" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** SocialMediaPerformanceTabs: 3 triggers + employee metrics table */
function PerformanceSectionSkeleton() {
  return (
    <div className="mb-2 flex-shrink-0 space-y-2">
      <div className="grid h-auto w-full grid-cols-3 gap-0 rounded-md border border-border bg-muted p-0">
        <Skeleton className="h-10 rounded-none rounded-l-md border-r border-border" />
        <Skeleton className="h-10 rounded-none border-r border-border" />
        <Skeleton className="h-10 rounded-none rounded-r-md" />
      </div>
      <PerformanceEmployeeTableSkeleton />
    </div>
  );
}

/** Wide content plan table: sticky-style header + rows (scroll region like live page) */
function ContentPlanTableSkeleton() {
  const headerCells = 14;
  const rows = 8;
  return (
    <div className="min-w-[960px]">
      <div className="flex h-10 items-stretch border-b-2 border-gray-300 bg-white">
        {Array.from({ length: headerCells }).map((_, i) => (
          <div
            key={`th-${i}`}
            className="flex min-w-[4.5rem] shrink-0 items-center px-2"
            style={{ width: i === 0 ? '3rem' : i === 1 ? '7rem' : '5.5rem' }}
          >
            <Skeleton className="h-3 w-full max-w-[3.5rem] rounded-sm" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`tr-${r}`}
          className="flex min-h-[2.25rem] items-stretch border-b border-gray-100"
        >
          {Array.from({ length: headerCells }).map((_, i) => (
            <div
              key={`td-${r}-${i}`}
              className="flex min-w-[4.5rem] shrink-0 items-center px-2 py-1"
              style={{ width: i === 0 ? '3rem' : i === 1 ? '7rem' : '5.5rem' }}
            >
              <Skeleton className="h-4 w-[85%] rounded-sm" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** TableFooter / MasterDataToolbar strip */
function MasterDataFooterSkeleton() {
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-2 py-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-sm" />
        <Skeleton className="h-3 w-24 rounded-sm" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {['Content Types', 'Services', 'Sub Svcs', 'Pillars', 'Names'].map((label) => (
          <div key={label} className="flex items-center gap-1">
            <Skeleton className="h-3 w-14 rounded-sm" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** ReminderTab: Card rounded-[5px], TabsList 3 cols, funnel-style body */
function SidebarSkeleton() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-gray-200 bg-white shadow-sm">
        <div className="grid h-9 w-full shrink-0 grid-cols-3 gap-0 overflow-hidden rounded-t-[5px] bg-muted p-0">
          <Skeleton className="h-9 rounded-none rounded-tl-[4px] border-r border-border" />
          <Skeleton className="h-9 rounded-none border-r border-border" />
          <Skeleton className="h-9 rounded-none rounded-tr-[4px]" />
        </div>
        <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Skeleton className="h-4 w-36 rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-gray-100 bg-muted/30 p-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full max-w-[10rem] rounded-sm" />
                  <Skeleton className="h-2 w-full max-w-[7rem] rounded-sm" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-px w-full bg-border" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MainGridSkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-9 flex min-h-0 min-w-0 flex-col space-y-2 overflow-hidden">
        <div className="shrink-0">
          <MetricsCardsSkeleton />
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="shrink-0 border-b-2 border-gray-300 bg-white p-4 pb-3">
            <FiltersRowSkeleton />
          </div>

          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 max-h-[calc(100vh-320px)] flex-1 overflow-y-auto overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ContentPlanTableSkeleton />
          </div>

          <MasterDataFooterSkeleton />
        </div>
      </div>

      <div className="col-span-3 flex min-h-0 min-w-0 flex-col overflow-hidden">
        <SidebarSkeleton />
      </div>
    </div>
  );
}

function DashboardBodySkeleton() {
  return (
    <>
      <PerformanceSectionSkeleton />
      <MainGridSkeleton />
    </>
  );
}

/**
 * Layout-matched skeleton for `/digital-marketing/social-media/dashboard` only.
 * — `route`: PageAccessGuard + Suspense (full shell, mirrors SocialMediaDashboardPage).
 * — `overlay`: Gate penuh di halaman (header + body); dipakai sampai data siap agar tidak flash header dulu.
 */
export function SocialMediaDashboardSkeleton({
  mode = 'route',
  headerActiveTabId = 'dashboard',
}: {
  mode?: SocialMediaDashboardSkeletonMode;
  /** Selaras tab aktif di HeaderAndTab */
  headerActiveTabId?: string;
}) {
  if (mode === 'overlay') {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">
            <SocialMediaHeaderSkeleton activeTabId={headerActiveTabId} />
            <DashboardBodySkeleton />
            <div
              className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
              aria-hidden
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <SocialMediaHeaderSkeleton activeTabId={headerActiveTabId} />

                <DashboardBodySkeleton />

                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
