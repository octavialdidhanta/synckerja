import { SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SubscriptionExpiryBannerSlot } from "@/10-subscription/shared/SubscriptionExpiryBannerSlot";

export function ReportMobileShellHeader() {
  const { t } = useAppTranslation();

  return (
    <>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center border-b border-border bg-card p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight text-foreground">
              {t("digitalMarketing.report.title", "Report")}
            </h1>
          </div>
        </div>
      </header>
      <SubscriptionExpiryBannerSlot />
    </>
  );
}
