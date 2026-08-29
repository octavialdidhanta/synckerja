import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function ReceiptSettingsPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("receiptSettings.loadingAria", "Loading receipt settings");

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
                  <Skeleton className="mb-1 h-7 w-40 max-w-full" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                    <div className="h-full w-[180px] shrink-0 border-r border-gray-200 bg-gray-50/80 p-3">
                      <Skeleton className="mb-3 h-3 w-24" />
                      <Skeleton className="mb-1 h-8 w-full" />
                      <Skeleton className="mb-1 h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-6">
                      <Skeleton className="mb-3 h-7 w-32" />
                      <div className="mb-4 flex gap-4">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-8 w-40" />
                      </div>
                      <Skeleton className="mb-4 h-9 w-[180px]" />
                      <div className="grid gap-4 lg:grid-cols-12">
                        <div className="space-y-3 lg:col-span-5">
                          <Skeleton className="h-28 w-28" />
                          <Skeleton className="h-9 w-full" />
                          <Skeleton className="h-9 w-full" />
                          <div className="grid grid-cols-3 gap-2">
                            <Skeleton className="h-9" />
                            <Skeleton className="h-9" />
                            <Skeleton className="h-9" />
                          </div>
                          <Skeleton className="h-24 w-full" />
                        </div>
                        <Skeleton className="min-h-[560px] lg:col-span-7" />
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
