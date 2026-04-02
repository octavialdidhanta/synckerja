import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function HabitTrackerPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("habitTracker.page.loadingAria", "Loading habit tracker");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <div className="px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="mb-1 h-7 w-24" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <div className="flex space-x-6">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-36" />
                      <Skeleton className="h-8 w-28" />
                      <Skeleton className="h-8 w-28" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col max-h-[calc(100vh-120px)]">
                    <div className="mb-0.5 flex-shrink-0">
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
                            <Skeleton className="mb-2 h-3 w-20" />
                            <Skeleton className="h-7 w-12" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 px-0 pb-0.5">
                      <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 flex-1 rounded-md" />
                          <Skeleton className="h-10 w-40 rounded-md" />
                          <Skeleton className="h-10 w-40 rounded-md" />
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1">
                      <div className="h-full flex flex-col bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                        <div className="flex-shrink-0 border-b border-gray-300 bg-gray-100 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Skeleton className="h-6 w-32" />
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-7 w-7 rounded-md" />
                                <Skeleton className="h-5 w-28" />
                                <Skeleton className="h-7 w-7 rounded-md" />
                              </div>
                            </div>
                            <Skeleton className="h-9 w-28 rounded-md" />
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 p-3">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <Skeleton key={i} className="mt-2 h-8 w-full rounded first:mt-0" />
                          ))}
                        </div>
                        <div className="border-t border-gray-300 p-3">
                          <Skeleton className="h-24 w-full rounded-md" />
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
          </div>

          <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}
