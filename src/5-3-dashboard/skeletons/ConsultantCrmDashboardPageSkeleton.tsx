import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

const TAB_SKELETON_WIDTHS = ["w-[118px]", "w-[168px]"];

/**
 * Mirrors `CRMDashboardPage` + `HeaderAndTab` (Dashboard + Leads tabs on CRM core) + `CRMDashboardContent` shell for
 * `/omnichannel/crm` — guard, Suspense, and in-page overlay share this component.
 */
export function ConsultantCrmDashboardPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("operations.consultant.dashboard.loadingAria", "Loading CRM dashboard");
  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-1 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-h-0 min-w-0 flex-1 flex-col">
              {/* HeaderAndTab */}
              <div className="mb-1 min-w-0 shrink-0">
                <div className="min-w-0 max-w-full px-1 py-3">
                  <div className="mb-3 min-w-0 space-y-1.5">
                    <Skeleton className="h-7 w-16 max-w-[90vw]" />
                    <Skeleton className="h-3 w-full max-w-md" />
                  </div>
                  <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
                    <nav className="flex min-w-0 flex-nowrap gap-x-6">
                      {TAB_SKELETON_WIDTHS.map((w, i) => (
                        <Skeleton key={i} className={`h-9 ${w} shrink-0 rounded-sm`} />
                      ))}
                    </nav>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-1 gap-2 xl:grid-cols-2">
                <div
                  className={cn(
                    'box-border flex min-h-0 w-full max-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-lg border border-surface-border bg-card shadow-sm',
                    'xl:h-full xl:max-h-none',
                    'xl:max-w-none',
                  )}
                >
                  <div
                    className={cn(
                      'scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4',
                      '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    )}
                  >
                    <div className="min-w-0 max-w-full space-y-4">
                      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex min-w-0 flex-col rounded-lg border border-surface-border bg-gradient-to-br from-muted/60 to-muted/30 p-4"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-4 w-4 shrink-0 rounded-md" />
                            </div>
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="mt-2 h-2 w-32" />
                          </div>
                        ))}
                      </div>

                      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex min-w-0 flex-col rounded-lg border border-surface-border bg-card p-4 shadow-sm"
                          >
                            <Skeleton className="mb-1 h-5 w-40" />
                            <Skeleton className="mb-3 h-3 w-48" />
                            <div className="space-y-3">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-[85%] max-w-full" />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="min-w-0 overflow-hidden rounded-lg border border-surface-border bg-card shadow-sm">
                        <div className="border-b border-surface-border p-4 pb-3">
                          <Skeleton className="h-5 w-36" />
                        </div>
                        <div className="min-w-0 p-4 pt-3">
                          <div className="space-y-3">
                            <Skeleton className="h-10 w-full max-w-sm" />
                            <Skeleton className="min-h-[200px] w-full rounded-md bg-muted/40" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="shrink-0 border-t border-border bg-muted/30 px-4 py-2.5"
                    aria-hidden
                  >
                    <div className="mx-auto max-w-md space-y-1.5">
                      <Skeleton className="mx-auto h-3 w-32" />
                      <Skeleton className="mx-auto h-3 w-full max-w-[280px]" />
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    'box-border flex min-h-0 w-full max-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-lg border border-surface-border bg-card shadow-sm',
                    'xl:h-full xl:max-h-none',
                    'xl:max-w-none',
                  )}
                >
                  <div
                    className={cn(
                      'scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4',
                      '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    )}
                  >
                    <div className="flex min-h-0 w-full flex-col gap-2">
                  <div className="w-full min-w-0 shrink-0">
                    <div className="rounded-lg border border-surface-border bg-card shadow-sm">
                      <div className="space-y-3 border-b border-surface-border p-3 sm:p-4">
                        <Skeleton className="h-5 w-48 max-w-full" />
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <Skeleton className="h-9 w-full sm:max-w-[220px]" />
                          <Skeleton className="h-9 w-full sm:max-w-[160px]" />
                          <Skeleton className="h-9 w-full sm:max-w-[160px]" />
                        </div>
                        <Skeleton className="h-3 w-full max-w-xs" />
                      </div>
                      <div className="space-y-2 p-3 sm:p-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-surface-border bg-card p-3 shadow-sm"
                          >
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="mt-2 h-8 w-12" />
                            <Skeleton className="mt-2 h-3 w-24" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 min-w-0 w-full flex-1">
                    <div className="space-y-3 rounded-lg border border-surface-border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-6 w-44" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-9 w-full min-[720px]:w-56" />
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-32" />
                      </div>
                      <Skeleton className="h-16 w-full max-w-2xl" />
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                            <Skeleton className="h-3 w-36" />
                            <Skeleton className="mt-3 h-9 w-24" />
                            <Skeleton className="mt-4 h-4 w-20" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 min-w-0 w-full flex-1">
                    <div className="space-y-3 rounded-lg border border-surface-border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Skeleton className="h-6 w-56" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-9 w-20" />
                          <Skeleton className="h-9 w-9" />
                          <Skeleton className="h-9 w-48" />
                          <Skeleton className="h-9 w-32" />
                          <Skeleton className="h-9 w-40" />
                        </div>
                      </div>
                      <Skeleton className="h-12 w-full max-w-3xl" />
                      <div className="rounded-md border border-border">
                        <Skeleton className="h-10 w-full rounded-none rounded-t-md" />
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-11 w-full rounded-none border-t border-border" />
                        ))}
                      </div>
                      <div className="flex justify-between gap-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-8 w-40" />
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 min-w-0 w-full flex-1">
                    <div className="space-y-3 rounded-lg border border-surface-border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Skeleton className="h-6 w-60" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-9 w-20" />
                          <Skeleton className="h-9 w-9" />
                          <Skeleton className="h-9 w-48" />
                          <Skeleton className="h-9 w-32" />
                          <Skeleton className="h-9 w-40" />
                        </div>
                      </div>
                      <Skeleton className="h-12 w-full max-w-3xl" />
                      <div className="rounded-md border border-border">
                        <Skeleton className="h-10 w-full rounded-none rounded-t-md" />
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-11 w-full rounded-none border-t border-border" />
                        ))}
                      </div>
                      <div className="flex justify-between gap-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-8 w-40" />
                      </div>
                    </div>
                  </div>
                    </div>
                  </div>
                  <div
                    className="shrink-0 border-t border-border bg-muted/30 px-4 py-2.5"
                    aria-hidden
                  >
                    <div className="mx-auto max-w-md space-y-1.5">
                      <Skeleton className="mx-auto h-3 w-36" />
                      <Skeleton className="mx-auto h-3 w-full max-w-[300px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
