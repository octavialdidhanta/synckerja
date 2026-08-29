import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function OperationsDashboardPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("operationsDashboard.page.loadingAria", "Loading dashboard");

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
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40 px-1 py-3">
              <Skeleton className="mb-1 h-7 w-48 max-w-full" />
              <Skeleton className="mb-4 h-3 w-80 max-w-full" />
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
                <div className="col-span-12 flex flex-col gap-2 xl:col-span-10">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Skeleton className="h-28 w-full rounded-lg" />
                    <Skeleton className="h-28 w-full rounded-lg" />
                    <Skeleton className="h-28 w-full rounded-lg" />
                  </div>
                  <Skeleton className="h-72 w-full rounded-lg" />
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
