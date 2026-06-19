import { lazy, Suspense, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { IncomeXenditPageSkeleton, XenditConnectTabSkeleton, XenditBalanceTabSkeleton, XenditHistoryTabContentSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";

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

const IncomeXenditLayoutPage = lazy(() =>
  import("@/4-1-transaction/xendit/pages/IncomeXenditLayoutPage"),
);

const XenditConnectPage = lazy(() =>
  import("@/4-1-transaction/xendit/pages/XenditConnectPage"),
);

const XenditBalancePage = lazy(() =>
  import("@/4-1-transaction/xendit/pages/XenditBalancePage"),
);

const XenditHistoryPage = lazy(() =>
  import("@/4-1-transaction/xendit/pages/XenditHistoryPage"),
);

function TabSuspense({
  variant,
  children,
}: {
  variant: "connect" | "balance" | "history";
  children: React.ReactNode;
}) {
  const fallback =
    variant === "balance" ? (
      <XenditBalanceTabSkeleton />
    ) : variant === "history" ? (
      <XenditHistoryTabContentSkeleton />
    ) : (
      <XenditConnectTabSkeleton />
    );

  return <ShellSuspense fallback={fallback}>{children}</ShellSuspense>;
}

/** Layout route for `/xendit/*` — header + tab chrome with nested tab pages. */
export function XenditModuleRouteElement() {
  return (
    <TabSuspense>
      <IncomeXenditLayoutPage />
    </TabSuspense>
  );
}

export function XenditConnectRouteElement() {
  return (
    <TabSuspense variant="connect">
      <XenditConnectPage />
    </TabSuspense>
  );
}

export function XenditBalanceRouteElement() {
  return (
    <TabSuspense variant="balance">
      <XenditBalancePage />
    </TabSuspense>
  );
}

export function XenditHistoryRouteElement() {
  return (
    <TabSuspense variant="history">
      <XenditHistoryPage />
    </TabSuspense>
  );
}

/** @deprecated Use XenditModuleRouteElement */
export function IncomeXenditRouteElement() {
  return <XenditModuleRouteElement />;
}

export function XenditNestedRoutes() {
  return (
    <Suspense fallback={<IncomeXenditPageSkeleton />}>
      <Outlet />
    </Suspense>
  );
}
