import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Suspense fallback for lazy company routes — shell layout (Loading Skeleton rule). */
export function CompanyRouteSkeleton() {
  const { t } = useAppTranslation();
  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 p-4"
      aria-busy
      aria-label={t("company.page.loadingAria", "Loading company")}
    >
      <span className="sr-only">{t("company.page.loadingAria", "Loading company")}</span>
      <div className="shrink-0 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-full max-w-xl" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-12">
        <div className="flex min-h-[200px] flex-col gap-2 rounded-lg border border-border bg-card p-4 lg:col-span-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="min-h-[120px] w-full flex-1" />
        </div>
        <div className="hidden min-h-[160px] rounded-lg border border-border bg-card p-4 lg:col-span-4 lg:block">
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
