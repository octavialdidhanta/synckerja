import type { ReactNode } from "react";
import { CustomersPanelFooter } from "./CustomersPanelFooter";
import { CUSTOMERS_MAIN_GRID, CUSTOMERS_TABLE_SECTION } from "./customersLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function CustomersWorkspace({ children, count }: Props) {
  return (
    <div className={CUSTOMERS_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={CUSTOMERS_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <CustomersPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
