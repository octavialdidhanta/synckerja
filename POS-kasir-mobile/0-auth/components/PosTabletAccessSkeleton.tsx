import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_TABLET_ACCESS_I18N } from "../lib/posTabletAccessCopy";

/** Layout-matched loading shell while tablet access resolves (fail-closed). */
export function PosTabletAccessSkeleton() {
  const { t } = useAppTranslation();

  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center bg-white px-6 py-8"
      aria-busy
      aria-label={t(POS_TABLET_ACCESS_I18N.loadingLabel, "Checking POS access")}
    >
      <span className="sr-only">
        {t(POS_TABLET_ACCESS_I18N.loadingLabel, "Checking POS access")}
      </span>
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="mt-4 h-10 w-full max-w-xs rounded-md" />
      </div>
    </div>
  );
}
