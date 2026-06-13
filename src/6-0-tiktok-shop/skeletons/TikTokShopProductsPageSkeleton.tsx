import { Skeleton } from "@/shared/components/ui/skeleton";
import { TikTokShopHeaderAndTab } from "@/6-0-tiktok-shop/container/TikTokShopHeaderAndTab";

export function TikTokShopProductsPageSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label="Loading TikTok Shop products"
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <TikTokShopHeaderAndTab />
            </div>
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
              <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col xl:col-span-3">
                <div className="min-h-0 flex-1 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <Skeleton className="mb-2 h-2.5 w-10" />
                  <Skeleton className="mb-1 h-8 w-full" />
                  <Skeleton className="mb-1 h-8 w-full" />
                </div>
              </div>
              <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col gap-2 xl:col-span-9">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-3">
                    <Skeleton className="mb-2 h-8 w-full max-w-xl" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
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
