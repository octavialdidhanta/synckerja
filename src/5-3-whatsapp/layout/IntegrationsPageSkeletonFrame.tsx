import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import {
  INTEGRATIONS_COLUMNS_DEFAULT,
  INTEGRATIONS_FULL_COLUMN,
  INTEGRATIONS_MAIN_GRID,
  INTEGRATIONS_TABLE_SECTION,
} from './integrationsLayout';

type Props = {
  left: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  columnsClassName?: string;
};

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export function IntegrationsPageSkeletonFrame({ left, children, ariaLabel, columnsClassName }: Props) {
  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={ariaLabel}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className={MAIN_SCROLL}>
            <div className="flex min-h-full min-w-0 flex-1 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <div className={INTEGRATIONS_MAIN_GRID}>
                <div className={INTEGRATIONS_FULL_COLUMN}>
                  <div className={columnsClassName ?? INTEGRATIONS_COLUMNS_DEFAULT}>
                    <div className={INTEGRATIONS_TABLE_SECTION}>{left}</div>
                    <div className={INTEGRATIONS_TABLE_SECTION}>
                      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        {children}
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-40 max-w-[55%]" />
                            <Skeleton className="h-3 w-24 max-w-[40%]" />
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
    </div>
  );
}
