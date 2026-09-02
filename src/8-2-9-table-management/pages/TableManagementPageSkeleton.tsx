import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { TableManagementPageSkeletonFrame } from "../layout/TableManagementPageSkeletonFrame";

export function TableManagementPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("tableManagement.page.loadingAria", "Loading table management");

  return (
    <TableManagementPageSkeletonFrame ariaLabel={aria}>
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
    </TableManagementPageSkeletonFrame>
  );
}
