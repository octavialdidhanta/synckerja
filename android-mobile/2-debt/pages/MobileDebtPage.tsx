import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileDebtTab } from "@/mobile/2-debt/section/MobileDebtTab";
import { EXPENSE_TAB_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export default function MobileDebtPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      pagePath={EXPENSE_TAB_PAGE_PATH.debt}
      initialTab="debt"
    >
      <MobileDebtTab />
    </MobileExpensesShell>
  );
}

