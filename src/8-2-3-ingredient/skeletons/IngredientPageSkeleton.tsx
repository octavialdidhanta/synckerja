import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { IngredientPageSkeletonFrame } from "../layout/IngredientPageSkeletonFrame";

export function IngredientPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("ingredient.page.loadingAria", "Loading ingredients");

  return (
    <IngredientPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 min-w-[160px] flex-1" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-12 w-full" />
        ))}
      </div>
    </IngredientPageSkeletonFrame>
  );
}
