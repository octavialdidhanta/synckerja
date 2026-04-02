import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Mirrors `PayrollCalculationsPage`: header + tab ikut scroll, filters, metrics, table card, sidebar. */
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

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch xl:grid-cols-12">
                <div className="col-span-full flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9">
                  <div className="mb-2 shrink-0 rounded-md border border-border bg-card p-2">
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-9 w-full max-w-[200px]" />
                      <Skeleton className="h-9 w-32" />
                      <Skeleton className="h-9 w-32" />
                    </div>
                  </div>

                  <div className="mb-2 grid flex-shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-4">
                        <Skeleton className="mb-2 h-3 w-24" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>

                  <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
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
                </div>

                <div className="col-span-full flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3">
                  <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                    <div className="flex-shrink-0 border-b border-border px-4 py-3">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="mt-1 h-3 w-full max-w-xs" />
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 p-4">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-24 w-full rounded-md" />
                      <Skeleton className="h-32 w-full rounded-md" />
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
