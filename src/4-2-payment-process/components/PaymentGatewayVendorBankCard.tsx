import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  BRICK_DISBURSE_BANKS,
  BRICK_SANDBOX_DISBURSE_ACCOUNT,
} from '@/4-1-transaction/hooks/useBrickLinkedAccounts';

export type GatewayVendorBankFields = {
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
};

type PaymentGatewayVendorBankCardProps = {
  provider: 'xendit' | 'brick';
  value: GatewayVendorBankFields;
  onChange: (value: GatewayVendorBankFields) => void;
  xenditBanks?: Array<{ code: string; label: string }>;
};

const DEFAULT_XENDIT_BANKS = [
  { code: 'BCA', label: 'BCA' },
  { code: 'MANDIRI', label: 'Mandiri' },
  { code: 'BRI', label: 'BRI' },
  { code: 'BNI', label: 'BNI' },
];

export function PaymentGatewayVendorBankCard({
  provider,
  value,
  onChange,
  xenditBanks = DEFAULT_XENDIT_BANKS,
}: PaymentGatewayVendorBankCardProps) {
  const { t } = useAppTranslation();
  const banks = provider === 'brick' ? BRICK_DISBURSE_BANKS : xenditBanks;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-amber-950">
          {t('payments.gatewayVendorBankTitle', 'Vendor bank account (required for real disbursement)')}
        </p>
        <p className="text-xs text-amber-900/80 mt-1">
          {provider === 'xendit'
            ? t(
                'payments.gatewayVendorBankXenditHint',
                'Funds will be sent from your Xendit xenPlatform balance to this vendor account. Saldo Xendit akan berkurang setelah disbursement berhasil.',
              )
            : t(
                'payments.gatewayVendorBankBrickHint',
                'Funds will be sent via Brick disbursement API. Use Mandiri 12345678 / PROD ONLY for sandbox tests (amount ≤ Rp 100.000).',
              )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('payments.vendorBank', 'Bank')}</Label>
          <Select
            value={value.bankCode || undefined}
            onValueChange={(bankCode) => onChange({ ...value, bankCode })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={t('payments.selectBank', 'Select bank')} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.code} value={bank.code}>
                  {bank.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('payments.vendorAccountNumber', 'Account number')}</Label>
          <Input
            className="h-9 text-sm"
            value={value.accountNumber}
            onChange={(e) => onChange({ ...value, accountNumber: e.target.value })}
            placeholder={provider === 'brick' ? BRICK_SANDBOX_DISBURSE_ACCOUNT.accountNo : '1234567890'}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('payments.vendorAccountHolder', 'Account holder')}</Label>
          <Input
            className="h-9 text-sm"
            value={value.accountHolder}
            onChange={(e) => onChange({ ...value, accountHolder: e.target.value })}
            placeholder={provider === 'brick' ? BRICK_SANDBOX_DISBURSE_ACCOUNT.accountHolderName : 'Vendor name'}
          />
        </div>
      </div>
    </div>
  );
}
