import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";

/**
 * Mobile home loading shell: PageAccessGuard + Suspense only (matches Absensi `main` + viewport style).
 */
export function AbsensiPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("mobileHome.loading", "Memuat");
  const { mainFixedStyle } = useVisualViewport();

  return (
    <main
      className="fixed inset-x-0 z-0 flex min-h-0 min-w-0 w-full max-w-none flex-col bg-background"
      style={mainFixedStyle}
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>

      <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-background">
        <header className="safe-area-top sticky top-0 z-30 flex min-h-[3.25rem] flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-24 max-w-full" aria-hidden />
              <Skeleton className="h-4 w-36 max-w-full" aria-hidden />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Skeleton className="h-6 w-14 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-9 rounded-lg" aria-hidden />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex h-0 shrink-0 items-center justify-center overflow-hidden" aria-hidden />

            <div className="content-padding-above-nav-home mx-auto w-full max-w-md space-y-1 px-2 pt-2">
              <div>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="px-4 py-6 text-center">
                    <Skeleton className="mx-auto mb-2 h-12 w-44 max-w-full" aria-hidden />
                    <Skeleton className="mx-auto h-5 w-56 max-w-full" aria-hidden />
                  </div>
                  <div className="px-4 pb-2">
                    <Skeleton className="mx-auto h-10 w-full max-w-[280px] rounded-lg" aria-hidden />
                  </div>
                  <div className="space-y-2 border-t border-border/60 px-4 py-3">
                    <Skeleton className="h-4 w-28" aria-hidden />
                    <Skeleton className="h-4 w-full" aria-hidden />
                    <Skeleton className="h-4 max-w-[220px] w-4/5" aria-hidden />
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-4 pb-3">
                    <Skeleton className="h-14 rounded-lg" aria-hidden />
                    <Skeleton className="h-14 rounded-lg" aria-hidden />
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="grid grid-cols-4 gap-2">
                    <Skeleton className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl py-2" aria-hidden />
                    <Skeleton className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl py-2" aria-hidden />
                    <Skeleton className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl py-2" aria-hidden />
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Skeleton className="h-5 w-5 shrink-0 rounded" aria-hidden />
                    <Skeleton className="h-4 w-40" aria-hidden />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-2">
                      <Skeleton className="h-4 w-20" aria-hidden />
                      <Skeleton className="h-4 w-24" aria-hidden />
                    </div>
                    <div className="flex justify-between gap-2">
                      <Skeleton className="h-4 w-16" aria-hidden />
                      <Skeleton className="h-4 max-w-[180px] flex-1" aria-hidden />
                    </div>
                    <Skeleton className="h-4 w-full" aria-hidden />
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <Skeleton className="mb-2 h-5 w-32" aria-hidden />
                  <Skeleton className="h-20 w-full rounded-md" aria-hidden />
                </div>
              </div>

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card" aria-hidden>
          <div className="mx-auto grid min-h-[52px] max-w-md grid-cols-5 safe-area-bottom-lower py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center justify-center gap-1 px-1">
                <Skeleton className="h-5 w-5 rounded" aria-hidden />
                <Skeleton className="h-3 w-10" aria-hidden />
              </div>
            ))}
          </div>
        </nav>
      </div>
    </main>
  );
}
