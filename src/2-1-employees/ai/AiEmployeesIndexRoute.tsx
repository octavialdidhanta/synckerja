import { lazy, Suspense } from "react";
import { PageAccessGuard } from "@/shared/components/PageAccessGuard";
import { AiEmployeesIndexSkeleton } from "./AiEmployeesIndexSkeleton";

const AiEmployeesIndexPage = lazy(() => import("./AiEmployeesIndexPage"));

export function AiEmployeesIndexRoute() {
  return (
    <PageAccessGuard
      pagePath="/employees"
      loadingShell={<AiEmployeesIndexSkeleton />}
      loadingShellWrapperClassName="bg-gray-100"
    >
      <Suspense
        fallback={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100">
            <AiEmployeesIndexSkeleton />
          </div>
        }
      >
        <AiEmployeesIndexPage />
      </Suspense>
    </PageAccessGuard>
  );
}
