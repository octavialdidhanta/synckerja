import type { ReactNode } from "react";
import { ReportsModuleShell } from "../layout/ReportsModuleShell";
import { ReportsWorkspace } from "../layout/ReportsWorkspace";
import { ReportsSalesNav } from "./ReportsSalesNav";

type Props = {
  children: ReactNode;
  showContent?: boolean;
  loadingSkeleton?: ReactNode;
  /** Sales sub-nav (Summary, Gross Profit, …). Off for Transactions / Invoices / Shift. */
  showSalesNav?: boolean;
  count?: number;
};

/** Library-style card: optional left sales nav + scrollable main pane. */
export function ReportsSalesLayout({
  children,
  showContent = true,
  loadingSkeleton,
  showSalesNav = true,
  count = 0,
}: Props) {
  return (
    <ReportsModuleShell showContent={showContent} loadingSkeleton={loadingSkeleton}>
      <ReportsWorkspace count={count}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
          {showSalesNav ? <ReportsSalesNav /> : null}
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </div>
      </ReportsWorkspace>
    </ReportsModuleShell>
  );
}
