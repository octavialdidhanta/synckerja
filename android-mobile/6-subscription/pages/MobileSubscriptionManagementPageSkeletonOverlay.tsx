import { BarChart3, Layers, Settings2 } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useMobileToolsShellLayout } from "@/shared/hooks/useMobileToolsShellLayout";
import { cn } from "@/shared/lib/utils";
import { ManagementTabPageSkeleton } from "@/mobile/6-subscription/ManagementTabPageSkeleton";

const SCROLL_CHAIN =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const TAB_KEYS = ["overview", "plans", "management"] as const;

/** Overlay loading mobile untuk `/subscription/management` (sinkron dengan shell halaman). */
export function MobileSubscriptionManagementPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { isAndroidNative, mainShellClassName, mainShellStyle, mobileHeaderChrome } =
    useMobileToolsShellLayout();
  const aria = t("subscription.management.loadingAria", "Loading subscription management");

  const labels: Record<(typeof TAB_KEYS)[number], string> = {
    overview: t("subscription.tabs.overview", "Overview"),
    plans: t("subscription.tabs.plans", "Plans"),
    management: t("subscription.tabs.management", "Management"),
  };

  const icons = { overview: BarChart3, plans: Layers, management: Settings2 };

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[200] flex w-full min-w-0 flex-col bg-background",
        isAndroidNative ? "h-dvh min-h-0 overflow-hidden" : "min-h-[100dvh]",
      )}
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <main className={cn(mainShellClassName, isAndroidNative && "min-h-0 flex-1")} style={mainShellStyle}>
        <header
          className={cn(mobileHeaderChrome.className, "min-h-0")}
          style={mobileHeaderChrome.style}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" aria-hidden />
            <div className="space-y-2">
              <Skeleton className="h-5 max-w-[220px]" aria-hidden />
              <Skeleton className="h-3 max-w-[min(100%,280px)]" aria-hidden />
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN}>
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="content-padding-above-nav-default mx-auto flex min-w-0 w-full max-w-md flex-1 flex-col space-y-1 px-2 pt-2">
                <ManagementTabPageSkeleton />
              </div>
            </div>
          </div>
        </div>

        <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
          <div className={cn("grid w-full grid-cols-3 safe-area-bottom-lower")}>
            {TAB_KEYS.map((key) => {
              const Icon = icons[key];
              const active = key === "management";
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
