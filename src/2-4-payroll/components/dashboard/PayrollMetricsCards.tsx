import type { ReactNode } from "react";
import {
  TrendingUp,
  DollarSign,
  Calculator,
  AlertTriangle,
  Wallet,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { formatGatewaySyncedAtLabel } from "@/shared/utils/formatGatewaySyncedAt";
import { cn } from "@/shared/lib/utils";
import { usePayrollDisbursePreview } from "../../hooks/usePayrollDisbursePreview";
import { usePayrollXenditCashBalance } from "../../hooks/usePayrollXenditCashBalance";
import {
  deltaBadgeClassName,
  formatDeltaPercent,
  formatDeltaSign,
} from "../PayrollDisburseSummaryStrip";

type DisburseMode = {
  organizationId: string;
  runId: string;
};

interface PayrollMetricsCardsProps {
  calculations: Record<string, unknown>[];
  selectedPayrollRunId?: string | null;
  disburseMode?: DisburseMode | null;
}

type MetricCard = {
  title: string;
  value: string | number;
  icon: typeof Calculator;
  color: string;
  bgColor: string;
  borderColor: string;
  subtitle?: ReactNode;
};

export function PayrollMetricsCards({
  calculations,
  selectedPayrollRunId,
  disburseMode = null,
}: PayrollMetricsCardsProps) {
  const { t } = useTranslation();
  const disburseActive = Boolean(disburseMode?.runId && disburseMode?.organizationId);

  const { data: selectedPayrollRun } = useQuery({
    queryKey: ["payroll-run-details", selectedPayrollRunId],
    queryFn: async () => {
      if (!selectedPayrollRunId) return null;

      const { data, error } = await supabase
        .from("payroll_runs")
        .select(
          "id, total_employees, total_gross_pay, total_net_pay, total_deductions, total_penalties, total_taxes",
        )
        .eq("id", selectedPayrollRunId)
        .single();

      if (error) throw error;
      return data as Record<string, unknown>;
    },
    enabled: !!selectedPayrollRunId,
  });

  const { data: preview, isLoading: previewLoading } = usePayrollDisbursePreview(
    disburseMode?.runId ?? null,
    disburseActive,
  );
  const comparison = preview?.period_comparison;
  const summary = preview?.summary;

  const cashBalance = usePayrollXenditCashBalance(disburseMode?.organizationId, disburseActive);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const inSelectedRun = t("payroll.calculations.metrics.inSelectedRun", "Pada run terpilih");
  const allCalculations = t("payroll.calculations.metrics.allCalculations", "Semua kalkulasi");

  const netPayComparisonSubtitle =
    disburseActive && selectedPayrollRun ? (
      <div className="leading-snug">
        {previewLoading ? (
          <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("payroll.xendit.loadingPreview", "Memuat preview…")}
          </div>
        ) : comparison?.available ? (
          <>
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-muted-foreground truncate">{comparison.previous_period_name}</span>
              {comparison.delta_percent != null && (
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded px-1 py-px text-[10px] font-semibold tabular-nums",
                    deltaBadgeClassName(comparison.severity),
                  )}
                >
                  {formatDeltaSign(comparison.delta_percent)}
                  {formatDeltaPercent(comparison.delta_percent)}%
                </span>
              )}
            </div>
            <div className="text-muted-foreground mt-px truncate text-[11px] tabular-nums">
              {t("payroll.xendit.previousPeriodThpShort", "THP periode lalu {{amount}}", {
                amount: formatToRupiah(comparison.previous_total_thp ?? 0),
              })}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground line-clamp-2 text-[11px]">
            {t(
              "payroll.xendit.thpNoPreviousPeriod",
              "Belum ada data payroll periode sebelumnya untuk perbandingan.",
            )}
          </div>
        )}
      </div>
    ) : undefined;

  const insufficientBalance =
    disburseActive &&
    summary &&
    !cashBalance.isSyncing &&
    cashBalance.balance < (summary.total_thp_pending ?? 0);

  const xenditBalanceSubtitle =
    disburseActive &&
    (cashBalance.isSyncing ? (
      <div className="text-muted-foreground flex items-center gap-1 text-[11px] leading-snug">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("payroll.xendit.balanceSyncing", "Memuat saldo CASH terbaru…")}
      </div>
    ) : cashBalance.syncError ? (
      <div className="text-destructive line-clamp-2 text-[11px] leading-snug">
        {t(
          "payroll.xendit.balanceSyncError",
          "Gagal memuat saldo. Coba refresh atau buka halaman Xendit Balance.",
        )}
      </div>
    ) : (
      <div className="leading-snug">
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-1 gap-y-px text-[11px] font-medium",
            insufficientBalance ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {insufficientBalance ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3 w-3 shrink-0" />
          )}
          <span>
            {insufficientBalance
              ? t("payroll.xendit.balanceInsufficientShort", "Saldo CASH tidak mencukupi")
              : t("payroll.xendit.balanceSufficient", "Saldo CASH mencukupi")}
          </span>
          <span className="text-muted-foreground font-normal">
            · {formatGatewaySyncedAtLabel(cashBalance.syncedAt, t)}
          </span>
        </div>
        {cashBalance.selectableCount > 1 && (
          <div className="text-muted-foreground mt-px truncate text-[11px]">
            {t("payroll.xendit.aggregateBalanceHint", "Total semua akun: {{total}}", {
              total: formatToRupiah(cashBalance.aggregateBalance),
            })}
          </div>
        )}
        {cashBalance.escrowEnabled && cashBalance.reservedCash > 0 && (
          <div className="text-muted-foreground mt-px truncate text-[11px]">
            {t("payroll.escrow.reservedCashHint", "Reserved escrow: {{amount}}", {
              amount: formatToRupiah(cashBalance.reservedCash),
            })}
          </div>
        )}
      </div>
    ));

  const metrics: MetricCard[] = selectedPayrollRun
    ? [
        {
          title: t("payroll.calculations.metrics.totalEmployees", "Total Karyawan"),
          value: selectedPayrollRun.total_employees || 0,
          icon: Calculator,
          color: "text-brand-blue",
          bgColor: "bg-brand-blue/10",
          borderColor: "border-brand-blue/30",
          subtitle: disburseActive ? undefined : inSelectedRun,
        },
        {
          title: t("payroll.calculations.metrics.totalGrossPay", "Total Gaji Kotor"),
          value: formatCurrency(Number(selectedPayrollRun.total_gross_pay) || 0),
          icon: TrendingUp,
          color: "text-brand-blue-deep",
          bgColor: "bg-brand-blue-soft",
          borderColor: "border-brand-blue/25",
          subtitle: disburseActive ? undefined : inSelectedRun,
        },
        {
          title: t("payroll.calculations.metrics.totalNetPay", "Total Gaji Bersih"),
          value: formatCurrency(Number(selectedPayrollRun.total_net_pay) || 0),
          icon: DollarSign,
          color: "text-brand-blue-on-soft",
          bgColor: "bg-brand-blue/15",
          borderColor: "border-brand-blue/20",
          subtitle: netPayComparisonSubtitle ?? (disburseActive ? undefined : inSelectedRun),
        },
        {
          title: t("payroll.calculations.metrics.totalDeductions", "Total Potongan"),
          value: formatCurrency(
            (Number(selectedPayrollRun.total_deductions) || 0) +
              (Number(selectedPayrollRun.total_penalties) || 0),
          ),
          icon: AlertTriangle,
          color: "text-red-500",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          subtitle: disburseActive ? undefined : inSelectedRun,
        },
        ...(disburseActive
          ? [
              {
                title: cashBalance.escrowEnabled
                  ? t("payroll.escrow.operationalCashTitle", "CASH Operasional (Utama)")
                  : t("payroll.xendit.balanceCash", "Saldo CASH Xendit"),
                value: cashBalance.isSyncing ? "…" : formatToRupiah(cashBalance.operationalCash),
                icon: Wallet,
                color: insufficientBalance ? "text-destructive" : "text-violet-600 dark:text-violet-400",
                bgColor: insufficientBalance ? "bg-destructive/10" : "bg-violet-500/10",
                borderColor: insufficientBalance ? "border-destructive/20" : "border-violet-500/20",
                subtitle: xenditBalanceSubtitle,
              } satisfies MetricCard,
            ]
          : []),
      ]
    : [
        {
          title: t("payroll.calculations.metrics.totalCalculations", "Total Kalkulasi"),
          value: calculations?.length || 0,
          icon: Calculator,
          color: "text-brand-blue",
          bgColor: "bg-brand-blue/10",
          borderColor: "border-brand-blue/30",
          subtitle: allCalculations,
        },
        {
          title: t("payroll.calculations.metrics.totalGrossPay", "Total Gaji Kotor"),
          value: formatCurrency(
            calculations?.reduce((sum, calc) => sum + (Number(calc.gross_pay) || 0), 0) || 0,
          ),
          icon: TrendingUp,
          color: "text-brand-blue-deep",
          bgColor: "bg-brand-blue-soft",
          borderColor: "border-brand-blue/25",
          subtitle: allCalculations,
        },
        {
          title: t("payroll.calculations.metrics.totalNetPay", "Total Gaji Bersih"),
          value: formatCurrency(
            calculations?.reduce((sum, calc) => sum + (Number(calc.net_pay) || 0), 0) || 0,
          ),
          icon: DollarSign,
          color: "text-brand-blue-on-soft",
          bgColor: "bg-brand-blue/15",
          borderColor: "border-brand-blue/20",
          subtitle: allCalculations,
        },
        {
          title: t("payroll.calculations.metrics.totalDeductions", "Total Potongan"),
          value: formatCurrency(
            calculations?.reduce(
              (sum, calc) =>
                sum + (Number(calc.total_deductions) || 0) + (Number(calc.total_penalties) || 0),
              0,
            ) || 0,
          ),
          icon: AlertTriangle,
          color: "text-red-500",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          subtitle: allCalculations,
        },
      ];

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-1.5 sm:grid-cols-2",
        disburseActive ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className={`${metric.bgColor} ${metric.borderColor} rounded-md border p-4`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{metric.title}</h3>
              <Icon className={`h-5 w-5 shrink-0 ${metric.color}`} />
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-foreground tabular-nums">{metric.value}</div>
              {metric.subtitle ? (
                typeof metric.subtitle === "string" ? (
                  <div className="text-xs text-muted-foreground">{metric.subtitle}</div>
                ) : (
                  <div>{metric.subtitle}</div>
                )
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
