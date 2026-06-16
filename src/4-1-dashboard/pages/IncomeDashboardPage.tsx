import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { IncomesModuleShell } from "../layout/IncomesModuleShell";
import { IncomeDashboard } from "../components/IncomeDashboard";
import { IncomeDashboardSkeleton } from "../skeletons/IncomeDashboardSkeleton";

/**
 * Full-page skeleton overlay until dashboard data is ready — covers HeaderAndTab + grid
 * so guard → chunk → data phases share one layout (no header/content pop-in).
 */
export default function IncomeDashboardPage() {
  const [showOverlay, setShowOverlay] = useState(true);

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className={cn(showOverlay && "pointer-events-none invisible")} aria-hidden={showOverlay}>
        <IncomesModuleShell>
          <IncomeDashboard onLoadingOverlayChange={setShowOverlay} />
        </IncomesModuleShell>
      </div>

      {showOverlay ? (
        <div
          className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-gray-100"
          aria-busy="true"
        >
          <IncomeDashboardSkeleton />
        </div>
      ) : null}
    </div>
  );
}
