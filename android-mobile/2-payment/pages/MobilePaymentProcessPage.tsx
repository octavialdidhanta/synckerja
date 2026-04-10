import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import { PaymentTable } from "@/4-2-payment-process/section/PaymentTable";

export default function MobilePaymentProcessPage() {
  const { t } = useAppTranslation();
  const { data: requests = [], isLoading, refetch } = usePurchaseRequests();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      initialTab="payment"
    >
      <div className="w-full">
        <PaymentTable requests={requests} isLoading={isLoading} onRefresh={() => void refetch()} />
      </div>
    </MobileExpensesShell>
  );
}

