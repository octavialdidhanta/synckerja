import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { OperationsDashboardPageSkeletonFrame } from "../layout/OperationsDashboardPageSkeletonFrame";

export function OperationsDashboardPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("operationsDashboard.page.loadingAria", "Loading dashboard");

  return (
    <OperationsDashboardPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full flex-1 rounded-lg" />
      </div>
    </OperationsDashboardPageSkeletonFrame>
  );
}
