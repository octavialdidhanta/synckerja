import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { usePayrollEscrowSettings } from "../hooks/usePayrollEscrowSettings";
import {
  usePayrollEscrowAmounts,
  usePayrollEscrowTransferStatus,
} from "../hooks/usePayrollEscrowTransferStatus";

type Props = {
  runId: string | null;
  runStatus?: string;
};

export function PayrollEscrowHistoryPanel({ runId, runStatus }: Props) {
  const { t } = useAppTranslation();
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const { data: settings } = usePayrollEscrowSettings(organizationId);
  const show = Boolean(settings?.is_enabled && runId);
  const { data: amounts } = usePayrollEscrowAmounts(runId, show);
  const { data: transfer } = usePayrollEscrowTransferStatus(runId, show && runStatus === "paid");

  if (!show || !runId) return null;

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
      <p className="text-foreground font-medium">
        {t("payroll.escrow.historyTitle", "Escrow PPh/BPJS")}
      </p>
      <div className="text-muted-foreground mt-2 space-y-1">
        <div className="flex justify-between gap-2">
          <span>{t("payroll.escrow.amountPph21", "PPh 21")}</span>
          <span className="tabular-nums">{formatToRupiah(amounts?.amount_pph21 ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t("payroll.escrow.amountBpjsKes", "BPJS Kesehatan")}</span>
          <span className="tabular-nums">{formatToRupiah(amounts?.amount_bpjs_kesehatan ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t("payroll.escrow.amountBpjsPen", "BPJS Pensiun")}</span>
          <span className="tabular-nums">{formatToRupiah(amounts?.amount_bpjs_pensiun ?? 0)}</span>
        </div>
        <div className="text-foreground flex justify-between gap-2 border-t border-border/60 pt-1 font-medium">
          <span>{t("payroll.escrow.amountTotal", "Total escrow")}</span>
          <span className="tabular-nums">{formatToRupiah(amounts?.amount_total ?? 0)}</span>
        </div>
      </div>

      {transfer ? (
        <div className="mt-2 border-t border-border/60 pt-2">
          <div className="flex justify-between gap-2">
            <span>{t("payroll.escrow.transferStatus", "Status transfer")}</span>
            <span className="font-medium capitalize">{transfer.status}</span>
          </div>
          {transfer.reference ? (
            <p className="text-muted-foreground mt-1 truncate text-[11px]">{transfer.reference}</p>
          ) : null}
        </div>
      ) : runStatus === "paid" ? (
        <p className="text-muted-foreground mt-2 text-[11px]">
          {t("payroll.escrow.noTransferYet", "Belum ada transfer escrow tercatat untuk run ini.")}
        </p>
      ) : null}
    </div>
  );
}
