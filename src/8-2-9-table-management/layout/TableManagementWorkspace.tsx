import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { TableManagementPanelFooter } from "./TableManagementPanelFooter";
import {
  TABLE_MANAGEMENT_MAIN_GRID,
  TABLE_MANAGEMENT_TABLE_SECTION,
} from "./tableManagementLayout";

type Props = {
  children: ReactNode;
  count?: number;
  columnClassName?: string;
};

export function TableManagementWorkspace({ children, count, columnClassName }: Props) {
  return (
    <div className={TABLE_MANAGEMENT_MAIN_GRID}>
      <div
        className={cn(
          "col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch",
          columnClassName,
        )}
      >
        <div className={TABLE_MANAGEMENT_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <TableManagementPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
