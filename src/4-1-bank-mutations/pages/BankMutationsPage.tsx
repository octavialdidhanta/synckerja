import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useBrickOAuthReturn } from '@/4-1-transaction/hooks/useBrickOAuthReturn';
import { BankMutationsPanel } from '@/4-1-transaction/section/BankMutationsPanel';
import {
  BANK_MUTATIONS_MAIN_GRID,
  BANK_MUTATIONS_TABLE_SECTION,
} from '@/4-1-bank-mutations/layout/bankMutationsLayout';

type BankMutationsPageProps = {
  onLoadingOverlayChange?: (showContent: boolean) => void;
};

export function BankMutationsPage({ onLoadingOverlayChange }: BankMutationsPageProps) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  useBrickOAuthReturn('bank', () => {
    if (!organizationId) return;
    void queryClient.invalidateQueries({ queryKey: ['bank-accounts', organizationId] });
  });

  return (
    <div className={BANK_MUTATIONS_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={BANK_MUTATIONS_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <BankMutationsPanel layout="page" onLoadingOverlayChange={onLoadingOverlayChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
