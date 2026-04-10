import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileDebtTab } from "@/mobile/2-debt/section/MobileDebtTab";

export default function MobileDebtPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      initialTab="debt"
    >
      <MobileDebtTab />
    </MobileExpensesShell>
  );
}

