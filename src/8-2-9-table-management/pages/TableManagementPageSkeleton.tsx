import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { TableManagementPageSkeletonFrame } from "../layout/TableManagementPageSkeletonFrame";

export function TableManagementPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("tableManagement.page.loadingAria", "Loading table management");

  return (
    <TableManagementPageSkeletonFrame ariaLabel={aria}>
      <div className="flex-shrink-0 border-b px-3 py-2">
        <div className="flex h-10 items-center gap-2">
          <Skeleton className="h-6 w-32 shrink-0" />
          <Skeleton className="h-10 w-[180px] shrink-0" />
          <Skeleton className="h-10 min-w-[160px] flex-1" />
          <Skeleton className="h-10 w-40 shrink-0" />
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
