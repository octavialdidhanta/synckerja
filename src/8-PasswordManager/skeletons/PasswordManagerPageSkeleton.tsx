import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  PASSWORD_MANAGER_CONTENT_GRID,
  PASSWORD_MANAGER_MAIN_COLUMN,
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
                <div className="mb-1 min-w-0 shrink-0 px-1 pt-1 pb-0">
                  <Skeleton className="mb-1.5 h-10 w-48 max-w-full" />
                  <Skeleton className="h-8 w-40" />
                </div>

                <div className={PASSWORD_MANAGER_MAIN_COLUMN}>
                  <div className="shrink-0">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex h-10 items-center justify-between rounded-md border border-brand-blue/15 bg-card px-3 shadow-sm"
                        >
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-7 w-7 rounded-md" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={PASSWORD_MANAGER_CONTENT_GRID}>
                    <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                      <div className={PASSWORD_MANAGER_PANEL_SECTION}>
                        <div className={PASSWORD_MANAGER_PANEL_CARD}>
                          <div className="flex h-10 flex-shrink-0 items-center border-b border-brand-blue/15 px-4">
                            <Skeleton className="h-4 w-24" />
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
                          <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue/5 px-3 py-2">
                            <div className="flex flex-nowrap items-center gap-2">
                              <Skeleton className="h-10 w-24 shrink-0 rounded-md" />
                              <Skeleton className="h-10 min-w-[140px] flex-1 rounded-md" />
                              <Skeleton className="h-10 w-[180px] shrink-0 rounded-md" />
                              <Skeleton className="h-10 w-36 shrink-0 rounded-md" />
                            </div>
                          </div>
                          <div className="grid flex-1 grid-cols-1 gap-2 p-3 md:grid-cols-2">
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
                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
