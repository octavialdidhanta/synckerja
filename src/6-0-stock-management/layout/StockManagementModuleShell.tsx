import type { ReactNode } from "react";
import { StockManagementHeaderAndTab } from "@/6-0-stock-management/container/StockManagementHeaderAndTab";
import { ModuleHeaderBelowContentGate } from "@/shared/layouts/ModuleHeaderBelowContentGate";
import { STOCK_MANAGEMENT_PAGE_ACCESS_PATH } from "@/stock-management/lib/inventoryPaths";

type StockManagementModuleShellProps = {
  children: ReactNode;
};

export function StockManagementModuleShell({ children }: StockManagementModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 w-full flex-1 flex-col">
              <ModuleHeaderBelowContentGate
                pagePath={STOCK_MANAGEMENT_PAGE_ACCESS_PATH}
                header={<StockManagementHeaderAndTab />}
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
