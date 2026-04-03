import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function PromoSimulationPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("promoSimulation.page.loadingAria", "Memuat simulasi promo");

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col px-4 pb-2"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
        <div className={`${MAIN_SCROLL} min-w-0`}>
          <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
            <div className="mb-1 min-w-0 shrink-0">
              <div className="px-1 py-3">
                <div className="mb-3">
                  <Skeleton className="mb-1 h-7 w-56 max-w-full" />
                  <Skeleton className="h-3 w-80 max-w-full" />
                </div>
                <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
                  <Skeleton className="h-8 w-40 max-w-[32%]" />
                  <Skeleton className="h-8 w-36 max-w-[32%]" />
                  <Skeleton className="h-8 w-36 max-w-[32%]" />
                </div>
              </div>
            </div>

            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
              <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                  <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
                    <div className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-3">
                      <div className="space-y-2 lg:col-span-2">
                        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                          <div className="mb-3 flex justify-between gap-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-8 w-36" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                        </div>
                        <Skeleton className="h-40 w-full rounded-lg" />
                        <Skeleton className="h-28 w-full rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-9 w-full rounded-md" />
                        <Skeleton className="min-h-[280px] w-full rounded-lg" />
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
  );
}
