import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CustomersPageSkeletonFrame } from "../layout/CustomersPageSkeletonFrame";

export function CustomersPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("customers.page.loadingAria", "Loading customers");

  return (
    <CustomersPageSkeletonFrame ariaLabel={aria}>
      <div className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-9 w-48 max-w-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-2 flex gap-2 border-b border-slate-100 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="ml-auto h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
    </CustomersPageSkeletonFrame>
  );
}
