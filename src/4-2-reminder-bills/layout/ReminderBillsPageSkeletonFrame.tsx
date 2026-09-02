import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { HeaderAndTab } from '@/4-2-dashboard/section/HeaderAndTab';
import {
  REMINDER_BILLS_MAIN_COLUMN,
  REMINDER_BILLS_MAIN_GRID,
  REMINDER_BILLS_SIDEBAR_COLUMN,
  REMINDER_BILLS_TABLE_SECTION,
} from './reminderBillsLayout';

type Props = {
  children: ReactNode;
  toolbar?: ReactNode;
  sidebarBody?: ReactNode;
  ariaLabel?: string;
};

function DefaultSidebarBody() {
  return (
    <div className="min-h-0 min-w-0 flex-1 space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export function ReminderBillsPageSkeletonFrame({ children, toolbar, sidebarBody, ariaLabel }: Props) {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={ariaLabel}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 min-w-0 flex-shrink-0">
                <HeaderAndTab activeTab="reminder-bills" onTabChange={() => undefined} />
              </div>

              <div className={REMINDER_BILLS_MAIN_GRID}>
                <div className={REMINDER_BILLS_MAIN_COLUMN}>
                  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
                    {toolbar}
                    <div className={REMINDER_BILLS_TABLE_SECTION}>
                      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        {children}
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-52 max-w-[55%]" />
                            <Skeleton className="h-3 w-24 max-w-[40%]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={REMINDER_BILLS_SIDEBAR_COLUMN}>
                  <div className={REMINDER_BILLS_TABLE_SECTION}>
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                      <div className="shrink-0 border-b border-border px-4 py-1.5">
                        <Skeleton className="mb-1 h-4 w-36" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                      {sidebarBody ?? <DefaultSidebarBody />}
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
