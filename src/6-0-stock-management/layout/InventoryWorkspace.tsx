import type { ReactNode } from "react";
import { InventoryPanelFooter } from "./InventoryPanelFooter";
import { INVENTORY_MAIN_GRID, INVENTORY_TABLE_SECTION } from "./inventoryLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function InventoryWorkspace({ children, count }: Props) {
  return (
    <div className={INVENTORY_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={INVENTORY_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <InventoryPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
