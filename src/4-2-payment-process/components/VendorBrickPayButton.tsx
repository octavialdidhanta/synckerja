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
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { executeBrickDisbursement } from '@/4-1-transaction/lib/brickBankApi';
import {
  BRICK_DISBURSE_BANKS,
  BRICK_SANDBOX_DISBURSE_ACCOUNT,
  useBrickLinkedAccounts,
} from '@/4-1-transaction/hooks/useBrickLinkedAccounts';
import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';

type Props = {
  request: PurchaseRequest;
  onSuccess?: () => void;
};

function defaultVendorBankCode(request: PurchaseRequest): string {
  const code = request.vendor_bank_code?.trim().toUpperCase();
  if (code && BRICK_DISBURSE_BANKS.some((b) => b.code === code)) return code;
  return BRICK_SANDBOX_DISBURSE_ACCOUNT.bankShortCode;
}

export function VendorBrickPayButton({ request, onSuccess }: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { hasLinkedAccount, omnichannelSource } = useBrickLinkedAccounts();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankCode, setBankCode] = useState(defaultVendorBankCode(request));
  const [accountNumber, setAccountNumber] = useState(
    request.vendor_bank_account_number?.trim() || BRICK_SANDBOX_DISBURSE_ACCOUNT.accountNo,
  );
  const [accountHolder, setAccountHolder] = useState(
    request.vendor_bank_account_holder?.trim() || BRICK_SANDBOX_DISBURSE_ACCOUNT.accountHolderName,
  );

  if (!hasLinkedAccount || request.status !== 'approved' || request.paid_at) return null;
  if (request.payment_status === 'processing') return null;

  const openDialog = () => {
    setBankCode(defaultVendorBankCode(request));
    setAccountNumber(
      request.vendor_bank_account_number?.trim() || BRICK_SANDBOX_DISBURSE_ACCOUNT.accountNo,
    );
    setAccountHolder(
      request.vendor_bank_account_holder?.trim() || BRICK_SANDBOX_DISBURSE_ACCOUNT.accountHolderName,
    );
    setOpen(true);
  };

  const handlePay = async () => {
    if (!organizationId) return;

    const isSandboxTest =
      accountNumber.replace(/\D/g, '') === BRICK_SANDBOX_DISBURSE_ACCOUNT.accountNo &&
      accountHolder.toUpperCase().includes('PROD');

    if (isSandboxTest && bankCode !== BRICK_SANDBOX_DISBURSE_ACCOUNT.bankShortCode) {
      toast.error(
        t(
          'incomes.brick.disburse.sandboxBankMismatch',
          'Sandbox test account 12345678 / PROD ONLY hanya valid untuk Bank Mandiri, bukan {{bank}}.',
          { bank: bankCode },
        ),
      );
      return;
    }

    if (request.amount_idr > 100_000) {
      toast.error(
        t(
          'incomes.brick.disburse.sandboxAmountTooHigh',
          'Nominal {{amount}} terlalu besar untuk sandbox Brick. Jalankan brick-disbursement-reset-qa.sql (set Rp 10.000) atau gunakan request QA lain.',
          { amount: formatToRupiah(request.amount_idr) },
        ),
      );
      return;
    }

    setLoading(true);
    try {
      await executeBrickDisbursement(organizationId, {
        source_type: 'purchase_request',
        source_id: request.id,
        bank_code: bankCode,
        account_number: accountNumber,
        account_holder_name: accountHolder,
        amount: request.amount_idr,
        description: `Vendor payment ${request.request_title ?? request.id}`,
      });
      toast.success(t('incomes.brick.disburse.vendorStarted', 'Vendor payment submitted via Brick'));
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
      <Button size="sm" variant="outline" onClick={openDialog}>
        {t('incomes.brick.disburse.payVendor', 'Pay via Brick')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('incomes.brick.disburse.vendorTitle', 'Vendor disbursement via Brick')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {omnichannelSource ? (
              <p className="text-xs text-muted-foreground">
                {t('incomes.brick.disburse.sourceAccount', 'Source account')}:{' '}
                {omnichannelSource.name}
                {omnichannelSource.bank_name ? ` (${omnichannelSource.bank_name})` : ''}
              </p>
            ) : null}
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t(
                'incomes.brick.disburse.sandboxHint',
                'Sandbox Brick: gunakan Mandiri, rekening 12345678, nama PROD ONLY, nominal kecil (mis. Rp 10.000).',
              )}
            </p>
            <p className="text-sm font-medium text-slate-800">
              {t('incomes.brick.disburse.amount', 'Amount')}: {formatToRupiah(request.amount_idr)}
              {request.amount_idr > 100_000 ? (
                <span className="ml-2 text-xs font-normal text-red-600">
                  {t('incomes.brick.disburse.amountTooHighHint', '(terlalu besar untuk sandbox)')}
                </span>
              ) : null}
            </p>
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
