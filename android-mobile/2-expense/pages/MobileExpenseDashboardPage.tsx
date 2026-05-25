import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileExpenseDashboardTab } from "@/mobile/2-expense/section/MobileExpenseDashboardTab";
import { EXPENSE_TAB_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export default function MobileExpenseDashboardPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      pagePath={EXPENSE_TAB_PAGE_PATH.dashboard}
      initialTab="dashboard"
    >
      <MobileExpenseDashboardTab />
    </MobileExpensesShell>
  );
}

