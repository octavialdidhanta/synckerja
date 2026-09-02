import type { ReactNode } from "react";
import { ReportsPanelFooter } from "./ReportsPanelFooter";
import { REPORTS_MAIN_GRID, REPORTS_TABLE_SECTION } from "./reportsLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function ReportsWorkspace({ children, count }: Props) {
  return (
    <div className={REPORTS_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={REPORTS_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <ReportsPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
