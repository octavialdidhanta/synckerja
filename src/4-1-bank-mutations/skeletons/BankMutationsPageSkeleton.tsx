import { Skeleton } from '@/shared/components/ui/skeleton';
import { BankMutationsPageHeader } from '@/4-1-bank-mutations/section/BankMutationsPageHeader';
import {
  BANK_MUTATIONS_MAIN_GRID,
  BANK_MUTATIONS_TABLE_SECTION,
} from '@/4-1-bank-mutations/layout/bankMutationsLayout';

type Props = {
  variant?: 'full' | 'embedded';
};

export function BankMutationsPageSkeleton({ variant = 'full' }: Props) {
  const inner = (
    <div className={BANK_MUTATIONS_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
        <div className={BANK_MUTATIONS_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-shrink-0 border-b border-border px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-[180px]" />
                <Skeleton className="h-8 w-[140px]" />
                <Skeleton className="h-8 w-[160px]" />
                <Skeleton className="ml-auto h-8 w-44" />
              </div>
            </div>
            <Skeleton className="min-h-0 flex-1 rounded-none" />
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

  if (variant === 'embedded') {
    return inner;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden">
          <div className="mb-1 min-w-0 flex-shrink-0">
            <BankMutationsPageHeader />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{inner}</div>
        </div>
      </div>
    </div>
  );
}
