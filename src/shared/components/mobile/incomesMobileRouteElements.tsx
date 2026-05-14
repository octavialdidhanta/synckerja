import { lazy, Suspense, type ReactNode } from "react";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { IncomeDashboardSkeleton } from "@/4-1-dashboard/skeletons/IncomeDashboardSkeleton";
import { IncomeTransactionSkeleton } from "@/4-1-transaction/components/IncomeTransactionSkeleton";
import { IncomePiutangPageSkeleton } from "@/4-1-transaction/piutang";
import { MobileIncomeDashboardShellSkeleton } from "@/mobile/3-dashboard/pages/MobileIncomeDashboardViewportSkeleton";
import { MobileIncomeTransactionShellSkeleton } from "@/mobile/3-incomes/pages/MobileIncomeTransactionViewportSkeleton";
import { MobileBankAccountShellSkeleton } from "@/mobile/3-bank-account/pages/MobileBankAccountViewportSkeleton";

const IncomeDashboardPage = lazy(() => import("@/4-1-dashboard/pages/IncomeDashboardPage"));
const MobileIncomeDashboardPage = lazy(() => import("@/mobile/3-dashboard/pages/MobileIncomeDashboardPage"));
const IncomeTransactionShellPage = lazy(() => import("@/4-1-transaction/pages/IncomeTransactionShellPage"));
const MobileIncomeTransactionPage = lazy(() => import("@/mobile/3-incomes/pages/MobileIncomeTransactionPage"));
const IncomePiutangShellPage = lazy(() =>
  import("@/4-1-transaction/piutang").then((m) => ({ default: m.IncomePiutangShellPage })),
);
const MobileIncomePiutangPage = lazy(() => import("@/mobile/3-incomes/pages/MobileIncomePiutangPage"));
const MobileBankAccountPage = lazy(() => import("@/mobile/3-bank-account/pages/MobileBankAccountPage"));

function ShellSuspense({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          {fallback}
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** `/incomes/dashboard`: desktop `4-1-dashboard` vs mobile `android-mobile/3-dashboard`. */
export function IncomeDashboardRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return (
      <ShellSuspense fallback={<IncomeDashboardSkeleton />}>
        <IncomeDashboardPage />
      </ShellSuspense>
    );
  }
  return (
    <Suspense fallback={<MobileIncomeDashboardShellSkeleton />}>
      <MobileIncomeDashboardPage />
    </Suspense>
  );
}

/** `/incomes/transaction`: desktop `4-1-transaction` vs mobile `android-mobile/3-incomes`. */
export function IncomeTransactionRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return (
      <ShellSuspense fallback={<IncomeTransactionSkeleton />}>
        <IncomeTransactionShellPage />
      </ShellSuspense>
    );
  }
  return (
    <Suspense fallback={<MobileIncomeTransactionShellSkeleton />}>
      <MobileIncomeTransactionPage />
    </Suspense>
  );
}

/** `/incomes/piutang`: desktop piutang sub-module vs mobile shell. */
export function IncomePiutangRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return (
      <ShellSuspense fallback={<IncomePiutangPageSkeleton />}>
        <IncomePiutangShellPage />
      </ShellSuspense>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <MobileIncomeTransactionShellSkeleton />
        </div>
      }
    >
      <MobileIncomePiutangPage />
    </Suspense>
  );
}

/**
 * `/incomes/transaction/bank-account`: mobile `android-mobile/3-bank-account`;
 * desktop uses same shell as transaction; sidebar tab syncs via `IncomeTransactionOverview` + pathname.
 */
export function IncomeBankAccountRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return (
      <ShellSuspense fallback={<IncomeTransactionSkeleton />}>
        <IncomeTransactionShellPage />
      </ShellSuspense>
    );
  }
  return (
    <Suspense fallback={<MobileBankAccountShellSkeleton />}>
      <MobileBankAccountPage />
    </Suspense>
  );
}
