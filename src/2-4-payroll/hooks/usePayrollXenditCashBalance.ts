import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGatewayWalletBalances } from '@/shared/hooks/finance/useGatewayWalletBalances';
import { useXenditOrgSettings } from '@/xendit/hooks/useXenditOrgSettings';
import {
  usePrimarySubAccountWallet,
  useXenditSubAccountWallets,
} from '@/xendit/hooks/useXenditSubAccountWallets';
import { countSelectableSubAccounts, isSubAccountSelectable } from '@/xendit/lib/xenditSubAccountUtils';
import { usePayrollEscrowSettings } from '@/2-4-payroll/escrow/hooks/usePayrollEscrowSettings';

export function usePayrollXenditCashBalance(
  organizationId: string | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const syncRequestedRef = useRef(false);
  const { data: xenditSettings } = useXenditOrgSettings(organizationId);
  const { data: escrowSettings } = usePayrollEscrowSettings(organizationId);
  const xenditEligible = Boolean(
    xenditSettings?.account?.is_enabled &&
      ((xenditSettings?.subAccounts?.some(isSubAccountSelectable) ?? false) ||
        xenditSettings?.account?.xendit_sub_account_id),
  );

  const {
    xendit,
    syncXenditWallet,
    syncingXendit,
    isXenditSyncing,
    xenditSyncedAt,
    xenditSyncError,
  } = useGatewayWalletBalances({ autoSync: false });

  const { data: walletBundle, isLoading: walletsLoading } = useXenditSubAccountWallets(
    organizationId,
    {
      enabled: Boolean(organizationId) && xenditEligible && enabled,
      syncOnMount: false,
    },
  );

  const primaryWallet = usePrimarySubAccountWallet(walletBundle?.wallets);
  const escrowWallet = useMemo(() => {
    const escrowId = escrowSettings?.escrow_sub_account_row_id;
    if (!escrowId || !walletBundle?.wallets?.length) return null;
    return walletBundle.wallets.find((w) => w.sub_account_row_id === escrowId) ?? null;
  }, [escrowSettings?.escrow_sub_account_row_id, walletBundle?.wallets]);

  const selectableCount = countSelectableSubAccounts(xenditSettings?.subAccounts);
  const aggregateBalance = Number(walletBundle?.aggregate.usableBalance ?? xendit?.usable_balance ?? 0);

  const operationalCash = useMemo(() => {
    if (primaryWallet != null) {
      return Number(primaryWallet.usable_balance ?? 0);
    }
    return aggregateBalance;
  }, [primaryWallet, aggregateBalance]);

  const reservedCash = useMemo(() => {
    if (escrowWallet != null) {
      return Number(escrowWallet.usable_balance ?? 0);
    }
    return 0;
  }, [escrowWallet]);

  const balance = operationalCash;

  const syncedAt =
    primaryWallet?.synced_at ??
    walletBundle?.aggregate.syncedAt ??
    xenditSyncedAt ??
    xendit?.synced_at ??
    null;

  const syncError = primaryWallet?.sync_error ?? xenditSyncError ?? xendit?.sync_error ?? null;
  const isSyncing = syncingXendit || isXenditSyncing;

  useEffect(() => {
    syncRequestedRef.current = false;
  }, [organizationId]);

  useEffect(() => {
    if (!enabled || !organizationId || !xenditEligible || syncRequestedRef.current) return;
    syncRequestedRef.current = true;
    void (async () => {
      await syncXenditWallet();
      await queryClient.invalidateQueries({ queryKey: ['xendit-akun-wallets', organizationId] });
    })();
  }, [enabled, organizationId, xenditEligible, syncXenditWallet, queryClient]);

  const refresh = async () => {
    if (!organizationId || !xenditEligible) return;
    await syncXenditWallet();
    await queryClient.invalidateQueries({ queryKey: ['xendit-akun-wallets', organizationId] });
  };

  return {
    balance,
    operationalCash,
    reservedCash,
    aggregateBalance,
    selectableCount,
    syncedAt,
    syncError,
    isSyncing,
    isLoading: walletsLoading && !walletBundle,
    refresh,
    escrowEnabled: Boolean(escrowSettings?.is_enabled),
  };
}
