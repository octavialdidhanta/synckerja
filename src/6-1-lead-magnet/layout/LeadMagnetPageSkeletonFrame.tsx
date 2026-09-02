import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { LeadMagnetHeaderAndTab } from '../container/LeadMagnetHeaderAndTab';
import {
  LEAD_MAGNET_ANALYTICS_MAIN_COLUMN,
  LEAD_MAGNET_ANALYTICS_SIDEBAR_COLUMN,
  LEAD_MAGNET_FULL_COLUMN,
  LEAD_MAGNET_MAIN_GRID,
  LEAD_MAGNET_TABLE_SECTION,
} from '../lib/leadMagnetLayout';

type Props = {
  children: ReactNode;
  toolbar?: ReactNode;
  sidebar?: ReactNode;
  ariaLabel?: string;
  includeHeader?: boolean;
};

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function FooterSkeleton() {
  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-40 max-w-[55%]" />
        <Skeleton className="h-3 w-24 max-w-[40%]" />
      </div>
    </div>
  );
}

export function LeadMagnetPageSkeletonFrame({
  children,
  toolbar,
  sidebar,
  ariaLabel,
  includeHeader = true,
}: Props) {
  const body = sidebar ? (
    <div className={LEAD_MAGNET_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
            <div className={LEAD_MAGNET_ANALYTICS_SIDEBAR_COLUMN}>
              <div className={LEAD_MAGNET_TABLE_SECTION}>{sidebar}</div>
            </div>
            <div className={LEAD_MAGNET_ANALYTICS_MAIN_COLUMN}>
              <div className={LEAD_MAGNET_TABLE_SECTION}>
                <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  {children}
                  <FooterSkeleton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className={LEAD_MAGNET_MAIN_GRID}>
      <div className={LEAD_MAGNET_FULL_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={LEAD_MAGNET_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {children}
              <FooterSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!includeHeader) return body;

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100"
      aria-busy
      aria-label={ariaLabel}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={MAIN_SCROLL}>
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 flex-shrink-0">
                <LeadMagnetHeaderAndTab />
              </div>
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
