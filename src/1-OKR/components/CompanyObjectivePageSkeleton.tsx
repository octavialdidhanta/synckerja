import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { OkrHeaderAndTabSkeleton } from "./OkrHeaderAndTabSkeleton";

/**
 * Mirrors OKRPage company tab: scroll shell, HeaderAndTab skeleton (ikut scroll), grid 9+3,
 * main Card + CompanyObjectivesProgressCard-shaped block + detail list area, sidebar + footer.
 */
export function CompanyObjectivePageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gray-100 font-sans dark:bg-muted/30"
      aria-busy
      aria-label="Loading OKR company objectives"
    >
      <span className="sr-only">Loading</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <OkrHeaderAndTabSkeleton />
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-9 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch overflow-hidden">
                    <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col border border-border">
                      <CardContent className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-0 sm:p-6">
                        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                          <div className="shrink-0 space-y-3">
                            <div className="relative z-10 rounded-lg border border-border bg-card shadow-sm">
                              <div className="border-b border-border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-5 shrink-0 rounded" />
                                    <Skeleton className="h-5 w-48 max-w-[70%]" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-[140px] rounded-md" />
                                    <Skeleton className="h-8 w-28 rounded-md" />
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                  </div>
                                </div>
                              </div>
                              <div className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Skeleton className="h-3 w-28" />
                                    <Skeleton className="h-4 w-8" />
                                  </div>
                                  <Skeleton className="h-2 w-full rounded-full" />
                                </div>
                              </div>
                              <div className="space-y-3 border-t border-border p-3">
                                <div className="grid grid-cols-3 gap-2">
                                  <Skeleton className="h-14 rounded-md" />
                                  <Skeleton className="h-14 rounded-md" />
                                  <Skeleton className="h-14 rounded-md" />
                                </div>
                                <Skeleton className="h-12 w-full rounded-md" />
                              </div>
                            </div>
                          </div>

                          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 w-full flex-1 flex-col basis-0 space-y-3 overflow-x-hidden overflow-y-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <Skeleton className="h-14 w-full shrink-0 rounded-lg" />
                            <Skeleton className="min-h-[8rem] w-full flex-1 rounded-lg" />
                            <Skeleton className="h-28 w-full shrink-0 rounded-lg" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch rounded-lg border border-border bg-card shadow-sm">
                    <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="mt-1 h-3 w-full max-w-[200px]" />
                    </div>
                    <div className="min-h-0 flex-1">
                      <div className="h-full min-h-0 space-y-4 p-4">
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-20 w-full rounded-md" />
                        <Skeleton className="h-20 w-full rounded-md" />
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                    </div>
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
