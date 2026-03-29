import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/**
 * Layout mirror of EmployeePage: header + tabs, filters, metrics row, table card, sidebar.
 */
export function EmployeesPageSkeleton() {
  const { t } = useAppTranslation();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/40 font-sans"
      aria-busy
      aria-label={t("employees.page.loadingAria", "Loading employees")}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-1 flex-shrink-0 px-1 py-3">
            <Skeleton className="mb-2 h-7 w-56 max-w-[80%]" />
            <Skeleton className="mb-4 h-3 w-96 max-w-full" />
            <div className="flex gap-6 border-b border-border pb-1">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-8 w-36" />
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
            <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col">
              <div className="mb-2 flex-shrink-0 rounded-md border border-border bg-card p-2">
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-full max-w-[200px]" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>

              <div className="mb-2 grid flex-shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-md border border-brand-blue/30 bg-brand-blue/10 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-5 w-5 rounded" />
                    </div>
                    <Skeleton className="mb-1 h-8 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
                  <Skeleton className="h-8 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
                <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </div>

            <div className="col-span-3 flex h-full min-h-0 flex-col">
              <div className="flex max-h-[calc(100vh-120px)] flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-full max-w-[180px]" />
                    </div>
                    <Skeleton className="h-8 w-24 shrink-0" />
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-3 p-4">
                  <Skeleton className="h-24 w-full rounded-md" />
                  <Skeleton className="h-20 w-full rounded-md" />
                  <Skeleton className="h-32 w-full rounded-md" />
                </div>
                <div className="flex-shrink-0 border-t border-border px-4 py-2">
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
