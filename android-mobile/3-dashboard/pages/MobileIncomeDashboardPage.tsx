import { MobileIncomesShell } from "@/mobile/3-dashboard/pages/MobileIncomesShell";
import { MobileIncomeDashboardTabContent } from "@/mobile/3-dashboard/section/MobileIncomeDashboardTabContent";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export default function MobileIncomeDashboardPage() {
  const { t } = useAppTranslation();
  return (
    <MobileIncomesShell title={t("incomes.pageTitle", "Incomes")} subtitle={t("incomes.dashboardSubtitle", "Dashboard")}>
      <MobileIncomeDashboardTabContent />
    </MobileIncomesShell>
  );
}
