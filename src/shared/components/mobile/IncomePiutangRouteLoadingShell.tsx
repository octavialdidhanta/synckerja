import { useAuthSurface } from '@/shared/hooks/useAuthSurface';
import { IncomePiutangPageSkeleton } from '@/4-1-transaction/piutang';
import { MobileIncomeTransactionShellSkeleton } from '@/mobile/3-incomes/pages/MobileIncomeTransactionViewportSkeleton';

/** `PageAccessGuard` loadingShell for `/incomes/piutang`. */
export function IncomePiutangRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <IncomePiutangPageSkeleton />;
  }
  return <MobileIncomeTransactionShellSkeleton />;
}
