import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { DefaultPricesPageSkeletonFrame } from "../layout/DefaultPricesPageSkeletonFrame";

export function DefaultPricesPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("defaultPrices.page.loadingAria", "Loading products and services");

  return (
    <DefaultPricesPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        <div className="h-full w-[180px] shrink-0 border-r border-gray-200 bg-gray-50/80 p-3">
          <Skeleton className="mb-3 h-3 w-24" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="mb-1 h-8 w-full" />
          ))}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0" />
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Skeleton className="h-9 w-[180px]" />
            <Skeleton className="h-9 min-w-[160px] flex-1" />
            <Skeleton className="h-9 w-[160px]" />
            <Skeleton className="h-9 w-[140px]" />
            <Skeleton className="h-9 w-[140px]" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-12 w-full" />
          ))}
        </div>
      </div>
    </DefaultPricesPageSkeletonFrame>
  );
}
