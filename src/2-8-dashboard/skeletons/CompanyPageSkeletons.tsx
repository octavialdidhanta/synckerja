import { CompanyModuleShell } from "@/2-8-dashboard/layout/CompanyModuleShell";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type SkeletonProps = { className?: string };

/** Single scroll column + card (dashboard / profile) — mirrors CompanyDashboardPage grid + card */
export function CompanyDashboardPageSkeleton({ className }: SkeletonProps) {
  const { t } = useAppTranslation();
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} aria-busy aria-label={t("company.page.loadingAria", "Loading company")}>
      <span className="sr-only">{t("company.page.loadingAria", "Loading company")}</span>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <div className="space-y-2 xl:col-span-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </div>
  );
}

/**
 * Shared 9+3 skeleton matching `CompanyFilesPage` DOM (filters, metrics, table + footer, overview cards + footer).
 * Used for `/company/files` and `/company/company-assets` so layout/size/placement stay aligned.
 */
function CompanyNineThreeFilesLayoutSkeleton({ className }: SkeletonProps) {
  const { t } = useAppTranslation();
  const metricCardClasses = [
    "border border-border bg-info-muted",
    "border border-border bg-success-muted",
    "border border-border bg-accent",
    "border border-border bg-warning-muted",
  ] as const;

  return (
    <div
      className={cn(
        "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]",
        className
      )}
      aria-busy
      aria-label={t("company.page.loadingAria", "Loading company")}
    >
      <span className="sr-only">{t("company.page.loadingAria", "Loading company")}</span>

      <div className="col-span-9 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col self-stretch">
        <div className="mb-2 shrink-0">
          <div className="rounded-md border border-border bg-card p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-9 min-w-[150px] flex-1 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md sm:w-36 lg:w-40" />
              <Skeleton className="h-9 w-full rounded-md sm:w-36 lg:w-40" />
              <Skeleton className="h-9 w-full rounded-md sm:w-36 lg:w-40" />
              <Skeleton className="h-9 w-[42px] shrink-0 rounded-md" />
              <Skeleton className="h-9 w-[124px] shrink-0 rounded-md" />
            </div>
          </div>
        </div>

        <div className="mb-2 shrink-0">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {metricCardClasses.map((cardClass, i) => (
              <div key={i} className={cn("rounded-md p-4", cardClass)}>
                <div className="mb-3 flex items-center justify-between">
                  <Skeleton className="h-4 w-24 bg-background/50" />
                  <Skeleton className="h-5 w-5 shrink-0 rounded-md bg-background/50" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-8 w-14 bg-background/50" />
                  <Skeleton className="h-3 w-28 bg-background/50" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col seamless-scroll rounded-lg border border-border bg-card shadow-sm">
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
                <div className="overflow-hidden rounded-t-lg border border-border">
                  <div className="bg-muted/50 px-3 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-4 w-[200px] shrink-0" />
                      <Skeleton className="h-4 w-20 shrink-0" />
                      <Skeleton className="h-4 w-16 shrink-0" />
                      <Skeleton className="h-4 w-16 shrink-0" />
                      <Skeleton className="h-4 w-24 shrink-0" />
                      <Skeleton className="h-4 w-20 shrink-0" />
                      <Skeleton className="h-4 w-28 shrink-0" />
                      <Skeleton className="h-4 w-20 shrink-0" />
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                        <Skeleton className="h-4 min-w-[180px] flex-1 max-w-[280px]" />
                        <Skeleton className="h-4 w-16 shrink-0" />
                        <Skeleton className="h-4 w-14 shrink-0" />
                        <Skeleton className="h-4 w-14 shrink-0" />
                        <Skeleton className="h-4 w-20 shrink-0" />
                        <Skeleton className="h-4 w-24 shrink-0" />
                        <Skeleton className="h-4 w-24 shrink-0" />
                        <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-3 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col self-stretch">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
          <div className="shrink-0 border-b border-border px-4 py-1.5">
            <div className="flex flex-col">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1 h-3 w-full max-w-[240px]" />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain space-y-4 p-4">
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Skeleton className="h-3 w-full max-w-[200px]" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompanyAssetsPageSkeleton({ className }: SkeletonProps) {
  return <CompanyNineThreeFilesLayoutSkeleton className={className} />;
}

export function CompanyFilesPageSkeleton({ className }: SkeletonProps) {
  return <CompanyNineThreeFilesLayoutSkeleton className={className} />;
}

/** `PageAccessGuard` `loadingShell` for `/company/company-assets` — mirrors live shell + inner skeleton. */
export function CompanyAssetsGuardLoadingShell() {
  return (
    <CompanyModuleShell>
      <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CompanyAssetsPageSkeleton className="min-h-0 flex-1" />
        </div>
      </div>
    </CompanyModuleShell>
  );
}

/** `PageAccessGuard` `loadingShell` for `/company/files` — same shell + 9+3 skeleton as live page. */
export function CompanyFilesGuardLoadingShell() {
  return (
    <CompanyModuleShell>
      <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CompanyFilesPageSkeleton className="min-h-0 flex-1" />
        </div>
      </div>
    </CompanyModuleShell>
  );
}

