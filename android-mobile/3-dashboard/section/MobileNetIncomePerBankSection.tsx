import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { formatBankInstitutionAccountLine } from "@/4-1-dashboard/utils/formatBankInstitutionAccountLine";
import { NetBankAccountSwipeRow } from "@/4-1-dashboard/components/NetBankAccountSwipeRow";
import type { IncomeDashboardModel } from "@/4-1-dashboard/hooks/useIncomeDashboardModel";

type Props = Pick<
  IncomeDashboardModel,
  | "bankAccounts"
  | "bankAccountBalances"
  | "bankAccountNet"
  | "selectedBankAccount"
  | "netBankOpenSwipeId"
  | "setNetBankOpenSwipeId"
  | "setBankTransferSource"
  | "setBankTransferDialogOpen"
>;

export function MobileNetIncomePerBankSection({
  bankAccounts,
  bankAccountBalances,
  bankAccountNet,
  selectedBankAccount,
  netBankOpenSwipeId,
  setNetBankOpenSwipeId,
  setBankTransferSource,
  setBankTransferDialogOpen,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <Card className="overflow-hidden border-border">
      <CardHeader className="px-3 pb-2 pt-3">
        <CardTitle className="text-base font-semibold">Net Income per Bank Account</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div
          className={cnScroll()}
        >
          {selectedBankAccount === "all" && bankAccounts.length > 0 ? (
            <div className="flex flex-col space-y-2">
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
                const bankInstitutionLine = formatBankInstitutionAccountLine(bankAccount);

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
                    <div className="flex items-center justify-between p-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{bankAccount.name}</div>
                        {bankInstitutionLine ? (
                          <div className="truncate text-xs leading-snug text-muted-foreground">{bankInstitutionLine}</div>
                        ) : null}
                        <div className="text-xs text-muted-foreground">
                          Income: {formatToRupiah(income)} | Expense: {formatToRupiah(expense)}
                        </div>
                      </div>
                      <div className="ml-2 shrink-0 text-right">
                        <div
                          className={`text-sm font-semibold ${net >= 0 ? "text-green-700" : "text-red-700"}`}
                        >
                          Net: {formatToRupiah(net)}
                        </div>
                        <div className="text-xs font-medium text-foreground">
                          Balance: {formatToRupiah(currentBalance)}
                        </div>
                        <div
                          className="mt-0.5 max-w-[11rem] cursor-help text-xs text-muted-foreground"
                          title={t(
                            "incomes.netPerBankEstimatedOpeningHint",
                            "Approx. balance at the start of the filtered period: current Balance minus Net.",
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
          ) : bankAccounts.length === 0 ? (
            <div className="flex min-h-[100px] items-center justify-center rounded-lg bg-muted/40">
              <span className="text-sm text-muted-foreground">No bank accounts</span>
            </div>
          ) : (
            <div className="flex min-h-[100px] items-center justify-center rounded-lg bg-muted/40 px-2">
              <span className="text-center text-sm text-muted-foreground">
                Select &quot;All Bank Accounts&quot; to see net income per bank account
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function cnScroll() {
  return "nested-scroll-touch-chain scrollbar-hide seamless-scroll max-h-[min(420px,50vh)] min-h-0 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
}
