import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobilePaymentTab } from "@/mobile/2-payment/section/MobilePaymentTab";
import { EXPENSE_TAB_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export default function MobilePaymentProcessPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      pagePath={EXPENSE_TAB_PAGE_PATH.payment}
      initialTab="payment"
    >
      <MobilePaymentTab />
    </MobileExpensesShell>
  );
}

