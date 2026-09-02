import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsPageSkeletonFrame } from "../layout/ReportsPageSkeletonFrame";

export function ReportsPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.page.loadingAria", "Loading reports");

  return (
    <ReportsPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        <div className="flex w-[180px] shrink-0 flex-col gap-2 border-r border-gray-200 bg-gray-50/80 p-3">
          <Skeleton className="mb-1 h-3 w-16" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col space-y-3 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </ReportsPageSkeletonFrame>
  );
}
