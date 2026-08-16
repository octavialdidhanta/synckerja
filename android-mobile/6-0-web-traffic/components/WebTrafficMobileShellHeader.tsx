import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SubscriptionExpiryBannerSlot } from "@/10-subscription/shared/SubscriptionExpiryBannerSlot";

type WebTrafficMobileShellHeaderProps = {
  /** Omit when access is denied (title-only chrome). */
  onSync?: () => void;
  syncDisabled?: boolean;
  isSyncing?: boolean;
  headerActions?: ReactNode;
};

export function WebTrafficMobileShellHeader({
  onSync,
  syncDisabled,
  isSyncing,
  headerActions,
}: WebTrafficMobileShellHeaderProps) {
  const { t } = useAppTranslation();
  const showSync = onSync != null;

  return (
    <>
    <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="md:hidden shrink-0" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight text-foreground">
              {t("sidebar.digitalMarketing.webTraffic.mobileFooterTitle", "Web Traffic")}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {headerActions}
        {showSync ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={t("common.refresh", "Refresh")}
            onClick={onSync}
            disabled={syncDisabled}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </Button>
        ) : headerActions ? null : (
          <div className="w-9 shrink-0" aria-hidden />
        )}
      </div>
    </header>
    <SubscriptionExpiryBannerSlot />
    </>
  );
}
