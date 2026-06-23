import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  CALCULATOR_MAIN_CARD,
  CALCULATOR_MAIN_GRID,
  CALCULATOR_MAIN_SECTION,
  CALCULATOR_SIDEBAR_CARD,
} from "@/8-3-calculator/layout/calculatorLayout";

/**
 * Layout-matched shell for Calculator routes (guard, Suspense, hard refresh).
 */
export function CalculatorPageSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label="Loading calculator"
    >
      <span className="sr-only">Loading calculator</span>
      <div className="flex min-h-0 min-w-0 w-full flex-1">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 min-w-0 shrink-0 space-y-3 px-1 py-3">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-72 max-w-full" />
                  <div className="flex gap-6">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>

                <div className={CALCULATOR_MAIN_GRID}>
                  <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <div className={CALCULATOR_MAIN_SECTION}>
                      <div className={CALCULATOR_MAIN_CARD}>
                        <div className="min-h-0 flex-1 space-y-4 px-6 py-6">
                          <Skeleton className="min-h-[320px] w-full rounded-lg" />
                          <Skeleton className="min-h-[280px] w-full rounded-lg" />
                          <Skeleton className="min-h-[280px] w-full rounded-lg" />
                        </div>
                        <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-2">
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                    <div className={CALCULATOR_SIDEBAR_CARD}>
                      <div className="min-h-0 flex-1 space-y-2 p-6">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full rounded-md" />
                        <Skeleton className="h-20 w-full rounded-md" />
                        <Skeleton className="h-20 w-full rounded-md" />
                      </div>
                      <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-2">
                        <Skeleton className="h-3 w-32" />
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
