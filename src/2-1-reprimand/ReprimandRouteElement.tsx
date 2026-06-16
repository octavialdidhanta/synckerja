import { Suspense, lazy, type ReactNode } from "react";
import { PageAccessGuard } from "@/shared/components/PageAccessGuard";
import { HrManagementRoleGuard } from "@/shared/components/HrManagementRoleGuard";
import { ReprimandManagementPageSkeleton } from "./components/ReprimandManagementPageSkeleton";

const ReprimandManagementPage = lazy(() =>
  import("./pages/ReprimandManagementPage").then((m) => ({
    default: m.ReprimandManagementPage,
  })),
);

const REPRIMAND_LOADING_SHELL: ReactNode = (
  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
    <ReprimandManagementPageSkeleton />
  </div>
);

/** Eager route wrapper — guard, role check, and chunk Suspense share one layout-matched skeleton. */
export function ReprimandRouteElement() {
  return (
    <PageAccessGuard
      pagePath="/employees/reprimand"
      loadingShell={REPRIMAND_LOADING_SHELL}
      loadingShellWrapperClassName="bg-gray-100"
    >
      <HrManagementRoleGuard showPendingSkeleton={false}>
        <Suspense fallback={REPRIMAND_LOADING_SHELL}>
          <ReprimandManagementPage />
        </Suspense>
      </HrManagementRoleGuard>
    </PageAccessGuard>
  );
}
