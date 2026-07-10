import { useEffect, useState } from "react";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";
import { IncomesModuleShell } from "../layout/IncomesModuleShell";
import { IncomeDashboard } from "../components/IncomeDashboard";

/**
 * Full-page skeleton overlay until dashboard data is ready — covers HeaderAndTab + grid
 * so guard → chunk → data phases share one layout (no header/content pop-in).
 */
export default function IncomeDashboardPage() {
  const { canAccessPage, accessDecisionPending } = useDepartmentAccess();
  const hasPageAccess = canAccessPage("/incomes/dashboard");
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    if (!accessDecisionPending && !hasPageAccess) {
      setShowOverlay(false);
    }
  }, [accessDecisionPending, hasPageAccess]);

  return (
    <IncomesModuleShell showContent={!showOverlay}>
      <IncomeDashboard onLoadingOverlayChange={setShowOverlay} />
    </IncomesModuleShell>
  );
}
