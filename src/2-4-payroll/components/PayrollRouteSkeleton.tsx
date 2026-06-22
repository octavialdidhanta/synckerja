import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const SEAMLESS_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const PAYROLL_TABLE_SHELL_HEIGHT =
  "flex h-[calc(100dvh-280px)] min-h-[560px] min-w-0 flex-col [@media(max-height:900px)]:h-[calc(100dvh-300px)] [@media(max-height:900px)]:min-h-[620px]";

/** Mirrors `PayrollCalculationsPage`: header + tab, filters, metrics, table card, sidebar. */
export function PayrollRouteSkeleton({ embedded = false }: { embedded?: boolean }) {
  const { t } = useAppTranslation();
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden bg-gray-100 font-sans",
        embedded ? "h-full min-h-0 w-full" : "h-screen",
      )}
      aria-busy
      aria-label={t("payroll.page.loadingAria", "Loading payroll")}
    >
      <span className="sr-only">{t("payroll.page.loadingAria", "Loading payroll")}</span>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col">
              <div className="mb-1 flex-shrink-0 px-1 py-3">
                <Skeleton className="mb-0.5 h-7 w-56 max-w-[90%]" />
                <Skeleton className="h-3 w-full max-w-xl" />
                <div className="-mb-3 mt-3 flex space-x-6 border-b border-border pb-1">
                  <Skeleton className="h-8 w-44" />
                </div>
              </div>

              <div className="min-h-0 min-w-0 w-full">
                <div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-12 xl:items-stretch">
                  <div className="flex min-w-0 flex-col gap-2 xl:col-span-9">
                    <div className="rounded-md border border-border bg-card p-2">
                      <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-9 w-full max-w-[200px]" />
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-32" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-md border border-brand-blue/30 bg-brand-blue/10 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-5 w-5 rounded" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                          <Skeleton className="mt-1 h-3 w-28" />
                        </div>
                      ))}
                    </div>

                    <div className={PAYROLL_TABLE_SHELL_HEIGHT}>
                      <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                        <div className={cn(SEAMLESS_SCROLL, "min-h-0 flex-1 space-y-2 p-3")}>
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
                  </div>

                  <div className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden xl:col-span-3 xl:h-full xl:max-h-full">
                    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex-shrink-0 border-b border-border px-4 py-3">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="mt-1 h-3 w-full max-w-xs" />
                      </div>
                      <div className={cn(SEAMLESS_SCROLL, "min-h-0 flex-1 space-y-3 p-4")}>
                        <Skeleton className="h-10 w-full rounded-md" />
                        <Skeleton className="h-24 w-full rounded-md" />
                        <Skeleton className="h-32 w-full rounded-md" />
                      </div>
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <Skeleton className="h-3 w-40" />
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
          </div>
        </div>
      </div>
    </div>
  );
}
