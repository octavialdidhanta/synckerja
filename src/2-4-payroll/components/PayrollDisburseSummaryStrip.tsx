import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { formatGatewaySyncedAtLabel } from "@/shared/utils/formatGatewaySyncedAt";
import { cn } from "@/shared/lib/utils";
import type {
  PayrollDisbursePeriodComparison,
  PayrollDisbursePeriodSeverity,
  PayrollDisbursePreviewSummary,
} from "../hooks/usePayrollDisbursePreview";

export function formatDeltaSign(value: number | null | undefined): string {
  if (value == null || value === 0) return "";
  return value > 0 ? "+" : "−";
}

export function formatDeltaPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return Math.abs(value).toFixed(2);
}

export function deltaBadgeClassName(severity: PayrollDisbursePeriodSeverity): string {
  switch (severity) {
    case "significant_increase":
    case "significant_decrease":
      return "bg-destructive/10 text-destructive";
    case "moderate":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-200";
    case "stable":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

type ComparisonAlertProps = {
  comparison?: PayrollDisbursePeriodComparison;
  isLoading?: boolean;
};

export function DisburseComparisonAlert({ comparison, isLoading = false }: ComparisonAlertProps) {
  const { t } = useTranslation();

  if (isLoading || !comparison?.available) return null;

  const severity = comparison.severity;
  if (severity === "stable" || severity === "unavailable") return null;

  const alertVariant =
    severity === "significant_increase" || severity === "significant_decrease"
      ? "destructive"
      : "default";

  const messageKey =
    severity === "significant_increase"
      ? "payroll.xendit.thpSignificantIncrease"
      : severity === "significant_decrease"
        ? "payroll.xendit.thpSignificantDecrease"
        : "payroll.xendit.thpModerate";

  const messageFallback =
    severity === "significant_increase"
      ? "Kenaikan THP signifikan terdeteksi. Pastikan komponen gaji, karyawan baru, dan potongan sudah benar sebelum melanjutkan."
      : severity === "significant_decrease"
        ? "Penurunan THP signifikan terdeteksi. Pastikan tidak ada kesalahan kalkulasi atau potongan sebelum melanjutkan."
        : "Perubahan THP moderat. Pastikan komponen gaji sudah sesuai.";

  return (
    <Alert
      variant={alertVariant}
      className={cn(
        severity === "moderate" &&
          "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
      )}
    >
      {severity === "significant_increase" ? (
        <TrendingUp className="h-4 w-4" />
      ) : severity === "significant_decrease" ? (
        <TrendingDown className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4" />
      )}
      <AlertDescription className="text-xs sm:text-sm">{t(messageKey, messageFallback)}</AlertDescription>
    </Alert>
  );
}

type SummaryStripProps = {
  summary?: PayrollDisbursePreviewSummary;
  comparison?: PayrollDisbursePeriodComparison;
  xenditUsableBalance: number;
  aggregateBalance?: number;
  showAggregateHint?: boolean;
  balanceSyncing?: boolean;
  balanceSyncedAt?: string | null;
  balanceSyncError?: string | null;
  insufficientBalance: boolean;
  isLoading?: boolean;
};

export function PayrollDisburseSummaryStrip({
  summary,
  comparison,
  xenditUsableBalance,
  aggregateBalance = 0,
  showAggregateHint = false,
  balanceSyncing = false,
  balanceSyncedAt = null,
  balanceSyncError = null,
  insufficientBalance,
  isLoading = false,
}: SummaryStripProps) {
  const { t } = useTranslation();

  const showHeadcountHint =
    comparison?.available &&
    comparison.previous_employee_count != null &&
    comparison.current_employee_count != null &&
    comparison.previous_employee_count !== comparison.current_employee_count;

  return (
    <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">
            {t("payroll.xendit.disburseBatchAmount", "Jumlah disburse")}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
            {isLoading ? "…" : formatToRupiah(summary?.total_thp_pending ?? 0)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("payroll.xendit.readyEmployeeCount", "{{count}} karyawan siap disburse", {
              count: summary?.count_pending ?? 0,
            })}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center py-1 sm:py-0">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          </div>
        ) : comparison?.available ? (
          <div className="sm:text-right">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <p className="text-muted-foreground text-xs">
                {t("payroll.xendit.vsPreviousPeriod", "vs periode sebelumnya")}
              </p>
              {comparison.delta_percent != null && (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    deltaBadgeClassName(comparison.severity),
                  )}
                >
                  {formatDeltaSign(comparison.delta_percent)}
                  {formatDeltaPercent(comparison.delta_percent)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium">{comparison.previous_period_name}</p>
            <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
              {t("payroll.xendit.previousPeriodThpShort", "THP periode lalu {{amount}}", {
                amount: formatToRupiah(comparison.previous_total_thp ?? 0),
              })}
            </p>
            {comparison.delta_amount != null && comparison.delta_amount !== 0 && (
              <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                {t("payroll.xendit.deltaFromPrevious", "{{sign}}{{amount}} dari periode lalu", {
                  sign: formatDeltaSign(comparison.delta_percent),
                  amount: formatToRupiah(Math.abs(comparison.delta_amount)),
                })}
              </p>
            )}
            {showHeadcountHint ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {t("payroll.xendit.headcountChangeHint", "Jumlah karyawan berubah: {{previous}} → {{current}}", {
                  previous: comparison.previous_employee_count,
                  current: comparison.current_employee_count,
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground max-w-xs text-xs sm:text-right">
            {t(
              "payroll.xendit.thpNoPreviousPeriod",
              "Belum ada data payroll periode sebelumnya untuk perbandingan.",
            )}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-3 text-xs">
        <span className="text-muted-foreground">
          {t("payroll.xendit.balanceCash", "Saldo CASH Xendit")}:
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            insufficientBalance && !balanceSyncing && "text-destructive",
          )}
        >
          {balanceSyncing ? "…" : formatToRupiah(xenditUsableBalance)}
        </span>

        {!balanceSyncing && !balanceSyncError && !isLoading && (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              insufficientBalance ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {insufficientBalance ? (
              <>
                <AlertTriangle className="h-3 w-3" />
                {t("payroll.xendit.balanceInsufficientShort", "Saldo CASH tidak mencukupi")}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" />
                {t("payroll.xendit.balanceSufficient", "Saldo CASH mencukupi")}
              </>
            )}
          </span>
        )}

        {balanceSyncError ? (
          <span className="text-destructive">
            {t(
              "payroll.xendit.balanceSyncError",
              "Gagal memuat saldo. Coba refresh atau buka halaman Xendit Balance.",
            )}
          </span>
        ) : balanceSyncing ? (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("payroll.xendit.balanceSyncing", "Memuat saldo CASH terbaru…")}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {formatGatewaySyncedAtLabel(balanceSyncedAt, t)}
          </span>
        )}

        {showAggregateHint ? (
          <span className="text-muted-foreground">
            {t("payroll.xendit.aggregateBalanceHint", "Total semua akun: {{total}}", {
              total: formatToRupiah(aggregateBalance),
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
