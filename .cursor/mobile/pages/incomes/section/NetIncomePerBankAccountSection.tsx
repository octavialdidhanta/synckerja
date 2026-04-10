import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useIncomeTransactions } from "@/features/4-1-dashboard/hooks/useIncomeTransactions";
import { useBankAccounts, type BankAccount } from "@/hooks/organized/useBankAccounts";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";
import { useExpenses } from "@/features/4_2_dashboard/hooks/useExpenses";
import { formatToRupiah } from "@/utils/formatCurrency";
import { NetBankAccountSwipeRow } from "@/features/4-1-dashboard/components/NetBankAccountSwipeRow";
import { BankTransferDialog } from "@/features/4-1-dashboard/components/BankTransferDialog";

const getDateRangeForPeriod = (period: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  let startDate: Date;
  let endDate: Date = new Date(currentYear, currentMonth, currentDate + 1);

  switch (period) {
    case "This Month":
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    case "Last Month": {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      startDate = new Date(lastMonthYear, lastMonth, 1);
      endDate = new Date(currentYear, currentMonth, 1);
      break;
    }
    case "Last 3 Months":
      startDate = new Date(currentYear, currentMonth - 3, 1);
      break;
    case "Last 6 Months":
      startDate = new Date(currentYear, currentMonth - 6, 1);
      break;
    case "This Year":
      startDate = new Date(currentYear, 0, 1);
      break;
    default:
      startDate = new Date(currentYear, currentMonth, 1);
  }
  return { startDate, endDate };
};

const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function NetIncomePerBankAccountSection() {
  const { t } = useAppTranslation();
  const selectedPeriod = "This Month";
  const selectedBankAccount = "all";
  const [netBankOpenSwipeId, setNetBankOpenSwipeId] = useState<string | null>(null);
  const [bankTransferDialogOpen, setBankTransferDialogOpen] = useState(false);
  const [bankTransferSource, setBankTransferSource] = useState<BankAccount | null>(null);

  const { incomeTransactions, isLoading: transactionsLoading } = useIncomeTransactions();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const { balances: bankAccountBalances, loading: balancesLoading } = useBankAccountBalances();
  const { expenses, isLoading: expensesLoading } = useExpenses();

  const filteredTransactions = useMemo(() => {
    if (!incomeTransactions.length) return [];
    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);
    return incomeTransactions.filter((transaction) => {
      const isInDateRange =
        transaction.transaction_date >= startDateStr && transaction.transaction_date < endDateStr;
      const matchesBankAccount =
        selectedBankAccount === "all" ? true : transaction.bank_account_id === selectedBankAccount;
      const isValidStatus = transaction.status === "completed" || transaction.status === "pending";
      return isInDateRange && matchesBankAccount && isValidStatus;
    });
  }, [incomeTransactions, selectedPeriod, selectedBankAccount]);

  const filteredExpenses = useMemo(() => {
    if (!expenses.length) return [];
    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);
    return expenses.filter((expense) => {
      const isInDateRange = expense.create_date >= startDateStr && expense.create_date < endDateStr;
      const bankId = (expense as any).bank_account_id;
      const matchesBankAccount = selectedBankAccount === "all" ? true : bankId === selectedBankAccount;
      return isInDateRange && matchesBankAccount;
    });
  }, [expenses, selectedPeriod, selectedBankAccount]);

  const bankAccountNet = useMemo(() => {
    const netMap: Record<string, { income: number; expense: number; net: number; balance: number }> = {};

    bankAccountBalances.forEach((balance) => {
      netMap[balance.bank_account_id] = {
        income: 0,
        expense: 0,
        net: 0,
        balance: balance.balance,
      };
    });

    filteredTransactions.forEach((transaction) => {
      if (!transaction.bank_account_id) return;
      if (!netMap[transaction.bank_account_id]) {
        netMap[transaction.bank_account_id] = { income: 0, expense: 0, net: 0, balance: 0 };
      }
      netMap[transaction.bank_account_id].income += parseFloat(transaction.amount.toString());
    });

    filteredExpenses.forEach((expense) => {
      const bankId = (expense as any).bank_account_id;
      if (!bankId) return;
      if (!netMap[bankId]) {
        netMap[bankId] = { income: 0, expense: 0, net: 0, balance: 0 };
      }
      netMap[bankId].expense += expense.amount;
    });

    Object.keys(netMap).forEach((bankId) => {
      netMap[bankId].net = netMap[bankId].income - netMap[bankId].expense;
    });

    return netMap;
  }, [filteredTransactions, filteredExpenses, bankAccountBalances]);

  const isLoading = transactionsLoading || bankAccountsLoading || balancesLoading || expensesLoading;

  return (
    <div className="px-2 pt-1 pb-1">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-base font-semibold">Net Income per Bank Account</CardTitle>
          <CardDescription className="text-xs leading-snug mt-1">
            {t(
              "incomes.netPerBankCardHint",
              "Balance = all-time net from Income and Expense rows for this account (same as transfer logic). Net = income − expense for the filtered period only."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-0 pb-2">
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-lg" />
              ))}
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="h-28 bg-gray-50 rounded-lg flex items-center justify-center">
              <span className="text-gray-500 text-sm">No bank accounts</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain-xy">
              {bankAccounts.map((bankAccount) => {
                const netData = bankAccountNet[bankAccount.id];
                const balance = bankAccountBalances.find((b) => b.bank_account_id === bankAccount.id);

                if (!netData && !balance) return null;

                const income = netData?.income || 0;
                const expense = netData?.expense || 0;
                const net = income - expense;
                const currentBalance = balance?.balance || 0;
                const estimatedPeriodOpening = currentBalance - net;
                const otherAccounts = bankAccounts.filter((a) => a.id !== bankAccount.id);
                const canTransfer = otherAccounts.length > 0 && currentBalance > 0;

                return (
                  <NetBankAccountSwipeRow
                    key={bankAccount.id}
                    rowId={bankAccount.id}
                    isOpen={netBankOpenSwipeId === bankAccount.id}
                    onOpenChange={(open) => {
                      if (open) setNetBankOpenSwipeId(bankAccount.id);
                      else setNetBankOpenSwipeId((cur) => (cur === bankAccount.id ? null : cur));
                    }}
                    onTransfer={() => {
                      setBankTransferSource(bankAccount);
                      setBankTransferDialogOpen(true);
                      setNetBankOpenSwipeId(null);
                    }}
                    transferLabel={t("incomes.bankTransfer.button", "Transfer")}
                    disabled={!canTransfer}
                  >
                    <div className="flex items-start justify-between p-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{bankAccount.name}</div>
                        {bankAccount.account_number ? (
                          <div className="text-xs text-gray-700 truncate">No. Rek: {bankAccount.account_number}</div>
                        ) : null}
                        <div className="text-xs text-gray-700">
                          Income: {formatToRupiah(income)} | Expense: {formatToRupiah(expense)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-sm font-semibold ${net >= 0 ? "text-green-800" : "text-red-800"}`}>
                          Net: {formatToRupiah(net)}
                        </div>
                        <div className="text-xs text-gray-800 font-medium">
                          Balance: {formatToRupiah(currentBalance)}
                        </div>
                        <div
                          className="text-xs text-gray-600 mt-0.5 max-w-[11rem] ml-auto cursor-help"
                          title={t(
                            "incomes.netPerBankEstimatedOpeningHint",
                            "Approx. balance at the start of the filtered period: current Balance minus Net."
                          )}
                        >
                          {t("incomes.netPerBankEstimatedOpening", "Est. opening balance (period)")}:{" "}
                          {formatToRupiah(estimatedPeriodOpening)}
                        </div>
                      </div>
                    </div>
                  </NetBankAccountSwipeRow>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <BankTransferDialog
        open={bankTransferDialogOpen}
        onOpenChange={setBankTransferDialogOpen}
        sourceAccount={bankTransferSource}
        destinationAccounts={
          bankTransferSource ? bankAccounts.filter((a) => a.id !== bankTransferSource.id) : []
        }
        sourceBalance={
          bankTransferSource
            ? bankAccountBalances.find((b) => b.bank_account_id === bankTransferSource.id)?.balance ?? 0
            : 0
        }
      />
    </div>
  );
}
