import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  SETTINGS_MAIN_GRID,
  SETTINGS_PANEL_BODY,
  SETTINGS_TABLE_SECTION,
} from "../layout/settingsLayout";

export function OutletsListPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("outlets.loadingAria", "Loading outlets");

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
                  <Skeleton className="mb-0.5 h-7 w-40 max-w-full" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </div>

              <div className={SETTINGS_MAIN_GRID}>
                <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                  <div className={SETTINGS_TABLE_SECTION}>
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
                        <div className="h-full w-[180px] shrink-0 border-r border-gray-200 bg-gray-50/80 p-3">
                          <Skeleton className="mb-3 h-3 w-24" />
                          <Skeleton className="mb-1 h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                        <div className={`${SETTINGS_PANEL_BODY} px-4 py-6`}>
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <Skeleton className="h-8 w-32" />
                            <Skeleton className="h-9 w-32" />
                          </div>
                          <div className="mb-4 flex gap-2">
                            <Skeleton className="h-9 flex-1" />
                            <Skeleton className="h-9 w-[180px]" />
                          </div>
                          <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            {Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton key={i} className="h-16 w-full" />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-36 max-w-[55%]" />
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
