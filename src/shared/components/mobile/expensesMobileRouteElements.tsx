import { lazy, Suspense, type ReactNode } from "react";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { ExpenseDashboardSkeleton } from "@/4-2-dashboard/skeletons/ExpenseDashboardSkeleton";
import { MobileExpenseDashboardShellSkeleton } from "@/mobile/2-expense/pages/MobileExpenseDashboardPageSkeleton";
import { DebtPageSkeleton } from "@/4-2-debt/skeletons/DebtPageSkeleton";
import { ApprovalsPageSkeleton } from "@/4-2-approvals/skeletons/ApprovalsPageSkeleton";
import { PaymentProcessPageSkeleton } from "@/4-2-payment-process/skeletons/PaymentProcessPageSkeleton";
import { ReminderBillsPageSkeleton } from "@/4-2-reminder-bills/skeletons/ReminderBillsPageSkeleton";

const ExpenseDashboardPage = lazy(() => import("@/4-2-dashboard/pages/ExpenseDashboardPage"));
const ExpenseDebtPage = lazy(() => import("@/4-2-debt/pages/DebtPage"));
const ExpenseApprovalsPage = lazy(() => import("@/4-2-approvals/pages/ApprovalsPage"));
const ExpensePaymentProcessPage = lazy(() => import("@/4-2-payment-process/pages/PaymentProcessPage"));
const ExpenseReminderBillsPage = lazy(() => import("@/4-2-reminder-bills/pages/ReminderBillsPage"));

const MobileExpenseDashboardPage = lazy(
  () => import("@/mobile/2-expense/pages/MobileExpenseDashboardPage"),
);
const MobileDebtPage = lazy(() => import("@/mobile/2-debt/pages/MobileDebtPage"));
const MobileApprovalsPage = lazy(() => import("@/mobile/2-approvals/pages/MobileApprovalsPage"));
const MobilePaymentProcessPage = lazy(() => import("@/mobile/2-payment/pages/MobilePaymentProcessPage"));
const MobileReminderBillsPage = lazy(() => import("@/mobile/2-bills/pages/MobileReminderBillsPage"));

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

export function ExpensesDashboardRouteElement() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return (
      <ShellSuspense fallback={<ExpenseDashboardSkeleton />}>
        <ExpenseDashboardPage />
      </ShellSuspense>
    );
  }
  return (
    <Suspense fallback={<MobileExpenseDashboardShellSkeleton />}>
      <MobileExpenseDashboardPage />
    </Suspense>
  );
}

export function ExpensesDebtRouteElement() {
  const { isDesktop } = useAuthSurface();
  return (
    <ShellSuspense fallback={<DebtPageSkeleton />}>
      {isDesktop ? <ExpenseDebtPage /> : <MobileDebtPage />}
    </ShellSuspense>
  );
}

export function ExpensesApprovalsRouteElement() {
  const { isDesktop } = useAuthSurface();
  return (
    <ShellSuspense fallback={<ApprovalsPageSkeleton />}>
      {isDesktop ? <ExpenseApprovalsPage /> : <MobileApprovalsPage />}
    </ShellSuspense>
  );
}

export function ExpensesPaymentProcessRouteElement() {
  const { isDesktop } = useAuthSurface();
  return (
    <ShellSuspense fallback={<PaymentProcessPageSkeleton />}>
      {isDesktop ? <ExpensePaymentProcessPage /> : <MobilePaymentProcessPage />}
    </ShellSuspense>
  );
}

export function ExpensesReminderBillsRouteElement() {
  const { isDesktop } = useAuthSurface();
  return (
    <ShellSuspense fallback={<ReminderBillsPageSkeleton />}>
      {isDesktop ? <ExpenseReminderBillsPage /> : <MobileReminderBillsPage />}
    </ShellSuspense>
  );
}

