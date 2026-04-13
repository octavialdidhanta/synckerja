import { MeetingNotesPageSkeleton } from "@/8-1-meeting-notes/skeletons/MeetingNotesPageSkeleton";
import { MobileToolsMeetingNotesPageSkeletonOverlay } from "@/mobile/5-meeting-notes/pages/MobileToolsMeetingNotesPageSkeletonOverlay";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

/**
 * `PageAccessGuard` untuk `/tools/meeting-notes`: viewport tools-mobile memakai overlay shell;
 * desktop tetap `MeetingNotesPageSkeleton` (layout modul web).
 */
export function MeetingNotesRouteLoadingShell() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (useMobileShell) {
    return <MobileToolsMeetingNotesPageSkeletonOverlay />;
  }
  return <MeetingNotesPageSkeleton />;
}
