import { lazy, Suspense, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { IncomeXenditPageSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";

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

function TabSuspense({ children }: { children: React.ReactNode }) {
  return (
    <ShellSuspense fallback={<IncomeXenditPageSkeleton />}>{children}</ShellSuspense>
  );
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
    <TabSuspense>
      <XenditConnectPage />
    </TabSuspense>
  );
}

export function XenditBalanceRouteElement() {
  return (
    <TabSuspense>
      <XenditBalancePage />
    </TabSuspense>
  );
}

export function XenditHistoryRouteElement() {
  return (
    <TabSuspense>
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
