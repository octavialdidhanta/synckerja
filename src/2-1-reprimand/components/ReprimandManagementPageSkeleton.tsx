import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/**
 * Layout mirror of ReprimandManagementPage: header + tabs, filters, metrics, department table card, overview sidebar.
 */
export function ReprimandManagementPageSkeleton() {
  const { t } = useAppTranslation();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/40 font-sans"
      aria-busy
      aria-label={t("reprimands.page.loadingAria", "Loading reprimand data")}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-1 flex-shrink-0 px-1 py-3">
            <Skeleton className="mb-2 h-7 w-56 max-w-[80%]" />
            <Skeleton className="mb-4 h-3 w-full max-w-md" />
            <div className="flex gap-6 border-b border-border pb-1">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-8 w-36" />
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
            <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col">
              <div className="mb-2 flex-shrink-0 rounded-md border border-border bg-card p-2">
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-full max-w-[220px]" />
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>

              <div className="mb-2 grid flex-shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  "border-red-200 bg-red-50",
                  "border-brand-blue/30 bg-brand-blue/10",
                  "border-emerald-200 bg-emerald-50",
                  "border-orange-200 bg-orange-50",
                ].map((cardClass, i) => (
                  <div key={i} className={`rounded-md border p-4 ${cardClass}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <Skeleton className="h-4 w-28 bg-background/60" />
                      <Skeleton className="h-5 w-5 rounded bg-background/60" />
                    </div>
                    <Skeleton className="mb-1 h-8 w-12 bg-background/60" />
                    <Skeleton className="h-3 w-24 bg-background/60" />
                  </div>
                ))}
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-3">
                  <Skeleton className="h-9 w-full max-w-xs" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
                <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-2">
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            </div>

            <div className="col-span-3 flex h-full min-h-0 flex-col">
              <div className="flex max-h-[calc(100vh-120px)] flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-full max-w-[200px]" />
                </div>
                <div className="min-h-0 flex-1 space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-16 rounded-md" />
                    <Skeleton className="h-16 rounded-md" />
                    <Skeleton className="h-16 rounded-md" />
                    <Skeleton className="h-16 rounded-md" />
                  </div>
                  <Skeleton className="h-28 w-full rounded-md" />
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-md" />
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 border-t border-border px-4 py-2">
                  <Skeleton className="h-3 w-full max-w-[220px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
