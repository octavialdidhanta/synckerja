import type { ReactNode } from "react";
import { ToolsHeaderAndTab } from "@/shared/layouts/tools";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";

type PPh21ModuleShellProps = {
  children: ReactNode;
};

/**
 * Shell `/tools/pph21-calculator` — header ikut scroll; grid di dalam children.
 */
export function PPh21ModuleShell({ children }: PPh21ModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 w-full flex-1">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <ToolsHeaderAndTab
                    activeTab="pph21-calculator"
                    onTabChange={() => {}}
                    toolsTabMode="pph21-calculator-only"
                  />
                </div>

                <ModuleShellContentGate pagePath="/tools/pph21-calculator">
                  {children}
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
