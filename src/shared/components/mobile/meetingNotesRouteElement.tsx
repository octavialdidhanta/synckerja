import { lazy, Suspense, type ReactNode } from "react";
import { MeetingNotesRouteLoadingShell } from "@/shared/components/mobile/MeetingNotesRouteLoadingShell";
import MobileMeetingNotesPage from "@/mobile/5-meeting-notes/MeetingNotesPage";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

const DesktopMeetingNotesPage = lazy(() => import("@/8-1-meeting-notes/pages/MeetingNotesPage"));

function ShellSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <MeetingNotesRouteLoadingShell />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * `/tools/meeting-notes`: viewport tools-mobile atau native → `android-mobile/5-meeting-notes/MeetingNotesPage`
 * (header + `SidebarTrigger`, `AppSidebar`, `ToolsNavigationFooter`). Lebih lebar → modul desktop.
 * Harus dipasangkan dengan `AdaptiveAppLayout` bypass untuk path ini agar tidak dobel `AppHeader`.
 */
export function MeetingNotesRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopMeetingNotesPage />
      </ShellSuspense>
    );
  }
  return <MobileMeetingNotesPage />;
}
