import { Button } from '@/shared/components/ui/button';
import { useCanAllocateIncome } from '@/4-1-dashboard/hooks/useCanAllocateIncome';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useBankMutations } from '@/shared/hooks/finance/useBankMutations';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Loader2, RefreshCw } from 'lucide-react';

type RefreshBankMutationsButtonProps = {
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
};

export function RefreshBankMutationsButton({
  size = 'sm',
  variant = 'outline',
  className,
}: RefreshBankMutationsButtonProps) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { canAllocateIncome } = useCanAllocateIncome();
  const { syncMutations, syncing, syncCooldownSec } = useBankMutations({
    bankAccountId: 'all',
    direction: 'all',
    matchFilter: 'all',
  });

  if (!organizationId || !canAllocateIncome) return null;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={syncing || syncCooldownSec > 0}
      onClick={() => syncMutations()}
    >
      {syncing ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="mr-1 h-3.5 w-3.5" />
      )}
      {syncCooldownSec > 0
        ? `${t('incomes.brick.refreshAll', 'Refresh mutasi semua rekening')} (${syncCooldownSec}s)`
        : t('incomes.brick.refreshAll', 'Refresh mutasi semua rekening')}
    </Button>
  );
}
