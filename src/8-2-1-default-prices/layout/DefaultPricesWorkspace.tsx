import type { ReactNode } from "react";
import { DefaultPricesPanelFooter } from "./DefaultPricesPanelFooter";
import { LIBRARY_MAIN_GRID, LIBRARY_TABLE_SECTION } from "./libraryLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function DefaultPricesWorkspace({ children, count }: Props) {
  return (
    <div className={LIBRARY_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={LIBRARY_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <DefaultPricesPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
