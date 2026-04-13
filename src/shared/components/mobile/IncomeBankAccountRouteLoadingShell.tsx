import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { IncomeTransactionSkeleton } from "@/4-1-transaction/components/IncomeTransactionSkeleton";
import { MobileBankAccountShellSkeleton } from "@/mobile/3-bank-account/pages/MobileBankAccountViewportSkeleton";

/** `PageAccessGuard` loadingShell for `/incomes/transaction/bank-account`. */
export function IncomeBankAccountRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <IncomeTransactionSkeleton />;
  }
  return <MobileBankAccountShellSkeleton />;
}
