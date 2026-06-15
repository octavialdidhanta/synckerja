import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { executeBrickDisbursement } from '@/4-1-transaction/lib/brickBankApi';
import { useBrickLinkedAccounts } from '@/4-1-transaction/hooks/useBrickLinkedAccounts';

type Props = {
  runId: string | null;
  runStatus?: string;
  onActionComplete?: () => void;
};

export function PayrollBrickDisburseActions({ runId, runStatus, onActionComplete }: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { hasLinkedAccount } = useBrickLinkedAccounts();
  const [loading, setLoading] = useState(false);

  if (!runId || runStatus !== 'calculated') return null;
  if (!hasLinkedAccount) return null;

  const handleDisburse = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await executeBrickDisbursement(organizationId, {
        source_type: 'payroll_run',
        payroll_run_id: runId,
      });
      toast.success(
        t('incomes.brick.disburse.payrollStarted', 'Brick disbursement started: {{ok}} ok, {{fail}} failed', {
          ok: res.processed,
          fail: res.failed,
        }),
      );
      onActionComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleDisburse} disabled={loading}>
      <Send className="mr-1 h-4 w-4" />
      {loading
        ? t('incomes.brick.disburse.processing', 'Processing…')
        : t('incomes.brick.disburse.disbursePayroll', 'Disburse via Brick')}
    </Button>
  );
}
