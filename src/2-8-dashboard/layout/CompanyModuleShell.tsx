import type { ReactNode } from "react";
import { CompanyHeaderAndTabs } from "@/2-8-dashboard/section";

type CompanyModuleShellProps = {
  children: ReactNode;
};

/**
 * Shared shell for /company/* routes inside AppShellLayout.
 * Seamless single scroll: header/tabs scroll with content (see Seamless Page Scroll Layout rule).
 */
export function CompanyModuleShell({ children }: CompanyModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-h-0 flex-col">
              <div className="mb-1 shrink-0">
                <CompanyHeaderAndTabs />
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
