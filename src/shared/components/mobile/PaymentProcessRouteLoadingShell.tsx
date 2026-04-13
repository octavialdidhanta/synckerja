import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { PaymentProcessPageSkeleton } from "@/4-2-payment-process/skeletons/PaymentProcessPageSkeleton";
import { MobilePaymentProcessShellSkeleton } from "@/mobile/2-payment/pages/MobilePaymentProcessPageSkeleton";

/**
 * `PageAccessGuard` loadingShell + Suspense fallback untuk `/expenses/payment-process`: desktop vs mobile shell.
 */
export function PaymentProcessRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <PaymentProcessPageSkeleton />;
  }
  return <MobilePaymentProcessShellSkeleton />;
}
