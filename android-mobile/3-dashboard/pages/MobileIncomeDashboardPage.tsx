import { MobileIncomesShell } from "@/mobile/3-dashboard/pages/MobileIncomesShell";
import { MobileIncomeDashboardTabContent } from "@/mobile/3-dashboard/section/MobileIncomeDashboardTabContent";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export default function MobileIncomeDashboardPage() {
  const { t } = useAppTranslation();
  return (
    <MobileIncomesShell
      title={t("incomes.pageTitle", "Incomes")}
      subtitle={t("incomes.dashboardSubtitle", "Dashboard")}
      pagePath={MOBILE_PAGE_PATH.incomesDashboard}
    >
      <MobileIncomeDashboardTabContent />
    </MobileIncomesShell>
  );
}
