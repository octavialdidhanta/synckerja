import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileReminderBillsTab } from "@/mobile/2-bills/section/MobileReminderBillsTab";
import { EXPENSE_TAB_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export default function MobileReminderBillsPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      pagePath={EXPENSE_TAB_PAGE_PATH.bills}
      initialTab="bills"
    >
      <MobileReminderBillsTab />
    </MobileExpensesShell>
  );
}

