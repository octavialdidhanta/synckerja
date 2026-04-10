import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileApprovalsTab } from "@/mobile/2-approvals/section/MobileApprovalsTab";

export default function MobileApprovalsPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      initialTab="approvals"
    >
      <MobileApprovalsTab />
    </MobileExpensesShell>
  );
}

