import { MoreHorizontal, Edit, Trash2, Eye, FileDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Card, CardContent } from "@/shared/components/ui/card";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { IncomeTransactionWithRelations } from "@/4-1-dashboard/types";
import { getIncomeTransactionIdDisplay } from "@/4-1-dashboard/utils/incomeTransactionDisplayId";
import { downloadIncomeReceiptFromTransaction } from "@/4-1-transaction/utils/incomeReceiptDownload";
import { useIncomeTransactionListController } from "@/4-1-transaction/hooks/useIncomeTransactionListController";
import { IncomeTransactionDialogsBundle } from "@/4-1-transaction/section/IncomeTransactionDialogsBundle";

type Props = {
  transactions: IncomeTransactionWithRelations[];
  isLoading: boolean;
  onRefresh?: () => void;
};

export function MobileIncomeTransactionCardList({ transactions, isLoading, onRefresh }: Props) {
  const { t } = useAppTranslation();
  const ctrl = useIncomeTransactionListController(onRefresh);
  const { getStatusBadgeVariant, handleViewDetails, handleEdit, handleDelete } = ctrl;

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">{t("incomes.transactionsList", "Income Transactions")}</h2>
        <Button type="button" size="sm" className="h-8 px-3 text-xs" onClick={() => ctrl.setIsAddDialogOpen(true)}>
          + {t("incomes.addIncome", "Add Income")}
        </Button>
      </div>

      <div
        className="scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {transactions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("incomes.noTransactions", "No transactions found")}
          </p>
        ) : (
          transactions.map((transaction) => {
            const { display, title } = getIncomeTransactionIdDisplay(transaction);
            return (
              <Card key={transaction.id} className="border-border bg-card">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">
                        {transaction.description || t("incomes.transactionLabel", "Transaction")}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={title}>
                        ID {display}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem className="text-sm" onClick={() => handleViewDetails(transaction)}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t("common.viewDetails", "View Details")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-sm" onClick={() => handleEdit(transaction)}>
                          <Edit className="mr-2 h-4 w-4" />
                          {t("common.edit", "Edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-sm text-brand-red"
                          disabled={!!transaction.has_income_allocations}
                          onClick={() => {
                            if (transaction.has_income_allocations) return;
                            handleDelete(transaction);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("common.delete", "Delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-green-600">{formatToRupiah(transaction.amount)}</span>
                    <Badge variant={getStatusBadgeVariant(transaction.status || "")} className="text-xs">
                      {transaction.status || "-"}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span>{format(new Date(transaction.transaction_date), "MMM d, yyyy")}</span>
                    {transaction.customer_name ? (
                      <span className="ml-2">· {transaction.customer_name}</span>
                    ) : null}
                  </div>

                  {transaction.receipt_file_path ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => void downloadIncomeReceiptFromTransaction(transaction)}
                    >
                      <FileDown className="mr-1 h-3 w-3" />
                      {transaction.receipt_file_name || t("incomes.downloadReceipt", "Download receipt")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <IncomeTransactionDialogsBundle ctrl={ctrl} onRefresh={onRefresh} />
    </div>
  );
}
