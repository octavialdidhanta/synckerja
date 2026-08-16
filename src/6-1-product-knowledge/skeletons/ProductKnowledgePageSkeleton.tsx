import { Skeleton } from '@/shared/components/ui/skeleton';
import { SocialMediaHeaderSkeletonSlot } from '@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton';
import { cn } from '@/shared/lib/utils';

type ProductKnowledgePageSkeletonMode = 'route' | 'overlay';

/** ProductKnowledgeFilters: search + service select + add */
function ProductKnowledgeFiltersSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
      <Skeleton className="h-9 min-w-[12rem] flex-1 rounded-md" />
      <Skeleton className="h-9 w-[200px] shrink-0 rounded-md" />
      <Skeleton className="h-9 w-44 shrink-0 rounded-md" />
    </div>
  );
}

/** Mirror `ProductKnowledgeTable`: rounded border + thead py-2 + minWidth ~4088px */
function ProductKnowledgeTableSkeleton() {
  const colCount = 17;
  const rows = 5;
  return (
    <div className="w-full max-w-full">
      <div className="rounded-md border border-gray-200">
        <div className="overflow-x-auto overflow-y-clip">
          <div className="min-w-[4088px]">
            <div className="flex h-10 border-b-2 border-gray-300 bg-gray-50">
              {Array.from({ length: colCount }).map((_, i) => (
                <div
                  key={`th-${i}`}
                  className="flex min-w-[5rem] flex-1 items-center justify-center border-r border-gray-200 px-2 py-2 last:border-r-0"
                >
                  <Skeleton className="h-3 w-[70%] max-w-[5rem] rounded-sm" />
                </div>
              ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
              <div key={`tr-${r}`} className="flex min-h-10 border-b border-gray-200">
                {Array.from({ length: colCount }).map((_, i) => (
                  <div
                    key={`td-${r}-${i}`}
                    className="flex min-w-[5rem] flex-1 items-center border-r border-gray-200 px-2 py-1 last:border-r-0"
                  >
                    <Skeleton className="h-8 w-[85%] rounded-md" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ProductKnowledgeTableFooter + wrapper `bg-white border-t` */
function TableFooterStripSkeleton() {
  return (
    <div className="z-10 flex-shrink-0 border-t border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-2 py-1.5">
        <div className="flex items-center gap-2 px-2">
          <Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-24 rounded-sm" />
        </div>
        <div className="flex items-center gap-1.5 px-2">
          {['Services', 'Sub Services', 'Feature'].map((_, j) => (
            <div key={j} className="flex items-center gap-0.5">
              <Skeleton className="h-3 w-14 rounded-sm" />
              <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ProductKnowledgeSidebar: 5 tabs min-h-11 + header p-4 + list + footer py-2.5 */
function ProductKnowledgeSidebarSkeleton() {
  const tabWidths = ['w-14', 'w-10', 'w-11', 'w-14', 'w-10'] as const;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex min-h-11 shrink-0 items-stretch border-b border-gray-200">
        {tabWidths.map((w, i) => (
          <div
            key={i}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center border-b-2 px-2 sm:px-4',
              i === 0 ? 'border-primary bg-primary/10' : 'border-transparent',
            )}
          >
            <Skeleton className={cn('h-4 rounded-sm', w, i === 0 && 'bg-primary/25')} />
          </div>
        ))}
      </div>
      <div className="shrink-0 border-b border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-5 w-36 rounded-sm" />
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
      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-2.5">
        <div className="flex items-center justify-between gap-2 px-2">
          <Skeleton className="h-3 w-20 rounded-sm" />
          <Skeleton className="h-3 w-16 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

function MainBodySkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
      <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col gap-0 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="z-20 flex min-h-11 shrink-0 items-center border-b-2 border-gray-300 bg-white px-4 py-2">
            <ProductKnowledgeFiltersSkeleton />
          </div>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-full min-w-0 p-6">
              <ProductKnowledgeTableSkeleton />
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
      <SocialMediaHeaderSkeletonSlot activeTabId={headerActiveTabId} />
      <MainBodySkeleton />
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
