import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function DailyTaskReportPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("dailyTaskReport.page.loadingAria", "Loading daily task report");

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
                <div className="col-span-9 flex flex-col min-h-0 gap-2">
                  <div className="flex-shrink-0">
                    <div className="mb-2 w-full">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
                            <Skeleton className="mb-2 h-4 w-20" />
                            <Skeleton className="h-7 w-12" />
                            <Skeleton className="mt-2 h-3 w-24" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Skeleton className="h-9 min-w-[180px] flex-1 rounded-md" />
                        <Skeleton className="h-9 w-32 rounded-md" />
                        <Skeleton className="h-9 w-36 rounded-md" />
                        <Skeleton className="h-9 w-36 rounded-md" />
                        <Skeleton className="h-9 w-36 rounded-md" />
                        <Skeleton className="h-9 w-36 rounded-md" />
                        <Skeleton className="h-9 w-36 rounded-md" />
                        <Skeleton className="ml-auto h-9 w-10 rounded-md" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-full">
                    <div className="px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-7 w-36 rounded-md" />
                      </div>
                      <Skeleton className="mt-2 h-3 w-32" />
                    </div>
                    <div className="flex-1 min-h-0 px-3 py-2">
                      <div className="space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="grid grid-cols-9 gap-2">
                            {Array.from({ length: 9 }).map((__, j) => (
                              <Skeleton key={`${i}-${j}`} className="h-5 w-full rounded" />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-gray-200 px-3 py-2">
                      <Skeleton className="h-4 w-44" />
                    </div>
                  </div>
                </div>

                <div className="col-span-3 h-full min-h-0 flex flex-col gap-2">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-full min-h-0">
                    <div className="border-b bg-gray-50">
                      <div className="flex w-full p-0">
                        <Skeleton className="m-2 h-7 flex-1" />
                        <Skeleton className="m-2 h-7 flex-1" />
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 p-3 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-md" />
                      ))}
                    </div>
                    <div className="border-t border-gray-200 px-3 py-2">
                      <Skeleton className="h-4 w-32" />
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
