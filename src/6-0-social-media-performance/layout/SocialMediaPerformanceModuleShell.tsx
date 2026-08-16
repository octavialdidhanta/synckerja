import type { ReactNode } from "react";
import {
  SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
  SocialMediaPerformanceHeaderAndTab,
} from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import { ModuleHeaderBelowContentGate } from "@/shared/layouts/ModuleHeaderBelowContentGate";

type SocialMediaPerformanceModuleShellProps = {
  children: ReactNode;
  activeReportPath?: string;
};

export function SocialMediaPerformanceModuleShell({
  children,
  activeReportPath,
}: SocialMediaPerformanceModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 w-full flex-1 flex-col">
              <ModuleHeaderBelowContentGate
                pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
                header={
                  <SocialMediaPerformanceHeaderAndTab activeReportPath={activeReportPath} />
                }
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                {children}
              </ModuleHeaderBelowContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
