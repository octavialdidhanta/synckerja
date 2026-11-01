import { SocialMediaHeaderSkeletonSlot } from "@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton";
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
        <div className="relative">
          <SocialMediaHeaderSkeletonSlot activeTabId="thinking-lab" />
          <Skeleton className="absolute right-1 top-3 h-8 w-40" />
        </div>
        <div className="mt-0 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
              <div className={LAB_MAIN_GRID}>
                <div className={LAB_LEFT_COL}>
                  <div className={LAB_LEFT_SECTION}>
                    <div className={LAB_MT_CARD}>
                      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch border-b border-white/15 bg-brand-blue">
                        <div className="space-y-2 px-5 py-3">
                          <Skeleton className="h-3 w-40 bg-white/25" />
                          <Skeleton className="h-4 w-full bg-white/25" />
                        </div>
                        <div className="flex items-center gap-3 py-3">
                          <span className="w-px self-stretch bg-white/40" />
                          <Skeleton className="h-4 w-4 bg-white/25" />
                        </div>
                        <div className="space-y-2 px-5 py-3">
                          <Skeleton className="h-3 w-28 bg-white/25" />
                          <Skeleton className="h-4 w-full bg-white/25" />
                        </div>
                      </div>
                      <div className="flex h-full min-h-0 flex-col p-4">
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
