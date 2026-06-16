import { useMemo } from 'react';
import { useDebtsForExpense } from '@/shared/hooks/finance/useDebtsForExpense';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useGatewayWalletBalances } from '@/shared/hooks/finance/useGatewayWalletBalances';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { GatewayWalletProvider, WithdrawalSourceValue } from '@/shared/lib/finance/withdrawalSourceValue';

export type WithdrawalGatewayOption = {
  provider: GatewayWalletProvider;
  label: string;
  usableBalance: number;
  syncedAt: string | null;
  eligible: boolean;
};

export function useWithdrawalFromBalanceOptions(options?: { autoSync?: boolean }) {
  const autoSync = options?.autoSync !== false;
  const { t } = useAppTranslation();
  const { debts: debtsForExpense, isLoading: debtsLoading, refetch: refetchDebts } = useDebtsForExpense();
  const {
    bankAccounts,
    loading: bankAccountsLoading,
    isPending: bankAccountsPending,
    refetch: refetchBankAccounts,
  } = useBankAccounts();
  const {
    balances: bankAccountBalances,
    loading: balancesLoading,
    isPending: balancesPending,
    refetch: refetchBalances,
  } = useBankAccountBalances();
  const {
    brick,
    xendit,
    brickEligible,
    xenditEligible,
    isLoading: gatewayLoading,
    isPending: gatewayPending,
    isStaleXendit,
    isStaleBrick,
  } = useGatewayWalletBalances({ autoSync });

  const loading =
    debtsLoading ||
    bankAccountsLoading ||
    balancesLoading ||
    gatewayLoading ||
    bankAccountsPending ||
    balancesPending ||
    gatewayPending;

  const gateways = useMemo((): WithdrawalGatewayOption[] => {
    const rows: WithdrawalGatewayOption[] = [];
    if (xenditEligible) {
      const balance = Number(xendit?.usable_balance ?? 0);
      rows.push({
        provider: 'xendit',
        label: t('expenses.gatewayXendit', 'Xendit'),
        usableBalance: balance,
        syncedAt: xendit?.synced_at ?? null,
        eligible: true,
      });
    }
    if (brickEligible) {
      const balance = Number(brick?.usable_balance ?? 0);
      rows.push({
        provider: 'brick',
        label: t('expenses.gatewayBrick', 'Brick'),
        usableBalance: balance,
        syncedAt: brick?.synced_at ?? null,
        eligible: true,
      });
    }
    return rows;
  }, [brick, brickEligible, t, xendit, xenditEligible]);

  const formatRupiahAvailable = (amount: number) =>
    t('expenses.availableBalance', 'Rp {{amount}} available', {
      amount: amount.toLocaleString('id-ID'),
    });

  const formatGatewaySyncHint = (syncedAt: string | null, stale?: boolean) => {
    if (!syncedAt) {
      return t('expenses.gatewaySyncPending', 'Sync pending');
    }
    const diffMin = Math.floor((Date.now() - new Date(syncedAt).getTime()) / 60_000);
    const syncLabel =
      diffMin < 1
        ? t('incomes.gateway.syncedJustNow', 'Baru disinkronkan')
        : diffMin < 60
          ? t('incomes.gateway.syncedMinutesAgo', '{{count}} menit lalu', { count: diffMin })
          : new Date(syncedAt).toLocaleString('id-ID');
    return stale
      ? `${syncLabel} · ${t('expenses.gatewayStale', 'refreshing…')}`
      : syncLabel;
  };

  const formatSelectedLabel = (value: WithdrawalSourceValue): string => {
    if (value.gatewayProvider) {
      const gw = gateways.find((g) => g.provider === value.gatewayProvider);
      if (gw) {
        return `${gw.label} (${formatRupiahAvailable(gw.usableBalance)})`;
      }
      return value.gatewayProvider === 'xendit'
        ? t('expenses.gatewayXendit', 'Xendit')
        : t('expenses.gatewayBrick', 'Brick');
    }
    if (value.debtId) {
      const debt = debtsForExpense.find((d) => d.id === value.debtId);
      if (debt) {
        return `${debt.debt_name} (${formatRupiahAvailable(debt.available_limit ?? 0)})`;
      }
    }
    if (value.bankAccountId) {
      const bank = bankAccounts.find((b) => b.id === value.bankAccountId);
      if (bank) {
        const balance = bankAccountBalances.find((b) => b.bank_account_id === bank.id);
        const available = balance?.balance ?? 0;
        const name = bank.account_number ? `${bank.name} - ${bank.account_number}` : bank.name;
        return `${name} (${formatRupiahAvailable(available)})`;
      }
    }
    return '';
  };

  return {
    loading,
    debtsForExpense,
    bankAccounts,
    bankAccountBalances,
    gateways,
    isStaleXendit,
    isStaleBrick,
    refetchDebts,
    refetchBankAccounts,
    refetchBalances,
    formatRupiahAvailable,
    formatGatewaySyncHint,
    formatSelectedLabel,
  };
}
