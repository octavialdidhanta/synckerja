import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function TableManagementPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("tableManagement.page.loadingAria", "Loading table management");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <div className="px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="mb-1 h-7 w-48 max-w-full" />
                    <Skeleton className="h-3 w-96 max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <Skeleton className="h-8 w-28" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-28" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex-shrink-0 space-y-3 border-b px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Skeleton className="h-6 w-36" />
                      <Skeleton className="h-9 w-44" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-9 w-44" />
                      <Skeleton className="h-9 w-56" />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col p-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="mb-2 h-10 w-full" />
                    ))}
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
    </div>
  );
}
