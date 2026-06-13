import { Skeleton } from "@/shared/components/ui/skeleton";
import { TikTokShopHeaderAndTab } from "@/6-0-tiktok-shop/container/TikTokShopHeaderAndTab";

const SHOP_NAV_SKELETON_COUNT = 5;
const TABLE_ROW_SKELETON_COUNT = 10;

function ShopNavItemSkeleton({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 ${
        active ? "bg-gray-200/80" : ""
      }`}
    >
      <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
      <Skeleton className="h-4 min-w-0 flex-1" />
      {active ? <Skeleton className="h-2.5 w-10 shrink-0" /> : null}
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-7 w-28" />
    </div>
  );
}

function TableHeaderSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_3.5rem_5.5rem] gap-3 border-b border-gray-100 px-4 py-2.5">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-3.5 w-12" />
      <Skeleton className="h-3.5 w-14" />
      <Skeleton className="ml-auto h-3.5 w-8" />
      <Skeleton className="ml-auto h-3.5 w-8" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_3.5rem_5.5rem] gap-3 border-b border-gray-50 px-4 py-3 last:border-b-0">
      <Skeleton className="h-4 w-full max-w-[140px]" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="ml-auto h-4 w-6" />
      <Skeleton className="ml-auto h-4 w-14" />
    </div>
  );
}

export function TikTokShopDashboardPageSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label="Loading TikTok Shop dashboard"
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <TikTokShopHeaderAndTab />
            </div>

            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
              {/* Shop nav — mirrors xl:col-span-3 sidebar */}
              <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col xl:col-span-3">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="mb-1 px-2">
                    <Skeleton className="h-2.5 w-10" />
                  </div>
                  <div className="min-h-0 flex-1 space-y-0.5">
                    {Array.from({ length: SHOP_NAV_SKELETON_COUNT }, (_, index) => (
                      <ShopNavItemSkeleton key={index} active={index === 0} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Main column — mirrors xl:col-span-9 */}
              <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col gap-2 xl:col-span-9">
                {/* KPI summary bar */}
                <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3">
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                </div>

                {/* Orders table card */}
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-9 w-56 rounded-md" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-9 w-24 rounded-md" />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <TableHeaderSkeleton />
                    <div className="min-h-0 flex-1 overflow-hidden">
                      {Array.from({ length: TABLE_ROW_SKELETON_COUNT }, (_, index) => (
                        <TableRowSkeleton key={index} />
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-3 py-2">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
