import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function PasswordManagerPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("passwordManager.page.loadingAria", "Loading password manager");

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
                    <Skeleton className="mb-1 h-7 w-48 max-w-full" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <div className="flex flex-wrap gap-4">
                      <Skeleton className="h-8 w-40" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 flex-col">
                  <div className="mb-1 flex-shrink-0">
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-brand-blue/15 bg-card p-3 shadow-sm ring-1 ring-brand-blue/10"
                        >
                          <Skeleton className="mb-2 h-3 w-24" />
                          <Skeleton className="h-7 w-10" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
                    <div className="col-span-12 flex min-h-0 lg:col-span-3">
                      <div className="flex min-h-[280px] w-full flex-col rounded-lg border border-brand-blue/20 bg-card shadow-sm ring-1 ring-brand-blue/10">
                        <div className="flex-shrink-0 border-b border-brand-blue/15 px-4 py-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="mt-1 h-3 w-40" />
                        </div>
                        <div className="flex-1 space-y-2 p-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-full rounded-md" />
                          ))}
                        </div>
                        <div className="flex-shrink-0 border-t border-brand-blue/15 px-4 py-2">
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 flex min-h-0 lg:col-span-9">
                      <div className="flex min-h-[280px] w-full flex-col rounded-lg border border-brand-blue/20 bg-card shadow-sm ring-1 ring-brand-blue/10">
                        <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue/5 px-4 py-2">
                          <div className="flex gap-2">
                            <Skeleton className="h-9 flex-1 rounded-md" />
                            <Skeleton className="h-9 w-[200px] rounded-md" />
                            <Skeleton className="h-9 w-32 rounded-md" />
                          </div>
                        </div>
                        <div className="grid flex-1 grid-cols-1 gap-2 p-4 md:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-40 w-full rounded-md" />
                          ))}
                        </div>
                        <div className="flex-shrink-0 border-t border-brand-blue/15 px-4 py-2">
                          <Skeleton className="h-3 w-full" />
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
    </div>
  );
}
