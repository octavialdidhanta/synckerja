import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileExpenseDashboardTab } from "@/mobile/2-expense/section/MobileExpenseDashboardTab";

export default function MobileExpenseDashboardPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      initialTab="dashboard"
    >
      <MobileExpenseDashboardTab />
    </MobileExpensesShell>
  );
}

