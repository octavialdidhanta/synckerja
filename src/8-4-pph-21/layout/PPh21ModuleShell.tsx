import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { ToolsHeaderAndTab } from "@/shared/layouts/tools";

type PPh21ModuleShellProps = {
  children: ReactNode;
};

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function PPh21ModuleShell({ children }: PPh21ModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={cn(MAIN_SCROLL, "min-w-0")}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                  <ToolsHeaderAndTab
                    activeTab="pph21-calculator"
                    onTabChange={() => {}}
                    toolsTabMode="pph21-calculator-only"
                  />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                {children}
              </div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
          <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}
