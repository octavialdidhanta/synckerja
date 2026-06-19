import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { BankMutationsPageHeader } from '@/4-1-bank-mutations/section/BankMutationsPageHeader';
import {
  BANK_MUTATIONS_MAIN_GRID,
  BANK_MUTATIONS_TABLE_SECTION,
} from '@/4-1-bank-mutations/layout/bankMutationsLayout';

type Props = {
  variant?: 'full' | 'embedded';
};

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function BankMutationsTableCardSkeleton() {
  return (
    <div className={BANK_MUTATIONS_MAIN_GRID}>
      <div className="col-span-12 flex min-w-0 flex-col self-stretch">
        <div className={BANK_MUTATIONS_TABLE_SECTION}>
          <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-shrink-0 border-b border-border bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[148px] flex-col gap-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-9 w-[168px]" />
                </div>
                <div className="flex min-w-[148px] flex-col gap-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-9 w-[140px]" />
                </div>
                <div className="flex min-w-[148px] flex-col gap-1">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-9 w-[156px]" />
                </div>
                <Skeleton className="ml-auto h-9 w-36" />
              </div>
            </div>
            <Skeleton className="min-h-[320px] rounded-none" />
            <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BankMutationsPageSkeleton({ variant = 'full' }: Props) {
  if (variant === 'embedded') {
    return <BankMutationsTableCardSkeleton />;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className={cn(MAIN_SCROLL, 'min-w-0')}>
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 flex-shrink-0">
                <BankMutationsPageHeader />
              </div>
              <BankMutationsTableCardSkeleton />
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
