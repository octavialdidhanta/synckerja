import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useBrickOAuthReturn } from '@/4-1-transaction/hooks/useBrickOAuthReturn';
import { BankMutationsPanel } from '@/4-1-transaction/section/BankMutationsPanel';
import {
  BANK_MUTATIONS_MAIN_GRID,
  BANK_MUTATIONS_TABLE_SECTION,
} from '@/4-1-bank-mutations/layout/bankMutationsLayout';

export function BankMutationsPage() {
  const { refetch } = useBankAccounts({ includeInactive: true });
  useBrickOAuthReturn('bank', refetch);

  return (
    <div className={BANK_MUTATIONS_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
        <div className={BANK_MUTATIONS_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <BankMutationsPanel layout="page" />
          </div>
        </div>
      </div>
    </div>
  );
}
