import type { ReactNode } from "react";
import { CompanyDashboardPanelFooter } from "./CompanyDashboardPanelFooter";
import {
  COMPANY_FULL_COLUMN,
  COMPANY_MAIN_GRID,
  COMPANY_TABLE_SECTION,
} from "./companyModuleLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function CompanyDashboardWorkspace({ children, count }: Props) {
  return (
    <div className={COMPANY_MAIN_GRID}>
      <div className={COMPANY_FULL_COLUMN}>
        <div className={COMPANY_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <CompanyDashboardPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
