import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  PASSWORD_MANAGER_CONTENT_GRID,
  PASSWORD_MANAGER_PANEL_CARD,
  PASSWORD_MANAGER_PANEL_SECTION,
} from "@/8-PasswordManager/layout/passwordManagerLayout";

export function PasswordManagerPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("passwordManager.page.loadingAria", "Loading password manager");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 w-full flex-1">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 min-w-0 shrink-0 px-1 py-3">
                  <div className="mb-3 min-w-0 space-y-1.5">
                    <Skeleton className="h-7 w-48 max-w-full" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <Skeleton className="h-8 w-40" />
                  </div>
                </div>

                <div className="mb-2 flex-shrink-0">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

                <div className={PASSWORD_MANAGER_CONTENT_GRID}>
                  <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <div className={PASSWORD_MANAGER_PANEL_SECTION}>
                      <div className={PASSWORD_MANAGER_PANEL_CARD}>
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
                  </div>

                  <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <div className={PASSWORD_MANAGER_PANEL_SECTION}>
                      <div className={PASSWORD_MANAGER_PANEL_CARD}>
                        <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue/5 px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Skeleton className="h-9 min-w-[180px] flex-1 rounded-md" />
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
