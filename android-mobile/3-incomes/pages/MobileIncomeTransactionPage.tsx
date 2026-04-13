import { MobileIncomesShell } from "@/mobile/3-dashboard/pages/MobileIncomesShell";
import { useIncomeTransactionPageModel } from "@/4-1-transaction/hooks/useIncomeTransactionPageModel";
import { useIncomeTransactionDashboardStats } from "@/4-1-transaction/hooks/useIncomeTransactionDashboardStats";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileIncomeTransactionSection } from "../section/MobileIncomeTransactionSection";

export default function MobileIncomeTransactionPage() {
  const { t } = useAppTranslation();
  const model = useIncomeTransactionPageModel();
  const stats = useIncomeTransactionDashboardStats();

  return (
    <MobileIncomesShell
      title={t("incomes.pageTitle", "Incomes")}
      subtitle={t("incomes.transactionTitle", "Income")}
    >
      <MobileIncomeTransactionSection model={model} stats={stats} />
    </MobileIncomesShell>
  );
}
