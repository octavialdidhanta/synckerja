import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Must stay in sync with [PPh21ModuleShell](../layout/PPh21ModuleShell.tsx) scroll wrapper. */
const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Mirrors live `/tools/pph21-calculator` DOM: shell → ToolsHeaderAndTab strip → grid 12 →
 * `max-w-6xl` content → two-column cards (Parameter + Hasil) → footer info card.
 */
export function PPh21PageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("pph21.page.loadingAria", "Loading PPh 21 calculator");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={cn(MAIN_SCROLL, "min-w-0")}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              {/* Mirror ToolsHeaderAndTab (toolsTabMode pph21-calculator-only) */}
              <div className="mb-1 min-w-0 shrink-0 px-1 py-3">
                <div className="mb-3">
                  <Skeleton className="mb-0.5 h-7 w-[min(100%,14rem)] max-w-full" />
                  <Skeleton className="h-3 w-[min(100%,18rem)] max-w-full" />
                </div>
                <div className="-mb-3">
                  <nav className="flex flex-wrap gap-x-6 gap-y-1">
                    <Skeleton className="h-8 w-44 rounded-none border-b-2 border-brand-blue/30" />
                  </nav>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 flex-col">
                  {/* Mirror PPh21Calculator root: mx-auto max-w-6xl space-y-2 p-2 */}
                  <div className="mx-auto w-full max-w-6xl space-y-2 p-2">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {/* Card: Parameter Perhitungan */}
                      <div className="flex min-h-0 flex-col rounded-lg border border-brand-blue/20 bg-card shadow-sm ring-1 ring-brand-blue/10">
                        <div className="flex flex-col space-y-1.5 p-6 pb-2">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
                            <Skeleton className="h-5 w-44 max-w-full" />
                          </div>
                        </div>
                        <div className="space-y-3 p-6 pt-0">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-52" />
                            <div className="flex flex-col gap-2">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-full" />
                            </div>
                          </div>
                          <Skeleton className="h-px w-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-10 w-full rounded-md" />
                          </div>
                          <Skeleton className="h-px w-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <div className="grid grid-cols-2 gap-2">
                              {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 w-full" />
                              ))}
                            </div>
                          </div>
                          <Skeleton className="h-px w-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                          <Skeleton className="h-px w-full" />
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-10 w-full rounded-md" />
                          <Skeleton className="h-11 w-full rounded-md lg:h-12" />
                        </div>
                      </div>

                      {/* Card: Hasil Perhitungan (placeholder empty state) */}
                      <div className="flex min-h-0 flex-col rounded-lg border border-brand-blue/20 bg-card shadow-sm ring-1 ring-brand-blue/10">
                        <div className="flex flex-col gap-2 space-y-1.5 p-6 pb-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
                              <Skeleton className="h-5 w-40 max-w-full" />
                            </div>
                            <div className="flex gap-2">
                              <Skeleton className="h-8 w-16 rounded-md" />
                              <Skeleton className="h-8 w-20 rounded-md" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 p-6 pt-0">
                          <div className="rounded-lg border border-border bg-muted/40 p-4">
                            <Skeleton className="mb-3 h-4 w-48" />
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="mb-2 flex justify-between gap-2 last:mb-0">
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-24 shrink-0" />
                              </div>
                            ))}
                          </div>
                          <Skeleton className="h-32 w-full rounded-lg" />
                        </div>
                      </div>
                    </div>

                    {/* Footer info card (border-border, pt-3 content) */}
                    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                      <div className="space-y-2 p-6 pt-3">
                        <Skeleton className="h-4 w-full max-w-3xl" />
                        <Skeleton className="h-4 w-full max-w-2xl" />
                        <Skeleton className="h-4 w-full max-w-xl" />
                      </div>
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
