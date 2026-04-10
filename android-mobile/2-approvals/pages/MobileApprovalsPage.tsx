import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import { ApprovalTable } from "@/4-2-approvals/section/ApprovalTable";

export default function MobileApprovalsPage() {
  const { t } = useAppTranslation();
  const { data: requests = [], isLoading, refetch } = usePurchaseRequests();
  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      initialTab="approvals"
    >
      <div className="w-full">
        <ApprovalTable requests={requests} isLoading={isLoading} onRefresh={() => void refetch()} />
      </div>
    </MobileExpensesShell>
  );
}

