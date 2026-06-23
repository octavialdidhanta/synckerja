import type { ReactNode } from "react";
import { CalculatorHeaderAndTab } from "@/8-3-calculator/components/CalculatorHeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";

type CalculatorModuleShellProps = {
  children: ReactNode;
};

/**
 * Shell calculator — header ikut scroll; grid 9+3 di dalam children (bukan di gate flex-col).
 */
export function CalculatorModuleShell({ children }: CalculatorModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 w-full flex-1">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <CalculatorHeaderAndTab />
                </div>

                <ModuleShellContentGate>{children}</ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
