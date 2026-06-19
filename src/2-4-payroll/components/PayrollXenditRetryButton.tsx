import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import { formatToRupiah } from "@/shared/utils/formatCurrency";

type Props = {
  calculationId: string;
  employeeName: string;
  bankName?: string | null;
  accountNumber?: string | null;
  takeHomePay: number;
  onComplete?: () => void;
};

export function PayrollXenditRetryButton({
  calculationId,
  employeeName,
  bankName,
  accountNumber,
  takeHomePay,
  onComplete,
}: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: settings } = useXenditOrgSettings(organizationId);
  const { secureDisbursement } = useSecureXenditActions();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!settings?.account?.is_enabled) return null;

  const primary = settings.primarySubAccount ?? settings.subAccounts?.find((s) => s.is_primary) ?? null;
  if (primary?.status !== "active") return null;

  const handleRetry = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      await secureDisbursement(organizationId, {
        source_type: "payroll_calculation",
        source_id: calculationId,
      });
      toast.success(
        t("payroll.xendit.retryStarted", "Retry disburse dimulai untuk {{name}}", { name: employeeName }),
      );
      setOpen(false);
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        title={t("payroll.xendit.retryTitle", "Retry via Xendit")}
        className="hover:bg-primary/10 hover:text-primary"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("payroll.xendit.retryConfirmTitle", "Retry disburse")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {t(
                    "payroll.xendit.retryConfirmDesc",
                    "Kirim ulang THP ke rekening snapshot untuk karyawan ini.",
                  )}
                </p>
                <ul className="text-foreground list-inside list-disc space-y-1">
                  <li>{employeeName}</li>
                  <li>
                    {bankName ?? "—"} · {accountNumber ?? "—"}
                  </li>
                  <li>{formatToRupiah(takeHomePay)}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{t("common.cancel", "Batal")}</AlertDialogCancel>
            <AlertDialogAction disabled={loading} onClick={() => void handleRetry()}>
              {loading ? t("xendit.processing", "Memproses…") : t("common.confirm", "Konfirmasi")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
