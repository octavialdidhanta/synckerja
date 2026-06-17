import { useState } from "react";
import { IncomesModuleShell } from "../layout/IncomesModuleShell";
import { IncomeDashboard } from "../components/IncomeDashboard";

/**
 * Full-page skeleton overlay until dashboard data is ready — covers HeaderAndTab + grid
 * so guard → chunk → data phases share one layout (no header/content pop-in).
 */
export default function IncomeDashboardPage() {
  const [showOverlay, setShowOverlay] = useState(true);

  return (
    <IncomesModuleShell showContent={!showOverlay}>
      <IncomeDashboard onLoadingOverlayChange={setShowOverlay} />
    </IncomesModuleShell>
  );
}
