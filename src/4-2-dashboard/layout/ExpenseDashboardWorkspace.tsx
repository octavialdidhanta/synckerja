import type { ReactNode } from 'react';
import { ExpenseDashboardPanelFooter } from './ExpenseDashboardPanelFooter';
import { EXPENSE_DASHBOARD_MAIN_GRID, EXPENSE_DASHBOARD_TABLE_SECTION } from './expenseDashboardLayout';

type Props = {
  children: ReactNode;
  toolbar?: ReactNode;
  count?: number;
};

export function ExpenseDashboardWorkspace({ children, toolbar, count }: Props) {
  return (
    <div className={EXPENSE_DASHBOARD_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={EXPENSE_DASHBOARD_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <ExpenseDashboardPanelFooter count={count} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
