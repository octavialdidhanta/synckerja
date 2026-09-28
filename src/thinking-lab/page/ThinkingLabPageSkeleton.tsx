import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  LAB_MT_CARD,
  LAB_LEFT_COL,
  LAB_LEFT_SECTION,
  LAB_MAIN_GRID,
  LAB_RIGHT_CARD,
  LAB_RIGHT_COL,
  LAB_SECTION,
} from "@/thinking-lab/page/thinkingLabLayout";

export function ThinkingLabPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("thinkingLab.page.loadingAria", "Loading Thinking Lab");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-muted/40">
              <div className="mb-1 shrink-0 space-y-2 py-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-72" />
              </div>
              <div className={LAB_MAIN_GRID}>
                <div className={LAB_LEFT_COL}>
                  <div className={LAB_LEFT_SECTION}>
                    <div className={LAB_MT_CARD}>
                      <div className="flex h-full min-h-0 flex-col gap-3 p-4">
                        <Skeleton className="h-4 w-40 shrink-0" />
                        <Skeleton className="min-h-0 w-full flex-1" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className={LAB_RIGHT_COL}>
                  <div className={LAB_SECTION}>
                    <div className={LAB_RIGHT_CARD}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Skeleton className="h-4 w-32" />
                          <div className="flex gap-1">
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-8 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-28 w-full" />
                        <Skeleton className="h-9 w-28" />
                        <Skeleton className="h-24 w-full" />
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
