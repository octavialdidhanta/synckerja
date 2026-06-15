import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { executeBrickDisbursement } from '@/4-1-transaction/lib/brickBankApi';
import {
  BRICK_DISBURSE_BANKS,
  useBrickLinkedAccounts,
} from '@/4-1-transaction/hooks/useBrickLinkedAccounts';

type Props = {
  debtPaymentId: string;
  amount: number;
  description?: string;
  onSuccess?: () => void;
};

export function DebtBrickDisburseButton({ debtPaymentId, amount, description, onSuccess }: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { hasLinkedAccount, omnichannelSource } = useBrickLinkedAccounts();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankCode, setBankCode] = useState('BCA');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  if (!hasLinkedAccount) return null;

  const handlePay = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      await executeBrickDisbursement(organizationId, {
        source_type: 'debt_payment',
        source_id: debtPaymentId,
        bank_code: bankCode,
        account_number: accountNumber,
        account_holder_name: accountHolder,
        amount,
        description: description ?? 'Debt payment',
      });
      toast.success(t('incomes.brick.disburse.debtStarted', 'Debt disbursement submitted via Brick'));
      setOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t('incomes.brick.disburse.disburseDebt', 'Disburse via Brick')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('incomes.brick.disburse.debtTitle', 'Debt payment via Brick')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {omnichannelSource ? (
              <p className="text-xs text-muted-foreground">
                {t('incomes.brick.disburse.sourceAccount', 'Source account')}:{' '}
                {omnichannelSource.name}
                {omnichannelSource.bank_name ? ` (${omnichannelSource.bank_name})` : ''}
              </p>
            ) : null}
            <div>
              <Label>{t('incomes.brick.disburse.bank', 'Bank')}</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BRICK_DISBURSE_BANKS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('incomes.brick.disburse.accountNumber', 'Account number')}</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <Label>{t('incomes.brick.disburse.accountHolder', 'Account holder')}</Label>
              <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePay} disabled={loading || !accountNumber || !accountHolder}>
              {loading
                ? t('incomes.brick.disburse.processing', 'Processing…')
                : t('incomes.brick.disburse.submit', 'Submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
