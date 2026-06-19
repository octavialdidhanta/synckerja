import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useWithdrawalFromBalanceOptions } from '@/shared/hooks/finance/useWithdrawalFromBalanceOptions';
import {
  encodeWithdrawalSourceValue,
  normalizeWithdrawalSourceValue,
  type WithdrawalSourceValue,
} from '@/shared/lib/finance/withdrawalSourceValue';

type WithdrawalFromBalanceSelectProps = {
  value: WithdrawalSourceValue;
  onChange: (value: WithdrawalSourceValue) => void;
  allowNone?: boolean;
  disabled?: boolean;
  id?: string;
  label?: string;
  labelClassName?: string;
  showLabel?: boolean;
  placeholder?: string;
  requiredMark?: boolean;
};

export function WithdrawalFromBalanceSelect({
  value,
  onChange,
  allowNone = true,
  disabled = false,
  id = 'withdrawal-from-balance',
  label,
  labelClassName,
  showLabel = true,
  placeholder,
  requiredMark = false,
}: WithdrawalFromBalanceSelectProps) {
  const { t } = useAppTranslation();
  const {
    loading,
    debtsForExpense,
    bankAccounts,
    bankAccountBalances,
    gateways,
    isStaleXendit,
    isStaleBrick,
    formatRupiahAvailable,
    formatGatewaySyncHint,
    formatSelectedLabel,
    xenditAggregateHint,
  } = useWithdrawalFromBalanceOptions();

  const normalized = normalizeWithdrawalSourceValue(value);
  const encodedRaw = encodeWithdrawalSourceValue(normalized);
  const encoded = allowNone ? encodedRaw : encodedRaw === 'none' ? undefined : encodedRaw;
  const selectedLabel = formatSelectedLabel(normalized);

  const resolvedLabel =
    label ??
    (allowNone
      ? t('expenses.withdrawalFromBalanceOptional', 'Withdrawal From Balance (Optional)')
      : t('expenses.withdrawalFromBalanceRequired', 'Withdrawal From Balance'));

  const resolvedPlaceholder =
    placeholder ??
    (loading
      ? t('expenses.loading', 'Loading...')
      : allowNone
        ? t('expenses.selectSourceOptional', 'Select Source (Optional)')
        : t('expenses.selectSourceRequired', 'Select source (required)'));

  return (
    <div className="space-y-2">
      {showLabel ? (
        <Label htmlFor={id} className={labelClassName ?? 'text-sm font-medium'}>
          {resolvedLabel}
          {requiredMark ? <span className="text-brand-red"> *</span> : null}
        </Label>
      ) : null}
      <Select
        value={encoded ?? (allowNone ? 'none' : undefined)}
        onValueChange={(raw) => {
          if (raw === 'none') {
            onChange({});
            return;
          }
          if (raw.startsWith('gateway_')) {
            const provider = raw.replace('gateway_', '') as 'xendit' | 'brick';
            onChange({ gatewayProvider: provider });
            return;
          }
          if (raw.startsWith('debt_')) {
            onChange({ debtId: raw.replace('debt_', '') });
            return;
          }
          if (raw.startsWith('bank_')) {
            onChange({ bankAccountId: raw.replace('bank_', '') });
          }
        }}
        disabled={disabled || loading}
      >
        <SelectTrigger id={id} className="h-auto min-h-10 py-2">
          <span className="truncate text-left text-sm">
            {selectedLabel ? (
              selectedLabel
            ) : (
              <span className="text-muted-foreground">{resolvedPlaceholder}</span>
            )}
          </span>
        </SelectTrigger>
        <SelectContent>
          {allowNone ? (
            <SelectItem value="none">{t('expenses.none', 'None')}</SelectItem>
          ) : null}

          {gateways.length > 0 ? (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                {t('expenses.paymentGateways', 'Payment gateways')}
              </div>
              {gateways.map((gw) => {
                const itemText = `${gw.label} (${formatRupiahAvailable(gw.usableBalance)})`;
                return (
                <SelectItem
                  key={`gateway_${gw.provider}`}
                  value={`gateway_${gw.provider}`}
                  textValue={itemText}
                >
                  <span className="block">{gw.label}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {formatRupiahAvailable(gw.usableBalance)} ·{' '}
                    {formatGatewaySyncHint(
                      gw.syncedAt,
                      gw.provider === 'xendit' ? isStaleXendit : isStaleBrick,
                    )}
                  </span>
                </SelectItem>
                );
              })}
            </>
          ) : null}

          {bankAccounts.length > 0 ? (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                {t('expenses.bankAccounts', 'Bank Accounts')}
              </div>
              {bankAccounts.map((bankAccount) => {
                const balance = bankAccountBalances.find((b) => b.bank_account_id === bankAccount.id);
                const availableBalance = balance?.balance ?? 0;
                const displayText = bankAccount.account_number
                  ? `${bankAccount.name} - ${bankAccount.account_number} (${formatRupiahAvailable(availableBalance)})`
                  : `${bankAccount.name} (${formatRupiahAvailable(availableBalance)})`;
                return (
                  <SelectItem
                    key={`bank_${bankAccount.id}`}
                    value={`bank_${bankAccount.id}`}
                    textValue={displayText}
                  >
                    {displayText}
                  </SelectItem>
                );
              })}
            </>
          ) : null}

          {debtsForExpense.length > 0 ? (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                {t('expenses.debts', 'Debts')}
              </div>
              {debtsForExpense.map((debt) => {
                const availableLimit = debt.available_limit ?? 0;
                return (
                  <SelectItem
                    key={`debt_${debt.id}`}
                    value={`debt_${debt.id}`}
                    textValue={`${debt.debt_name} (${formatRupiahAvailable(availableLimit)})`}
                  >
                    {debt.debt_name} ({formatRupiahAvailable(availableLimit)})
                  </SelectItem>
                );
              })}
            </>
          ) : null}
        </SelectContent>
      </Select>
      {normalized.gatewayProvider === 'xendit' && xenditAggregateHint ? (
        <p className="text-[11px] text-muted-foreground">{xenditAggregateHint}</p>
      ) : null}
    </div>
  );
}
