import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/**
 * Layout mirror untuk route `/` — dipakai `PageAccessGuard` `loadingShell`, overlay data awal,
 * dan struktur sama dengan `ModernHomePage` + `HomeOKRDashboard` (motivation, greetings, tabs OKR, activity, status).
 */
export function HomePageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("home.page.loadingAria", "Memuat beranda");

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-background font-sans text-foreground"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="flex min-h-full min-h-0 flex-col">
            {/* SectionMotivation — mirror min-h wrapper + gradient card */}
            <div className="mb-2 mt-2 flex-shrink-0">
              <div className="relative min-h-[50px]">
                <div className="min-h-[80px] overflow-hidden rounded-lg bg-gradient-to-r from-primary to-brand-blue-deep">
                  <div className="flex h-full items-center space-x-3 p-4">
                    <Skeleton className="h-6 w-6 shrink-0 rounded-full bg-primary-foreground/25" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-[min(100%,420px)] bg-primary-foreground/25" />
                      <Skeleton className="h-3 w-[min(100%,200px)] bg-primary-foreground/20" />
                    </div>
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-primary-foreground/20" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid min-h-[calc(100dvh-210px)] flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
              {/* SectionProfile + SectionQuickMenu */}
              <div className="col-span-3 flex h-full min-h-0 flex-col">
                <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
                  <div className="flex-shrink-0 rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="mb-4 flex items-center space-x-3">
                      <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    <div className="flex flex-shrink-0 flex-col space-y-1.5 p-6 pb-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
                        <Skeleton className="h-5 w-[min(100%,220px)]" />
                      </div>
                    </div>
                    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto overflow-x-hidden p-6 pt-0">
                      <Skeleton className="h-28 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <div className="rounded-lg border border-border bg-card p-3">
                        <Skeleton className="mb-3 h-5 w-40" />
                        <Skeleton className="h-20 w-full rounded-md" />
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3">
                        <Skeleton className="mb-2 h-4 w-32" />
                        <div className="grid grid-cols-2 gap-2">
                          <Skeleton className="h-14 rounded-md" />
                          <Skeleton className="h-14 rounded-md" />
                          <Skeleton className="h-14 rounded-md" />
                          <Skeleton className="h-14 rounded-md" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* HomeOKRDashboard: SectionGreetings + Card/Tabs */}
              <div className="col-span-6 flex h-full min-h-0 flex-col">
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <div className="flex h-full min-h-0 flex-1 flex-col space-y-2">
                    {/* SectionGreetings */}
                    <div className="flex-shrink-0 overflow-hidden rounded-lg border border-border bg-gradient-to-r from-primary to-brand-blue-deep text-primary-foreground shadow-sm">
                      <div className="p-6">
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            <Skeleton className="h-8 w-[min(100%,300px)] bg-primary-foreground/25" />
                            <Skeleton className="h-3 w-[min(100%,280px)] bg-primary-foreground/20" />
                          </div>
                          <Skeleton className="h-9 w-9 shrink-0 rounded-md bg-primary-foreground/20" />
                        </div>
                        <div className="mt-4 flex items-center gap-4">
                          <Skeleton className="h-3 w-24 bg-primary-foreground/25" />
                          <Skeleton className="h-3 w-40 bg-primary-foreground/20" />
                        </div>
                      </div>
                    </div>

                    {/* OKR Card + TabsList (Company / Department / Individual) + tab body */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0">
                        <div className="mt-4 grid w-full flex-shrink-0 grid-cols-3 gap-1">
                          <Skeleton className="h-10 w-full rounded-md" />
                          <Skeleton className="h-10 w-full rounded-md" />
                          <Skeleton className="h-10 w-full rounded-md" />
                        </div>
                        <div className="mt-4 min-h-0 flex-1 space-y-4">
                          <div className="rounded-lg border border-border bg-muted/20 p-4">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="mt-3 h-24 w-full rounded-md" />
                          </div>
                          <Skeleton className="h-32 w-full rounded-lg" />
                          <Skeleton className="h-36 w-full rounded-lg" />
                          <Skeleton className="h-28 w-full rounded-lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SectionActivityNotifikasi standalone */}
              <div className="col-span-3 flex h-full min-h-0 flex-col">
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    <div className="flex flex-shrink-0 border-b border-border">
                      <div className="flex h-10 flex-1 items-center justify-center border-b-2 border-primary bg-accent px-2">
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex h-10 flex-1 items-center justify-center px-2">
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col pb-2 pt-2">
                      <Skeleton className="mx-4 mb-2 h-3 w-24" />
                      <div className="flex flex-wrap gap-2 px-4">
                        <Skeleton className="h-7 w-16 rounded-full" />
                        <Skeleton className="h-7 w-20 rounded-full" />
                        <Skeleton className="h-7 w-[4.5rem] rounded-full" />
                        <Skeleton className="h-7 w-24 rounded-full" />
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-4 pb-4">
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SectionStatusKaryawan */}
            <div className="mt-2 flex-shrink-0">
              <div className="rounded-md border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
                <div className="p-4">
                  <Skeleton className="h-14 w-full rounded-md" />
                </div>
              </div>
            </div>
            <div className="h-4 flex-shrink-0" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
