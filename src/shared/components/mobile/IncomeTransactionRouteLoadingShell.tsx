import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { IncomeTransactionSkeleton } from "@/4-1-transaction/components/IncomeTransactionSkeleton";
import { MobileIncomeTransactionShellSkeleton } from "@/mobile/3-incomes/pages/MobileIncomeTransactionViewportSkeleton";

/** `PageAccessGuard` loadingShell for `/incomes/transaction` (+ desktop parity for bank URL). */
export function IncomeTransactionRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <IncomeTransactionSkeleton />;
  }
  return <MobileIncomeTransactionShellSkeleton />;
}
