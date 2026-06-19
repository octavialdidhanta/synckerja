import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Send, Shield, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { cn } from "@/shared/lib/utils";
import { MfaOtpInput } from "@/shared/auth/mfa/MfaOtpInput";
import { useMfaChallenge } from "@/shared/auth/mfa/useMfaChallenge";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  usePayrollDisbursePreview,
  type PayrollDisbursePreviewIssue,
} from "../hooks/usePayrollDisbursePreview";
import { DisburseComparisonAlert } from "./PayrollDisburseSummaryStrip";

type Step = "preview" | "verify";

type Props = {
  active: boolean;
  onCancel: () => void;
  runId: string;
  xenditUsableBalance: number;
  aggregateBalance?: number;
  selectableCount?: number;
  balanceSyncing?: boolean;
  balanceSyncedAt?: string | null;
  balanceSyncError?: string | null;
  onConfirm: () => void | Promise<void>;
  confirming?: boolean;
  fillHeight?: boolean;
};

function issueLabel(t: (key: string, fallback: string) => string, issue: PayrollDisbursePreviewIssue): string {
  switch (issue) {
    case "missing_bank":
      return t("payroll.xendit.issueMissingBank", "Rekening tidak lengkap");
    case "invalid_amount":
      return t("payroll.xendit.issueInvalidAmount", "THP tidak valid");
    case "already_processing":
      return t("payroll.xendit.issueProcessing", "Sedang diproses");
    case "failed_previous":
      return t("payroll.xendit.issueFailed", "Gagal sebelumnya");
    case "already_paid":
      return t("payroll.xendit.issuePaid", "Sudah dibayar");
    case "snapshot_drift":
      return t("payroll.xendit.issueDrift", "Rekening berubah setelah kalkulasi");
    case "unknown_bank":
      return t("payroll.xendit.issueUnknownBank", "Bank tidak dikenali");
    default:
      return issue;
  }
}

async function logMfaStepUp() {
  try {
    await supabase.rpc("log_auth_security_event", {
      p_event: "mfa_step_up",
      p_metadata: {},
    });
  } catch {
    /* non-blocking */
  }
}

export function PayrollXenditDisbursePanel({
  active,
  onCancel,
  runId,
  xenditUsableBalance,
  aggregateBalance: _aggregateBalance = 0,
  selectableCount: _selectableCount = 0,
  balanceSyncing = false,
  balanceSyncedAt: _balanceSyncedAt = null,
  balanceSyncError = null,
  onConfirm,
  confirming = false,
  fillHeight = false,
}: Props) {
  const { t } = useTranslation();
  const { data: preview, isLoading, isError, error } = usePayrollDisbursePreview(runId, active);
  const { verifying, error: mfaError, verifyTotpCode, clearError } = useMfaChallenge();
  const [step, setStep] = useState<Step>("preview");
  const [resetTrigger, setResetTrigger] = useState(0);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);

  useEffect(() => {
    if (!active) {
      setStep("preview");
      setResetTrigger(0);
      setReviewAcknowledged(false);
      clearError();
    }
  }, [active, clearError]);

  useEffect(() => {
    setReviewAcknowledged(false);
  }, [runId, preview?.period_comparison?.delta_percent]);

  const summary = preview?.summary;
  const comparison = preview?.period_comparison;
  const insufficientBalance = useMemo(() => {
    if (!summary || balanceSyncing) return false;
    return xenditUsableBalance < summary.total_thp_pending;
  }, [summary, xenditUsableBalance, balanceSyncing]);

  const canContinuePreview =
    Boolean(summary?.count_pending) &&
    !insufficientBalance &&
    !balanceSyncing &&
    !balanceSyncError &&
    !confirming &&
    !isLoading &&
    !isError &&
    (!comparison?.requires_review_ack || reviewAcknowledged);

  const employees = preview?.employees ?? [];
  const runLabel = preview?.run_name?.trim();

  const handleCancel = () => {
    if (confirming || verifying) return;
    setStep("preview");
    setReviewAcknowledged(false);
    clearError();
    onCancel();
  };

  const handleContinue = async () => {
    if (!canContinuePreview) return;
    setStep("verify");
  };

  const handleOtpComplete = async (code: string) => {
    const ok = await verifyTotpCode(code);
    if (!ok) {
      setResetTrigger((n) => n + 1);
      return;
    }
    await logMfaStepUp();
    await onConfirm();
  };

  if (!active) return null;

  return (
    <div className={cn("w-full min-w-0", fillHeight && "flex min-h-0 flex-1 flex-col")}>
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          fillHeight ? "min-h-0 flex-1" : "max-h-[min(70vh,560px)]",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {step === "verify" ? <Shield className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight sm:text-base">
                {step === "verify"
                  ? t("payroll.xendit.mfaStepTitle", "Verifikasi 2FA untuk disburse")
                  : t("payroll.xendit.previewTitle", "Konfirmasi disburse payroll")}
              </h3>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                {step === "verify"
                  ? t(
                      "payroll.xendit.mfaStepDesc",
                      "Masukkan kode autentikator untuk mengonfirmasi pelepasan dana payroll.",
                    )
                  : runLabel
                    ? t(
                        "payroll.xendit.previewDescWithRun",
                        "{{runName}} — transfer THP ke rekening snapshot. Baris merah tidak ikut disburse.",
                        { runName: runLabel },
                      )
                    : t(
                        "payroll.xendit.previewDesc",
                        "Transfer THP ke rekening pada snapshot kalkulasi. Baris merah tidak ikut disburse.",
                      )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={confirming || verifying}
            onClick={handleCancel}
            aria-label={t("common.close", "Tutup")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {step === "preview" ? (
          <>
            {(comparison?.requires_review_ack ||
              (comparison?.available &&
                comparison.severity !== "stable" &&
                comparison.severity !== "unavailable")) && (
              <div className="shrink-0 space-y-2 border-b border-border px-4 py-2.5">
                <DisburseComparisonAlert comparison={comparison} isLoading={isLoading} />

                {comparison?.requires_review_ack && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <Checkbox
                      checked={reviewAcknowledged}
                      onCheckedChange={(checked) => setReviewAcknowledged(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="text-xs leading-relaxed sm:text-sm">
                      {t(
                        "payroll.xendit.reviewAckLabel",
                        "Saya sudah meninjau kenaikan/penurunan THP vs periode sebelumnya",
                      )}
                    </span>
                  </label>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {isLoading ? (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("payroll.xendit.loadingPreview", "Memuat preview…")}
                </div>
              ) : isError ? (
                <div className="text-destructive py-8 text-center text-sm">
                  {error instanceof Error ? error.message : String(error)}
                </div>
              ) : (
                <div
                  className={cn(
                    "scrollbar-hide overflow-x-auto overflow-y-auto",
                    fillHeight ? "min-h-[280px] flex-1" : "max-h-[min(50vh,400px)]",
                  )}
                >
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="min-w-[140px]">{t("payroll.xendit.colEmployee", "Karyawan")}</TableHead>
                        <TableHead className="min-w-[100px]">{t("payroll.xendit.colBank", "Bank")}</TableHead>
                        <TableHead className="min-w-[120px]">{t("payroll.xendit.colAccount", "No. rekening")}</TableHead>
                        <TableHead className="min-w-[100px] text-right">{t("payroll.xendit.colThp", "THP")}</TableHead>
                        <TableHead className="min-w-[120px]">{t("payroll.xendit.colStatus", "Status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                            {t("payroll.xendit.noEmployees", "Tidak ada karyawan pada run ini.")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        employees.map((row) => {
                          const invalid = !row.eligible && row.payment_status === "pending";
                          const rowIssues = row.issues.filter((i) => i !== "snapshot_drift" || invalid);
                          return (
                            <TableRow
                              key={row.calculation_id}
                              className={cn(invalid && "bg-destructive/5")}
                            >
                              <TableCell>
                                <div className="font-medium">{row.employee_name ?? "—"}</div>
                                <div className="text-muted-foreground text-xs">{row.employee_code ?? "—"}</div>
                              </TableCell>
                              <TableCell className="text-xs">{row.bank_name ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{row.account_number ?? "—"}</TableCell>
                              <TableCell className="text-right text-xs font-medium">
                                {formatToRupiah(row.take_home_pay)}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div>{row.payment_status}</div>
                                {rowIssues.length > 0 && (
                                  <div className="text-destructive mt-0.5 space-y-0.5">
                                    {rowIssues.map((issue) => (
                                      <div key={issue}>{issueLabel(t, issue)}</div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground hidden text-sm sm:block">
                {t("payroll.xendit.footerSummary", "{{count}} karyawan · Total {{total}}", {
                  count: summary?.count_pending ?? 0,
                  total: formatToRupiah(summary?.total_thp_pending ?? 0),
                })}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={confirming} onClick={handleCancel}>
                  {t("common.cancel", "Batal")}
                </Button>
                <Button type="button" size="sm" className="shrink-0" disabled={!canContinuePreview} onClick={() => void handleContinue()}>
                  {confirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("xendit.processing", "Memproses…")}
                    </>
                  ) : (
                    t("payroll.xendit.confirmDisburse", "Konfirmasi & lanjut 2FA")
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                {t("settings.security.twoFactor.otpLegend", "Kode autentikator")}
              </div>
              {mfaError ? (
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription>{mfaError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="relative py-2">
                {verifying || confirming ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : null}
                <MfaOtpInput
                  disabled={verifying || confirming}
                  resetTrigger={resetTrigger}
                  legend={t("settings.security.twoFactor.otpLegend")}
                  onComplete={handleOtpComplete}
                />
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-muted/10 px-4 py-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={verifying || confirming}
                onClick={() => {
                  clearError();
                  setReviewAcknowledged(false);
                  setStep("preview");
                }}
              >
                {t("common.back", "Kembali")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={verifying || confirming}
                onClick={handleCancel}
              >
                {t("common.cancel", "Batal")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
