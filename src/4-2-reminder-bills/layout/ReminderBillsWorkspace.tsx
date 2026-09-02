import type { ReactNode } from 'react';
import { ReminderBillsPanelFooter } from './ReminderBillsPanelFooter';
import {
  REMINDER_BILLS_MAIN_COLUMN,
  REMINDER_BILLS_MAIN_GRID,
  REMINDER_BILLS_SIDEBAR_COLUMN,
  REMINDER_BILLS_TABLE_SECTION,
} from './reminderBillsLayout';

type Props = {
  children: ReactNode;
  sidebar: ReactNode;
  toolbar?: ReactNode;
  count?: number;
};

export function ReminderBillsWorkspace({ children, sidebar, toolbar, count }: Props) {
  return (
    <div className={REMINDER_BILLS_MAIN_GRID}>
      <div className={REMINDER_BILLS_MAIN_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={REMINDER_BILLS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <ReminderBillsPanelFooter count={count} />
            </div>
          </div>
        </div>
      </div>

      <div className={REMINDER_BILLS_SIDEBAR_COLUMN}>
        <div className={REMINDER_BILLS_TABLE_SECTION}>{sidebar}</div>
      </div>
    </div>
  );
}
