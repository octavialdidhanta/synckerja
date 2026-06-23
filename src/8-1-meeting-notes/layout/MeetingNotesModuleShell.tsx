import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { ToolsHeaderAndTab } from "@/shared/layouts/tools";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { MeetingNotesPageSkeleton } from "../skeletons/MeetingNotesPageSkeleton";

type MeetingNotesModuleShellProps = {
  children: ReactNode;
  showContent: boolean;
};

/**
 * Shell `/tools/meeting-notes` — struktur scroll selaras `/employees`.
 */
export function MeetingNotesModuleShell({ children, showContent }: MeetingNotesModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1",
          !showContent && "pointer-events-none invisible select-none",
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <ToolsHeaderAndTab activeTab="meeting-notes" onTabChange={() => {}} />
                </div>

                <ModuleShellContentGate pagePath="/tools/meeting-notes">
                  {children}
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div className="absolute inset-0 z-20 overflow-hidden" aria-busy>
          <MeetingNotesPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
