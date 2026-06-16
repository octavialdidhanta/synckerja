import { Suspense, lazy, type ReactNode } from "react";
import { PageAccessGuard } from "@/shared/components/PageAccessGuard";
import { PayrollRouteSkeleton } from "../components/PayrollRouteSkeleton";

const PayrollCalculationsPage = lazy(() => import("./PayrollCalculationsPageWrapper"));

const PAYROLL_LOADING_SHELL: ReactNode = (
  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
    <PayrollRouteSkeleton />
  </div>
);

/** Guard + chunk Suspense share the same layout-matched payroll skeleton (no flicker on hard refresh). */
export function PayrollCalculationsRouteElement() {
  return (
    <PageAccessGuard
      pagePath="/payroll/calculations"
      loadingShell={PAYROLL_LOADING_SHELL}
      loadingShellWrapperClassName="bg-gray-100"
    >
      <Suspense fallback={PAYROLL_LOADING_SHELL}>
        <PayrollCalculationsPage />
      </Suspense>
    </PageAccessGuard>
  );
}
