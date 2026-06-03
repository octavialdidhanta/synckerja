import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Layout-matched shell for `/digital-marketing/social-media/*` — mirrors
 * SocialMediaDashboardPage seamless scroll (header + tabs ikut scroll, satu scroll utama).
 * Used by PageAccessGuard, Suspense, and optional data overlay.
 */
export function SocialMediaShellSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0 flex flex-wrap items-center gap-2">
                  <Skeleton className="h-9 w-40 rounded-md" />
                  <Skeleton className="h-9 w-36 rounded-md" />
                  <Skeleton className="h-9 w-44 rounded-md" />
                  <Skeleton className="h-9 w-32 rounded-md" />
                  <Skeleton className="h-9 w-28 rounded-md" />
                </div>
                <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 flex-col gap-2 overflow-hidden xl:col-span-9">
                    <Skeleton className="h-24 w-full flex-shrink-0 rounded-lg" />
                    <Skeleton className="max-h-[calc(100vh-320px)] min-h-[200px] w-full flex-1 rounded-lg" />
                  </div>
                  <div className="col-span-12 flex min-h-0 flex-col overflow-hidden xl:col-span-3">
                    <Skeleton className="min-h-0 w-full flex-1 rounded-lg" />
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
