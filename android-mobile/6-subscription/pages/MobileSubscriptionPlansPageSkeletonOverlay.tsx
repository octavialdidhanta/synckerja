import { BarChart3, Layers, Settings2, Shield } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

const SCROLL_CHAIN =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const TAB_KEYS = ["overview", "plans", "management"] as const;

/**
 * Overlay loading mobile untuk `/subscription/plans`.
 * Meniru shell + header + scroll + konten (mobile-tools-layout-android) + `SubscriptionBottomTabs` (tab Plans aktif).
 */
export function MobileSubscriptionPlansPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("subscription.plans.loadingAria", "Loading subscription plans");

  const labels: Record<(typeof TAB_KEYS)[number], string> = {
    overview: t("subscription.tabs.overview", "Overview"),
    plans: t("subscription.tabs.plans", "Plans"),
    management: t("subscription.tabs.management", "Management"),
  };

  const icons = { overview: BarChart3, plans: Layers, management: Settings2 };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex min-h-screen w-full min-w-0 flex-col overflow-hidden bg-background"
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <main
        className="fixed inset-x-0 z-0 flex min-h-0 w-full max-w-none min-w-0 flex-1 flex-col bg-background"
        style={mainFixedStyle}
      >
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" aria-hidden />
            <div className="space-y-2">
              <Skeleton className="h-5 max-w-[200px]" aria-hidden />
              <Skeleton className="h-3 max-w-[min(100%,280px)]" aria-hidden />
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN}>
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mx-auto flex w-full max-w-md flex-1 flex-col space-y-1 px-2 pt-2 content-padding-above-nav-default">
                <Skeleton className="h-16 w-full rounded-xl border border-border" aria-hidden />

                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="border border-border p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Skeleton className="h-9 w-9 shrink-0 rounded-lg" aria-hidden />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-5 w-32" aria-hidden />
                          <Skeleton className="h-3 w-full max-w-[200px]" aria-hidden />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-16 shrink-0 rounded-full" aria-hidden />
                    </div>
                    <Skeleton className="mb-3 h-8 w-full rounded-md" aria-hidden />
                    <Skeleton className="mb-2 h-10 w-full" aria-hidden />
                    <Skeleton className="h-9 w-full rounded-md" aria-hidden />
                  </Card>
                ))}

                <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 shrink-0 text-primary opacity-60" aria-hidden />
                    <Skeleton className="h-4 w-40" aria-hidden />
                  </div>
                  <Skeleton className="h-3 w-full" aria-hidden />
                  <Skeleton className="h-3 w-full" aria-hidden />
                  <Skeleton className="h-3 max-w-[220px]" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
          <div className={cn("grid w-full grid-cols-3 safe-area-bottom-lower")}>
            {TAB_KEYS.map((key) => {
              const Icon = icons[key];
              const active = key === "plans";
              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col items-center px-1 py-2",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="mb-1 h-5 w-5 shrink-0 opacity-80" aria-hidden />
                  <span className="text-center text-xs font-medium">{labels[key]}</span>
                </div>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
