import { Skeleton } from '@/shared/components/ui/skeleton';
import { SocialMediaHeaderSkeleton } from '@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton';

type ProductKnowledgePageSkeletonMode = 'route' | 'overlay';

/** ProductKnowledgeGeneratePanel (collapsed / default): card dengan industri + aksi */
function GeneratePanelSkeleton() {
  return (
    <div className="mb-2 min-h-0 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-[min(100%,14rem)] max-w-full rounded-sm" />
        </div>
        <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-sm" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="flex items-end gap-2">
          <Skeleton className="h-9 w-full max-w-[220px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** ProductKnowledgeFilters: search + service select + add + optional delete */
function ProductKnowledgeFiltersSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
      <Skeleton className="h-9 min-w-[min(100%,12rem)] flex-1 rounded-md" />
      <Skeleton className="h-9 w-[200px] shrink-0 rounded-md" />
      <Skeleton className="h-9 w-44 shrink-0 rounded-md" />
    </div>
  );
}

/** Wide product knowledge table */
function ProductKnowledgeTableSkeleton() {
  const cols = 12;
  const rows = 6;
  return (
    <div className="min-w-[1200px]">
      <div className="flex h-10 border-b-2 border-gray-300 bg-gray-50">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`th-${i}`} className="flex min-w-[5rem] flex-1 items-center px-2">
            <Skeleton className="h-3 w-[70%] rounded-sm" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`tr-${r}`} className="flex min-h-10 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={`td-${r}-${i}`} className="flex min-w-[5rem] flex-1 items-center px-2 py-2">
              <Skeleton className="h-4 w-[80%] rounded-sm" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** ProductKnowledgeTableFooter / master feature tools */
function TableFooterStripSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
      <Skeleton className="h-4 w-32 rounded-sm" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

/** ProductKnowledgeSidebar: 4 tabs + header + list */
function ProductKnowledgeSidebarSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex shrink-0 border-b border-gray-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 flex-1 rounded-none border-r border-gray-100 last:border-r-0" />
        ))}
      </div>
      <div className="shrink-0 border-b border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-5 w-40 rounded-sm" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

function MainBodySkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col gap-0 overflow-hidden">
        <GeneratePanelSkeleton />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="z-20 flex min-h-11 shrink-0 items-center border-b-2 border-gray-300 bg-white px-4 py-2">
            <ProductKnowledgeFiltersSkeleton />
          </div>
          <div className="scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-full min-w-0 p-6">
              <div className="rounded-md border border-gray-200">
                <div className="overflow-x-auto">
                  <ProductKnowledgeTableSkeleton />
                </div>
              </div>
            </div>
          </div>
          <TableFooterStripSkeleton />
        </div>
      </div>
      <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
        <ProductKnowledgeSidebarSkeleton />
      </div>
    </div>
  );
}

/**
 * Skeleton khusus `/digital-marketing/social-media/product-knowledge`.
 * — `route`: PageAccessGuard + Suspense.
 * — `overlay`: Gate penuh (header + body) sampai data siap.
 */
export function ProductKnowledgePageSkeleton({
  mode = 'route',
  headerActiveTabId = 'product-knowledge',
}: {
  mode?: ProductKnowledgePageSkeletonMode;
  headerActiveTabId?: string;
}) {
  const inner = (
    <>
      <SocialMediaHeaderSkeleton activeTabId={headerActiveTabId} flushBottom />
      <MainBodySkeleton />
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </>
  );

  if (mode === 'overlay') {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">{inner}</div>
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
              <div className="flex min-h-full flex-col">{inner}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
