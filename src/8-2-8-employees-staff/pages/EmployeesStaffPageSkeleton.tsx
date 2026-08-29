import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function EmployeesStaffPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("employeesStaff.page.loadingAria", "Loading employees staff");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <div className="px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="mb-1 h-7 w-40 max-w-full" />
                    <Skeleton className="h-3 w-80 max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <Skeleton className="h-8 w-36" />
                      <Skeleton className="h-8 w-36" />
                      <Skeleton className="h-8 w-28" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                  <div className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm">
                    <Skeleton className="mb-2 h-7 w-40" />
                    <Skeleton className="mb-2 h-3 w-full max-w-2xl" />
                    <Skeleton className="mb-2 h-3 w-4/5 max-w-xl" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                  <div className="grid min-h-[420px] min-w-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
                      <Skeleton className="mb-3 h-4 w-40" />
                      <Skeleton className="mb-2 h-3 w-full" />
                      <Skeleton className="mb-2 h-10 w-full" />
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="mb-2 h-10 w-full" />
                      ))}
                    </div>
                    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
                      <Skeleton className="mb-3 h-4 w-36" />
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="mb-2 h-10 w-full" />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              </div>
              <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
