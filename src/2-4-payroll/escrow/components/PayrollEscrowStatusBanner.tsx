import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { cn } from "@/shared/lib/utils";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePayrollEscrowSettings } from "../hooks/usePayrollEscrowSettings";
import {
  payrollEscrowTransferQueryKey,
  usePayrollEscrowTransferStatus,
} from "../hooks/usePayrollEscrowTransferStatus";

type Props = {
  runId: string | null;
  runStatus?: string;
};

export function PayrollEscrowStatusBanner({ runId, runStatus }: Props) {
  const { t } = useAppTranslation();
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const { data: settings } = usePayrollEscrowSettings(organizationId);
  const { data: transfer, isLoading } = usePayrollEscrowTransferStatus(
    runId,
    Boolean(settings?.is_enabled && runStatus === "paid"),
  );
  const { secureRetryPayrollEscrowTransfer } = useSecureXenditActions();
  const queryClient = useQueryClient();

  if (!settings?.is_enabled || runStatus !== "paid" || !runId) return null;
  if (isLoading) return null;

  if (!transfer) return null;

  const retry = async () => {
    if (!organizationId || !runId) return;
    try {
      const result = await secureRetryPayrollEscrowTransfer(organizationId, runId);
      await queryClient.invalidateQueries({ queryKey: payrollEscrowTransferQueryKey(runId) });
      if (result.ok && !result.error) {
        toast.success(t("payroll.escrow.retrySuccess", "Transfer escrow berhasil."));
      } else {
        toast.error(result.error ?? t("payroll.escrow.retryFailed", "Transfer escrow gagal."));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("payroll.escrow.retryFailed", "Transfer escrow gagal."));
    }
  };

  if (transfer.status === "completed") {
    return (
      <div className="mb-2 shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {t("payroll.escrow.bannerSuccessTitle", "Escrow PPh/BPJS berhasil dipindah")}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {t("payroll.escrow.bannerSuccessBody", "Total {{amount}} dipindah ke sub-account escrow.", {
                amount: formatToRupiah(transfer.amount_total),
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (transfer.status === "failed") {
    return (
      <div className="mb-2 shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-destructive font-medium">
              {t("payroll.escrow.bannerFailedTitle", "Escrow PPh/BPJS gagal")}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {transfer.failure_message ??
                t(
                  "payroll.escrow.bannerFailedBody",
                  "Saldo CASH Utama mungkin tidak cukup setelah disburse THP. Top-up lalu coba lagi.",
                )}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs"
              onClick={() => void retry()}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {t("payroll.escrow.retryTransfer", "Coba transfer lagi")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (transfer.status === "pending") {
    return (
      <div className="mb-2 shrink-0 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
        <div className={cn("text-muted-foreground flex items-center gap-2")}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("payroll.escrow.bannerPending", "Memproses transfer escrow PPh/BPJS…")}
        </div>
      </div>
    );
  }

  return null;
}
