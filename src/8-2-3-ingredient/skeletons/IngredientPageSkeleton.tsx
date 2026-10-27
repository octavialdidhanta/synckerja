import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { IngredientPageSkeletonFrame } from "../layout/IngredientPageSkeletonFrame";

export function IngredientPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("ingredient.page.loadingAria", "Loading ingredients");

  return (
    <IngredientPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-1">
        <div className="mb-2 flex h-8 items-center gap-1.5">
          <Skeleton className="h-8 w-36 shrink-0" />
          <Skeleton className="h-8 w-[140px] shrink-0" />
          <Skeleton className="h-8 w-[140px] shrink-0" />
          <Skeleton className="h-8 w-[130px] shrink-0" />
          <Skeleton className="h-8 w-[120px] shrink-0" />
          <Skeleton className="h-8 min-w-[120px] flex-1" />
          <Skeleton className="h-8 w-28 shrink-0" />
          <Skeleton className="h-8 w-36 shrink-0" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-10 w-full" />
        ))}
      </div>
    </IngredientPageSkeletonFrame>
  );
}
