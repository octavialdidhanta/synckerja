import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCanAllocateIncome } from "@/4-1-dashboard/hooks/useCanAllocateIncome";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useGatewayWalletBalances } from "@/shared/hooks/finance/useGatewayWalletBalances";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import {
  usePrimarySubAccountWallet,
  useXenditSubAccountWallets,
} from "@/xendit/hooks/useXenditSubAccountWallets";
import { useXenditGatewayWithdrawals } from "@/4-1-transaction/xendit/hooks/useXenditGatewayWithdrawals";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import { mapBankNameToXenditCode } from "@/xendit/lib/bankCodes";
import { countSelectableSubAccounts, buildSubAccountLabel } from "@/xendit/lib/xenditSubAccountUtils";

function payoutBlockMessage(
  status: string | undefined,
  t: (key: string, fallback: string) => string,
): string | null {
  switch (status) {
    case "match":
      return null;
    case "pending":
      return t("xendit.payoutValidation.blockPending", "Validasi rekening masih berjalan.");
    case "stale":
      return t(
        "xendit.payoutValidation.blockStale",
        "Rekening payout perlu divalidasi ulang sebelum penarikan.",
      );
    case "unclear":
      return t(
        "xendit.payoutValidation.blockUnclear",
        "Nama pemilik tidak pasti — penarikan diblokir.",
      );
    case "not_match":
      return t(
        "xendit.payoutValidation.blockNotMatch",
        "Nama pemilik tidak cocok dengan rekening bank.",
      );
    case "failed":
      return t("xendit.payoutValidation.blockFailed", "Rekening bank tidak ditemukan.");
    default:
      return t(
        "xendit.payoutValidation.blockNone",
        "Validasi rekening payout belum berhasil (Iluma).",
      );
  }
}

export function useXenditFinancePanel() {
  const { t } = useTranslation();
  const { secureValidatePayoutBank } = useSecureXenditActions();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { canAllocateIncome } = useCanAllocateIncome();
  const { data, isLoading, isFetching, refetch } = useXenditOrgSettings(organizationId);
  const {
    xendit: xenditWallet,
    syncingXendit,
    syncXenditWallet,
    xenditEligible,
    xenditSyncedAt,
    xenditSyncError,
    isXenditSyncing,
  } = useGatewayWalletBalances({ autoSync: true, syncMode: 'always_on_mount' });

  const {
    data: walletBundle,
    isLoading: walletsLoading,
    isFetching: walletsFetching,
    refetch: refetchWallets,
  } = useXenditSubAccountWallets(organizationId, {
    enabled: xenditEligible,
    syncOnMount: false,
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  const selectableCount = countSelectableSubAccounts(data?.subAccounts);
  const hasSubAccount = selectableCount > 0;

  const primaryWallet = usePrimarySubAccountWallet(walletBundle?.wallets);
  const primarySubAccount =
    data?.primarySubAccount ??
    data?.subAccounts?.find((s) => s.is_primary) ??
    null;

  const { data: historyData } = useXenditGatewayWithdrawals(organizationId, hasSubAccount);

  const handleRefresh = useCallback(async () => {
    await refetch();
    await refetchWallets();
    if (xenditEligible) {
      await syncXenditWallet();
      await queryClient.invalidateQueries({ queryKey: ["xendit-akun-wallets", organizationId] });
    }
  }, [refetch, refetchWallets, syncXenditWallet, xenditEligible, queryClient, organizationId]);

  const aggregate = walletBundle?.aggregate ?? {
    usableBalance: Number(xenditWallet?.usable_balance ?? 0),
    pendingBalance: Number(xenditWallet?.pending_balance ?? 0),
    totalBalance: Number(xenditWallet?.total_balance ?? 0),
    syncedAt: xenditWallet?.synced_at ?? null,
  };

  const balanceLoading =
    xenditEligible &&
    (syncingXendit ||
      isXenditSyncing ||
      walletsLoading ||
      (!xenditWallet?.synced_at && !xenditWallet?.sync_error && !walletBundle));

  const resolvedSyncedAt =
    primaryWallet?.synced_at ??
    walletBundle?.aggregate.syncedAt ??
    xenditSyncedAt ??
    xenditWallet?.synced_at ??
    null;
  const resolvedSyncError = primaryWallet?.sync_error ?? xenditSyncError ?? xenditWallet?.sync_error ?? null;

  const primaryUsableBalance = Number(
    primaryWallet?.usable_balance ??
      (primarySubAccount?.is_primary ? xenditWallet?.usable_balance : 0) ??
      0,
  );
  const primaryPendingBalance = Number(primaryWallet?.pending_balance ?? 0);
  const primaryTotalBalance = Number(primaryWallet?.total_balance ?? primaryUsableBalance + primaryPendingBalance);

  const usableBalance = primaryUsableBalance;
  const pendingBalance = primaryPendingBalance;
  const totalBalance = primaryTotalBalance;

  const platformFee = Number(
    data?.withdrawalPlatformFee ?? data?.platformConfig?.flat_fee_amount ?? 2500,
  );

  const payoutBank = data?.account?.payout_bank;
  const hasPayoutBank = Boolean(
    payoutBank?.account_number && (payoutBank.gateway_payout_bank_code || payoutBank.bank_name),
  );
  const hasProcessing = (historyData ?? []).some(
    (row) => row.status === "processing" || row.status === "pending",
  );
  const payoutValidationStatus = payoutBank?.gateway_payout_validation_status;
  const payoutValidated = payoutValidationStatus === "match" && payoutBank?.use_for_gateway_payout;

  const canOpenWithdraw =
    canAllocateIncome &&
    hasPayoutBank &&
    payoutValidated &&
    !balanceLoading &&
    usableBalance > 0 &&
    !hasProcessing;

  const validationBlockMessage = payoutBlockMessage(payoutValidationStatus, t);

  const primaryWithdrawLabel = primarySubAccount
    ? buildSubAccountLabel(primarySubAccount)
    : primaryWallet
      ? buildSubAccountLabel({
          email: primaryWallet.email ?? "",
          business_name: primaryWallet.business_name ?? "",
          xendit_sub_account_id: primaryWallet.xendit_sub_account_id,
        })
      : null;

  const handleRevalidatePayout = useCallback(async () => {
    if (!organizationId || !payoutBank?.id) return;
    const bankCode =
      payoutBank.gateway_payout_bank_code?.trim() ||
      mapBankNameToXenditCode(payoutBank.bank_name ?? "");
    setRevalidating(true);
    try {
      await secureValidatePayoutBank(organizationId, {
        bank_account_id: payoutBank.id,
        bank_code: bankCode,
        account_number: payoutBank.account_number ?? "",
        account_holder: payoutBank.account_holder ?? "",
        enable_payout: true,
      });
      toast.success(t("xendit.payoutValidation.success", "Rekening payout tervalidasi."));
      void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["bank-accounts", organizationId] });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      await refetch();
    } finally {
      setRevalidating(false);
    }
  }, [organizationId, payoutBank, queryClient, refetch, secureValidatePayoutBank, t]);

  const refreshing = isFetching || syncingXendit || isXenditSyncing || walletsFetching;
  const pageLoadPending = isLoading && !data;

  return {
    organizationId,
    data,
    pageLoadPending,
    hasSubAccount,
    selectableCount,
    canAllocateIncome,
    xenditWallet,
    aggregate,
    subAccountWallets: walletBundle?.wallets ?? [],
    balanceLoading,
    usableBalance,
    pendingBalance,
    totalBalance,
    xenditSyncedAt: resolvedSyncedAt,
    xenditSyncError: resolvedSyncError,
    isXenditSyncing: syncingXendit || isXenditSyncing,
    primaryWithdrawLabel,
    platformFee,
    payoutBank,
    hasPayoutBank,
    hasProcessing,
    payoutValidated,
    canOpenWithdraw,
    validationBlockMessage,
    withdrawOpen,
    setWithdrawOpen,
    revalidating,
    handleRefresh,
    handleRevalidatePayout,
    refreshing,
  };
}
