import { BarChart3, Layers, Settings2 } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

const SCROLL_CHAIN =
  "scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const TAB_KEYS = ["overview", "plans", "management"] as const;

/**
 * Overlay loading mobile untuk `/subscription/overview`.
 * Meniru header + konten ringkas + `SubscriptionBottomTabs` (tab Overview aktif).
 * Struktur selaras android-mobile/rules/mobile-tools-layout-android.mdc.
 */
export function MobileSubscriptionOverviewPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("subscription.overview.loadingAria", "Loading subscription overview");

  const labels: Record<(typeof TAB_KEYS)[number], string> = {
    overview: t("subscription.tabs.overview", "Overview"),
    plans: t("subscription.tabs.plans", "Plans"),
    management: t("subscription.tabs.management", "Management"),
  };

  const icons = { overview: BarChart3, plans: Layers, management: Settings2 };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex min-h-screen w-full min-w-0 flex-col bg-background"
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <main className="fixed inset-x-0 z-0 flex flex-col bg-background" style={mainFixedStyle}>
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" aria-hidden />
            <div className="space-y-2">
              <Skeleton className="h-5 max-w-[200px]" aria-hidden />
              <Skeleton className="h-3 max-w-[min(100%,240px)]" aria-hidden />
            </div>
          </div>
          <div />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN}>
            <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-2 content-padding-above-nav-default">
              <Card className="border border-border p-4">
                <div className="mb-2 flex items-start justify-between">
                  <Skeleton className="h-5 w-36" aria-hidden />
                  <Skeleton className="h-6 w-14 rounded" aria-hidden />
                </div>
                <Skeleton className="h-4 w-full" aria-hidden />
              </Card>

              <Card className="border border-border p-4">
                <Skeleton className="mb-3 h-5 w-28" aria-hidden />
                <Skeleton className="h-40 w-full rounded-md" aria-hidden />
              </Card>

              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-24 rounded-lg" aria-hidden />
                <Skeleton className="h-24 rounded-lg" aria-hidden />
              </div>
            </div>
          </div>
        </div>

        <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
          <div className="safe-area-bottom-lower mx-auto grid w-full max-w-md grid-cols-3">
            {TAB_KEYS.map((key) => {
              const Icon = icons[key];
              const active = key === "overview";
              return (
                <div
                  key={key}
                  className={cn("flex flex-col items-center px-1 py-2", active ? "text-primary" : "text-muted-foreground")}
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
