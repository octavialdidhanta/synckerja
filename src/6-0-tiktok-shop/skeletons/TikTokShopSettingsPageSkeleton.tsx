import { Skeleton } from "@/shared/components/ui/skeleton";
import { TikTokShopHeaderAndTab } from "@/6-0-tiktok-shop/container/TikTokShopHeaderAndTab";

export function TikTokShopSettingsPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <TikTokShopHeaderAndTab />
            </div>
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
              <div className="col-span-12 min-h-0 rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="space-y-3 p-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-32 w-full" />
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
