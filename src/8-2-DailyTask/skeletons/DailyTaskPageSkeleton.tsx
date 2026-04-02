import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function DailyTaskPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("dailyTask.page.loadingAria", "Loading daily task");

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
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
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
                    <div className="w-full min-w-0">
                      <div className="bg-white border border-gray-200 rounded-md min-w-0 overflow-hidden p-1.5 sm:p-2">
                        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-hidden min-w-0">
                          <Skeleton className="h-8 min-w-[160px] flex-1 rounded-md" />
                          <Skeleton className="h-8 w-[152px] shrink-0 rounded-md" />
                          <Skeleton className="h-8 w-[100px] shrink-0 rounded-md" />
                          <Skeleton className="h-8 w-[95px] shrink-0 rounded-md" />
                          <Skeleton className="h-8 w-[120px] shrink-0 rounded-md" />
                          <Skeleton className="h-8 w-[85px] shrink-0 rounded-md" />
                          <Skeleton className="h-8 min-w-[130px] w-[150px] shrink-0 rounded-md" />
                          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                          <Skeleton className="ml-auto h-8 w-[96px] shrink-0 rounded-md" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col">
                    <div className="flex-1 min-h-0 p-4">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="mt-2 h-11 w-full rounded-md first:mt-0" />
                      ))}
                    </div>
                    <div className="border-t border-gray-200 px-3 py-2">
                      <Skeleton className="h-4 w-52" />
                    </div>
                  </div>
                </div>

                <div className="col-span-3 h-full flex flex-col min-h-0">
                  <div className="bg-white border rounded-lg h-full flex flex-col min-h-0">
                    <div className="border-b flex-shrink-0">
                      <div className="flex border-b border-gray-200">
                        <Skeleton className="m-2 h-7 flex-1" />
                        <Skeleton className="m-2 h-7 flex-1" />
                        <Skeleton className="m-2 h-7 flex-1" />
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4">
                      <Skeleton className="mb-3 h-16 w-full rounded-lg" />
                      <Skeleton className="mb-3 h-16 w-full rounded-lg" />
                      <Skeleton className="mb-3 h-16 w-full rounded-lg" />
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="mt-2 h-10 w-full rounded-md first:mt-0" />
                      ))}
                    </div>
                    <div className="border-t border-gray-200 px-4 py-2">
                      <Skeleton className="h-4 w-36" />
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

          <div
            className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
