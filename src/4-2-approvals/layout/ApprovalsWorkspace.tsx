import type { ReactNode } from 'react';
import { ApprovalsPanelFooter } from './ApprovalsPanelFooter';
import {
  APPROVALS_MAIN_COLUMN,
  APPROVALS_MAIN_GRID,
  APPROVALS_SIDEBAR_COLUMN,
  APPROVALS_TABLE_SECTION,
} from './approvalsLayout';

type Props = {
  children: ReactNode;
  sidebar: ReactNode;
  toolbar?: ReactNode;
  count?: number;
};

export function ApprovalsWorkspace({ children, sidebar, toolbar, count }: Props) {
  return (
    <div className={APPROVALS_MAIN_GRID}>
      <div className={APPROVALS_MAIN_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={APPROVALS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <ApprovalsPanelFooter count={count} />
            </div>
          </div>
        </div>
      </div>

      <div className={APPROVALS_SIDEBAR_COLUMN}>
        <div className={APPROVALS_TABLE_SECTION}>{sidebar}</div>
      </div>
    </div>
  );
}
