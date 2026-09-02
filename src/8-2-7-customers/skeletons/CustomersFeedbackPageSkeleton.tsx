import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CustomersPageSkeletonFrame } from "../layout/CustomersPageSkeletonFrame";

export function CustomersFeedbackPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("customers.feedback.loadingAria", "Loading feedback");

  return (
    <CustomersPageSkeletonFrame ariaLabel={aria}>
      <div className="flex-shrink-0 space-y-3 border-b px-4 py-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </CustomersPageSkeletonFrame>
  );
}
