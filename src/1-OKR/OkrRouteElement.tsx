import { lazy, Suspense } from "react";
import { OkrRouteAccessLoadingShell } from "./components/OkrRouteAccessLoadingShell";

const OKRPage = lazy(() => import("./OKRPage"));

/** Guard + Suspense share the same tab-matched skeleton (Loading Skeleton rule). */
export function OkrRouteElement() {
  return (
    <Suspense fallback={<OkrRouteAccessLoadingShell />}>
      <OKRPage />
    </Suspense>
  );
}
