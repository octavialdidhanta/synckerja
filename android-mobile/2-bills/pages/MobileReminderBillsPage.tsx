import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileReminderBillsTab } from "@/mobile/2-bills/section/MobileReminderBillsTab";

export default function MobileReminderBillsPage() {
  const { t } = useAppTranslation();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      initialTab="bills"
    >
      <MobileReminderBillsTab />
    </MobileExpensesShell>
  );
}

