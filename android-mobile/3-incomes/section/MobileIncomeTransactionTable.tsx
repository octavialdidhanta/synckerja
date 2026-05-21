import { format } from "date-fns";
import { FileDown } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { IncomeTransactionWithRelations } from "@/4-1-dashboard/types";
import { getIncomeTransactionIdDisplay } from "@/4-1-dashboard/utils/incomeTransactionDisplayId";
import { isIncomeAllocationIncomplete } from "@/4-1-dashboard/utils/incomeAllocationStatus";
import { downloadIncomeReceiptFromTransaction } from "@/4-1-transaction/utils/incomeReceiptDownload";
import { useMemo } from "react";
import { useBankAccounts, type BankAccount } from "@/shared/hooks/finance/useBankAccounts";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";
import { MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS } from "@/mobile/shared/mobileWideFinanceTableViewport";

export type MobileIncomeTransactionTableProps = {
  transactions: IncomeTransactionWithRelations[];
  isLoading?: boolean;
  onView: (transaction: IncomeTransactionWithRelations) => void;
  onEdit?: (transaction: IncomeTransactionWithRelations) => void;
  onAllocate?: (transaction: IncomeTransactionWithRelations) => void;
  onDelete: (transaction: IncomeTransactionWithRelations) => void;
  canAllocateIncome?: boolean;
};

export function MobileIncomeTransactionTable({
  transactions,
  isLoading = false,
  onView,
  onEdit,
  onAllocate,
  onDelete,
  canAllocateIncome = false,
}: MobileIncomeTransactionTableProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { bankAccounts } = useBankAccounts({ includeInactive: true });
  const bankById = useMemo(
    () => new Map<string, BankAccount>(bankAccounts.map((b) => [b.id, b])),
    [bankAccounts],
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "cancelled":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const scrollViewportClass = cn(
    "nested-scroll-touch-chain min-h-0 min-w-0 overflow-x-auto overflow-y-auto seamless-scroll [touch-action:pan-x_pan-y]",
    "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    isMobile ? MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS : "max-h-[50vh] flex-1",
  );

  if (isLoading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className={scrollViewportClass}>
          <div className="p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-1/4 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded bg-muted" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className={scrollViewportClass}>
        <table className="w-full min-w-[2000px] select-none border-collapse">
          <thead className="sticky top-0 z-10 border-b border-slate-400/50 bg-slate-500">
            <tr>
              <th className="w-[200px] min-w-[200px] max-w-[200px] whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Transaction
              </th>
              <th className="w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Customer
              </th>
              <th className="whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Service
              </th>
              <th className="w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Type &amp; Category
              </th>
              <th className="whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Amount
              </th>
              <th className="whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Payment Method
              </th>
              <th className="max-w-[10rem] whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                {t("incomes.bankAccount", "Bank Account")}
              </th>
              <th className="w-[108px] min-w-[108px] max-w-[108px] whitespace-nowrap bg-slate-500 px-2 py-2 text-center text-xs font-medium text-slate-100">
                Recurring
              </th>
              <th className="whitespace-nowrap bg-slate-500 px-2 py-2 text-center text-xs font-medium text-slate-100">
                Receipt
              </th>
              <th className="whitespace-nowrap bg-slate-500 px-2 py-2 text-center text-xs font-medium text-slate-100">
                Status
              </th>
              <th className="w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                {t("incomes.tableTransactionId", "Transaction ID")}
              </th>
              <th className="w-[105px] min-w-[105px] max-w-[105px] whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Date
              </th>
              <th className="whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={13} className="h-16 text-center text-xs text-muted-foreground">
                  {t("incomes.noTransactions", "No transactions found")}
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const needsAllocation = isIncomeAllocationIncomplete(transaction);
                return (
                <tr
                  key={transaction.id}
                  className={cn(
                    "border-b border-border hover:bg-muted/30 active:bg-muted/50",
                    needsAllocation && "border-l-2 border-l-amber-400 bg-amber-50/30",
                  )}
                >
                  <td className="w-[200px] min-w-[200px] max-w-[200px] px-2 py-2 text-xs">
                    <div className="line-clamp-2 break-words font-medium leading-snug">
                      {transaction.description || t("incomes.transaction", "Transaction")}
                    </div>
                  </td>
                  <td className="w-[120px] min-w-[120px] max-w-[120px] px-3 py-2 text-xs font-medium">
                    {transaction.customer_name || "-"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{transaction.services?.name || "-"}</div>
                    {transaction.sub_services?.name ? (
                      <div className="text-xs text-muted-foreground">{transaction.sub_services.name}</div>
                    ) : null}
                  </td>
                  <td className="w-[130px] min-w-[130px] max-w-[130px] px-3 py-2 text-xs">
                    <div>{transaction.income_types?.name || "Unknown"}</div>
                    {transaction.income_categories?.name ? (
                      <div className="text-xs text-muted-foreground">{transaction.income_categories.name}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-semibold text-green-600">{formatToRupiah(transaction.amount)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{transaction.payment_method || "-"}</td>
                  <td className="max-w-[10rem] px-3 py-2 text-xs">
                    {(() => {
                      const joined = transaction.bank_accounts;
                      const fromJoin =
                        joined && typeof joined === "object" && !Array.isArray(joined) && joined.name
                          ? joined
                          : null;
                      const id = transaction.bank_account_id;
                      const fromList = !fromJoin && id ? bankById.get(id) : undefined;
                      const row = fromJoin
                        ? fromJoin
                        : fromList
                          ? {
                              name: fromList.name,
                              bank_name: fromList.bank_name,
                              account_number: fromList.account_number,
                            }
                          : null;
                      if (!row?.name) {
                        return <span className="text-muted-foreground">-</span>;
                      }
                      return (
                        <div>
                          <div className="break-words font-medium text-wrap">{row.name}</div>
                          {(row.bank_name || row.account_number) && (
                            <div className="break-words text-wrap text-xs text-muted-foreground">
                              {[row.bank_name, row.account_number].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="w-[108px] min-w-[108px] max-w-[108px] whitespace-nowrap px-3 py-2 text-center text-xs">
                    <Badge
                      variant="outline"
                      className={cn(
                        "mx-auto text-xs",
                        transaction.is_recurring
                          ? "border-purple-200 bg-purple-50 text-purple-700"
                          : "",
                      )}
                    >
                      {transaction.is_recurring
                        ? transaction.recurring_frequency
                          ? `Recurring - ${transaction.recurring_frequency}`
                          : "Recurring"
                        : "One-time"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {transaction.receipt_file_path ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mx-auto h-6 px-2 text-xs hover:bg-blue-50"
                        onClick={() => void downloadIncomeReceiptFromTransaction(transaction)}
                      >
                        <FileDown className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant={getStatusBadgeVariant(transaction.status || "")} className="mx-auto text-xs">
                        {transaction.status}
                      </Badge>
                      {needsAllocation ? (
                        <Badge
                          variant="outline"
                          className="mx-auto border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                        >
                          {t("incomes.allocation.badgeNeedsAllocation", "Needs allocation")}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="w-[120px] min-w-[120px] max-w-[120px] px-3 py-2 text-left text-xs">
                    {(() => {
                      const { display, title } = getIncomeTransactionIdDisplay(transaction);
                      return (
                        <div className="truncate font-mono text-xs" title={title}>
                          {display}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="w-[105px] min-w-[105px] max-w-[105px] px-3 py-2 text-left text-xs">
                    {format(new Date(transaction.transaction_date), "MMM dd, yyyy")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-left text-xs">
                    <div className="flex items-center justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => onView(transaction)}
                        className="touch-manipulation rounded-sm px-1 text-xs font-medium text-blue-600 hover:text-blue-800 active:text-blue-900"
                      >
                        {t("common.view", "View")}
                      </button>
                      {canAllocateIncome && needsAllocation && onAllocate ? (
                        <button
                          type="button"
                          onClick={() => onAllocate(transaction)}
                          className="touch-manipulation rounded-sm px-1 text-xs font-medium text-amber-800 hover:text-amber-900"
                        >
                          {t("incomes.allocation.actionAllocate", "Allocate")}
                        </button>
                      ) : null}
                      {canAllocateIncome && onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(transaction)}
                          className="touch-manipulation rounded-sm px-1 text-xs font-medium text-foreground hover:text-foreground/80"
                        >
                          {t("common.edit", "Edit")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!!transaction.has_income_allocations}
                        title={
                          transaction.has_income_allocations
                            ? t(
                                "incomes.delete.error.lockedByAllocation",
                                "This income is allocated to an expense or debt payment. Delete or change that payment first, then try again.",
                              )
                            : undefined
                        }
                        onClick={() => {
                          if (transaction.has_income_allocations) return;
                          onDelete(transaction);
                        }}
                        className="touch-manipulation rounded-sm px-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:pointer-events-none disabled:opacity-40"
                      >
                        {t("common.delete", "Delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
