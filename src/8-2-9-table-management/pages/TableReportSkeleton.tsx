import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { TableManagementPageSkeletonFrame } from "../layout/TableManagementPageSkeletonFrame";

/** Layout-matched skeleton for Table Report. */
export function TableReportSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("tableManagement.page.loadingAria", "Loading table management");

  return (
    <TableManagementPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
        <Skeleton className="mb-2 h-7 w-40" />
        <div className="mb-3 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="mb-3 flex gap-6">
          <Skeleton className="h-14 w-28" />
          <Skeleton className="h-14 w-28" />
        </div>
        <div className="min-h-0 flex-1 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </TableManagementPageSkeletonFrame>
  );
}
