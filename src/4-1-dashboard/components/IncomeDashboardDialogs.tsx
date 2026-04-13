import type { IncomeDashboardModel } from "@/4-1-dashboard/hooks/useIncomeDashboardModel";
import { BankTransferDialog } from "./BankTransferDialog";

type Props = {
  model: IncomeDashboardModel;
};

/** Shared dialogs for desktop + mobile income dashboard (bank transfer). */
export function IncomeDashboardDialogs({ model }: Props) {
  const {
    bankTransferDialogOpen,
    setBankTransferDialogOpen,
    bankTransferSource,
    bankAccounts,
    bankAccountBalances,
  } = model;

  return (
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
  );
}
