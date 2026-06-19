import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useRequireMfaForRole } from "@/shared/auth/mfa/useRequireMfaForRole";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import { pollXenditDisbursements } from "@/xendit/lib/xenditApi";
import { usePayrollXenditCashBalance } from "./usePayrollXenditCashBalance";

type Options = {
  runId: string | null;
  runStatus?: string;
  hasActiveDisbursement?: boolean;
  onActionComplete?: () => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
};

export function usePayrollXenditDisburse({
  runId,
  runStatus,
  hasActiveDisbursement = false,
  onActionComplete,
  panelOpen,
  onPanelOpenChange,
}: Options) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { isOwner, isAdmin } = useCentralizedUserData();
  const { mustEnroll, inGracePeriod } = useRequireMfaForRole();
  const { data: settings } = useXenditOrgSettings(organizationId);
  const { secureDisbursement } = useSecureXenditActions();
  const [loading, setLoading] = useState(false);
  const cashBalance = usePayrollXenditCashBalance(organizationId, panelOpen);

  const visible =
    Boolean(isOwner || isAdmin) &&
    Boolean(runId && runStatus === "calculated") &&
    Boolean(settings?.account?.is_enabled);

  const primary =
    settings?.primarySubAccount ?? settings?.subAccounts?.find((s) => s.is_primary) ?? null;
  const mfaBlocked = mustEnroll && !inGracePeriod;
  const canDisburse = primary?.status === "active" && !hasActiveDisbursement && !mfaBlocked;

  const disabledReason = mfaBlocked
    ? t(
        "payroll.xendit.mfaEnrollRequired",
        "Aktifkan autentikasi dua faktor di Pengaturan Keamanan sebelum disburse.",
      )
    : hasActiveDisbursement
      ? t(
          "payroll.xendit.disburseLocked",
          "Disburse sedang berjalan. Tunggu webhook Xendit selesai.",
        )
      : !primary
        ? t("xendit.kyc.noPrimarySubAccount", "Daftarkan bisnis di Perbankan Xendit terlebih dahulu.")
        : primary.status !== "active"
          ? t(
              "xendit.kyc.payrollBlocked",
              "Akun Xendit belum aktif. Selesaikan verifikasi di Perbankan Xendit.",
            )
          : null;

  const closePanel = () => onPanelOpenChange(false);

  const togglePanel = () => {
    if (loading) return;
    if (!panelOpen && !canDisburse) return;
    onPanelOpenChange(!panelOpen);
  };

  const handleDisburse = async () => {
    if (!organizationId || !runId) return;
    setLoading(true);
    try {
      const res = await secureDisbursement(organizationId, {
        source_type: "payroll_run",
        payroll_run_id: runId,
      });
      toast.success(
        t("xendit.payrollDisburseStarted", "Disbursement dimulai: {{ok}} berhasil, {{fail}} gagal", {
          ok: res.processed,
          fail: res.failed,
        }),
      );
      try {
        await pollXenditDisbursements(organizationId);
      } catch {
        /* webhook or manual refresh can settle later */
      }
      await queryClient.invalidateQueries({ queryKey: ["payroll-disburse-preview", runId] });
      await queryClient.invalidateQueries({ queryKey: ["gateway-wallet-balances", organizationId] });
      await cashBalance.refresh();
      onActionComplete?.();
      closePanel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible && panelOpen) {
      closePanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close when disburse UI becomes unavailable
  }, [visible, panelOpen]);

  return {
    visible,
    canDisburse,
    mfaBlocked,
    disabledReason,
    panelOpen,
    togglePanel,
    closePanel,
    loading,
    handleDisburse,
    cashBalance,
    hasActiveDisbursement,
    runId,
  };
}
