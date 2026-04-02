import { HeaderAndTab } from "@/9-request-form/pages/Purchase/section/HeaderAndTab";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Layout-aligned shell skeleton for /request-form/* routes (matches RequestFormSubPageLayout).
 */
export function RequestFormPageSkeleton() {
  return (
    <div
      className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-muted/30 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-busy
      aria-label="Loading request form"
    >
      <span className="sr-only">Loading request form</span>
      <div className="grid min-h-[calc(100dvh-210px)] flex-1 gap-2 px-4 pb-2 pt-0 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 flex-shrink-0">
            <HeaderAndTab />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto md:flex-row [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="min-w-0 flex-[2_1_0%] space-y-3 p-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
              <div className="flex min-h-0 min-w-0 w-full flex-[1_1_0%] flex-col border-t border-border p-4 md:border-l md:border-t-0">
                <Skeleton className="mb-3 h-8 w-3/4" />
                <Skeleton className="mb-2 h-9 w-full" />
                <Skeleton className="mb-4 h-9 w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </div>
  );
}
