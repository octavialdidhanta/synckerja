import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { XenditHeaderAndTab } from '@/4-1-transaction/xendit/components/XenditHeaderAndTab';
import { XENDIT_MAIN_INNER_SCROLL } from './xenditPageLayout';
import { XenditWorkspace } from './XenditWorkspace';

type Props = {
  children: ReactNode;
  ariaLabel?: string;
  includeHeader?: boolean;
};

export function XenditBalancePageSkeletonFrame({
  children,
  ariaLabel,
  includeHeader = true,
}: Props) {
  const body = (
    <XenditWorkspace>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex-shrink-0 border-b border-border">
          <div className="flex items-center justify-between gap-3 p-4 [@media(max-height:900px)]:p-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          </div>
        </div>
        <div className={cn(XENDIT_MAIN_INNER_SCROLL, 'p-4 [@media(max-height:900px)]:p-3')}>
          {children}
        </div>
        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-52 max-w-[55%]" />
            <Skeleton className="h-3 w-24 max-w-[40%]" />
          </div>
        </div>
      </div>
    </XenditWorkspace>
  );

  if (!includeHeader) return body;

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={ariaLabel}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 flex-shrink-0">
                <XenditHeaderAndTab />
              </div>
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
