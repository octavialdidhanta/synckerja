import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SYNCKERJA_ORDER_I18N } from "@/synckerja-order/shared/lib/orderCopy";
import {
  SYNCKERJA_ORDER_MAIN_GRID,
  SYNCKERJA_ORDER_PANEL_BODY,
  SYNCKERJA_ORDER_TABLE_SECTION,
} from "../layout/synckerjaOrderLayout";

export function SynckerjaOrderPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t(SYNCKERJA_ORDER_I18N.loadingAria, "Loading Synckerja Order");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 flex-shrink-0">
                <div className="px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="mb-0.5 h-7 w-56 max-w-[90%]" />
                    <Skeleton className="h-3 w-full max-w-md" />
                  </div>
                  <div className="-mb-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-12" />
                    </div>
                  </div>
                </div>
              </div>

              <div className={SYNCKERJA_ORDER_MAIN_GRID}>
                <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                  <div className={SYNCKERJA_ORDER_TABLE_SECTION}>
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className={SYNCKERJA_ORDER_PANEL_BODY}>
                        <div className="grid content-start gap-4 p-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-9 w-full" />
                          </div>
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-9 w-full" />
                          </div>
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-9 w-full" />
                          </div>
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-9 w-full" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-52 max-w-[55%]" />
                          <Skeleton className="h-3 w-28 max-w-[40%]" />
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
    </div>
  );
}
