import type { ReactNode } from 'react';
import { PaymentProcessPanelFooter } from './PaymentProcessPanelFooter';
import {
  PAYMENT_PROCESS_MAIN_COLUMN,
  PAYMENT_PROCESS_MAIN_GRID,
  PAYMENT_PROCESS_SIDEBAR_COLUMN,
  PAYMENT_PROCESS_TABLE_SECTION,
} from './paymentProcessLayout';

type Props = {
  children: ReactNode;
  sidebar: ReactNode;
  toolbar?: ReactNode;
  count?: number;
};

export function PaymentProcessWorkspace({ children, sidebar, toolbar, count }: Props) {
  return (
    <div className={PAYMENT_PROCESS_MAIN_GRID}>
      <div className={PAYMENT_PROCESS_MAIN_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={PAYMENT_PROCESS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <PaymentProcessPanelFooter count={count} />
            </div>
          </div>
        </div>
      </div>

      <div className={PAYMENT_PROCESS_SIDEBAR_COLUMN}>
        <div className={PAYMENT_PROCESS_TABLE_SECTION}>{sidebar}</div>
      </div>
    </div>
  );
}
