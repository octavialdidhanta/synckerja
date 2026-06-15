import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCanAllocateIncome } from "@/4-1-dashboard/hooks/useCanAllocateIncome";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useGatewayWalletBalances } from "@/shared/hooks/finance/useGatewayWalletBalances";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { fetchGatewayWithdrawals, validateGatewayPayoutBank } from "@/xendit/lib/xenditApi";
import { mapBankNameToXenditCode } from "@/xendit/lib/bankCodes";

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
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { canAllocateIncome } = useCanAllocateIncome();
  const { data, isLoading, isFetching, refetch } = useXenditOrgSettings(organizationId);
  const {
    xendit: xenditWallet,
    syncingXendit,
    syncXenditWallet,
    xenditEligible,
  } = useGatewayWalletBalances({ autoSync: true });
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  const hasSubAccount = Boolean(data?.account?.xendit_sub_account_id);

  const { data: historyData } = useQuery({
    queryKey: ["xendit-gateway-withdrawals", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const res = await fetchGatewayWithdrawals(organizationId, 20);
      return res.withdrawals ?? [];
    },
    enabled: Boolean(organizationId && hasSubAccount),
    staleTime: 15_000,
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
    if (xenditEligible) {
      await syncXenditWallet();
    }
  }, [refetch, syncXenditWallet, xenditEligible]);

  const balanceLoading =
    xenditEligible &&
    (syncingXendit || (!xenditWallet?.synced_at && !xenditWallet?.sync_error));
  const usableBalance = Number(xenditWallet?.usable_balance ?? 0);
  const pendingBalance = Number(xenditWallet?.pending_balance ?? 0);
  const totalBalance = Number(xenditWallet?.total_balance ?? usableBalance + pendingBalance);
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

  const handleRevalidatePayout = useCallback(async () => {
    if (!organizationId || !payoutBank?.id) return;
    const bankCode =
      payoutBank.gateway_payout_bank_code?.trim() ||
      mapBankNameToXenditCode(payoutBank.bank_name ?? "");
    setRevalidating(true);
    try {
      await validateGatewayPayoutBank(organizationId, {
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
  }, [organizationId, payoutBank, queryClient, refetch, t]);

  const refreshing = isFetching || syncingXendit;
  const pageLoadPending = isLoading && !data;

  return {
    organizationId,
    data,
    pageLoadPending,
    hasSubAccount,
    canAllocateIncome,
    xenditWallet,
    balanceLoading,
    usableBalance,
    pendingBalance,
    totalBalance,
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
