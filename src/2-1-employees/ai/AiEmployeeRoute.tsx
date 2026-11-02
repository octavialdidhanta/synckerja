import { lazy, Suspense } from "react";
import { PageAccessGuard } from "@/shared/components/PageAccessGuard";
import { AiEmployeePageSkeleton } from "./AiEmployeePageSkeleton";

const AiEmployeePage = lazy(() => import("./AiEmployeePage"));

export function AiEmployeeRoute() {
  return (
    <PageAccessGuard
      pagePath="/employees"
      loadingShell={<AiEmployeePageSkeleton />}
      loadingShellWrapperClassName="bg-gray-100"
    >
      <Suspense
        fallback={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100">
            <AiEmployeePageSkeleton />
          </div>
        }
      >
        <AiEmployeePage />
      </Suspense>
    </PageAccessGuard>
  );
}
