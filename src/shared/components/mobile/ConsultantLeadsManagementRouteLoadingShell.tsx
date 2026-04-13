import { LeadsManagementPageSkeleton } from "@/5-1-leads-management/skeletons/LeadsManagementPageSkeleton";
import { MobileConsultantLeadsShellSkeleton } from "@/mobile/4-leads-management/pages/MobileConsultantLeadsManagementViewportSkeleton";
import { MobileConsultantLeadsReportPageSkeletonOverlay } from "@/mobile/4-leads-management/pages/MobileConsultantLeadsReportPageSkeletonOverlay";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";
import { useLocation } from "react-router-dom";

/** `PageAccessGuard` loadingShell: desktop CRM skeleton; mobile daftar vs mobile report (`?view=report`) memakai satu skeleton per mode, report = hanya `MobileConsultantLeadsReportPageSkeletonOverlay`. */
export function ConsultantLeadsManagementRouteLoadingShell() {
  const useMobileShell = useToolsModuleMobileViewport();
  const { search } = useLocation();
  const isReportView = new URLSearchParams(search).get("view") === "report";

  if (!useMobileShell) {
    return <LeadsManagementPageSkeleton />;
  }
  if (isReportView) {
    return <MobileConsultantLeadsReportPageSkeletonOverlay />;
  }
  return <MobileConsultantLeadsShellSkeleton />;
}
