import { useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Eye, Trash2, Calculator, RefreshCw, Loader2 } from "lucide-react";
import { PayrollCalculationsTableFooter } from "./PayrollCalculationsTableFooter";
import { PayrollXenditRetryButton } from "../components/PayrollXenditRetryButton";
import { PayrollDeductionBreakdownDialog } from "../components/PayrollDeductionBreakdownDialog";
import { PayrollAllowanceBreakdownDialog } from "../components/PayrollAllowanceBreakdownDialog";

interface PayrollCalculationsTableProps {
  calculations: Record<string, unknown>[];
  /** Total rows before client-side filters (for footer). */
  totalUnfiltered?: number;
  isLoading: boolean;
  onEmployeeSelect: (employee: Record<string, unknown>) => void;
  onRefresh?: () => void;
  onDeleteCalculation?: (calculation: Record<string, unknown>) => void;
  deletingCalculationId?: string | null;
  onRetryComplete?: () => void;
}

export function PayrollCalculationsTable({
  calculations,
  totalUnfiltered,
  isLoading,
  onEmployeeSelect,
  onRefresh,
  onDeleteCalculation,
  deletingCalculationId,
  onRetryComplete,
}: PayrollCalculationsTableProps) {
  const totalAll = totalUnfiltered ?? calculations.length;

  const paidCalculations = calculations.filter((calc) => calc.payment_status === "paid").length;

  const [deductionDialogCalc, setDeductionDialogCalc] = useState<Record<string, unknown> | null>(
    null,
  );
  const [allowanceDialogCalc, setAllowanceDialogCalc] = useState<Record<string, unknown> | null>(
    null,
  );

  const getCalcDialogMeta = (calc: Record<string, unknown> | null) => {
    if (!calc) {
      return { employeeName: undefined, periodLabel: undefined, calculationId: null };
    }
    const info = calc.employee_payroll_info as { employees?: { full_name?: string } } | undefined;
    const runs = calc.payroll_runs as
      | { payroll_periods?: { period_name?: string }; run_name?: string }
      | undefined;
    return {
      calculationId: String(calc.id),
      employeeName: info?.employees?.full_name,
      periodLabel: runs?.payroll_periods?.period_name || runs?.run_name,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-muted text-foreground";
      case "calculated":
        return "bg-primary/15 text-primary";
      case "approved":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
      case "paid":
        return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
      case "processing":
        return "bg-primary/15 text-primary";
      case "paid":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
      case "failed":
        return "bg-destructive/15 text-destructive";
      default:
        return "bg-muted text-foreground";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(amount || 0);
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[180px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Employee
              </TableHead>
              <TableHead className="min-w-[120px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Department
              </TableHead>
              <TableHead className="min-w-[140px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Period
              </TableHead>
              <TableHead className="min-w-[120px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Basic Salary
              </TableHead>
              <TableHead className="min-w-[110px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Allowances
              </TableHead>
              <TableHead className="min-w-[120px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Gross Pay
              </TableHead>
              <TableHead className="min-w-[110px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Deductions
              </TableHead>
              <TableHead className="min-w-[120px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Net Pay
              </TableHead>
              <TableHead className="min-w-[100px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Status
              </TableHead>
              <TableHead className="min-w-[100px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Payment
              </TableHead>
              <TableHead className="min-w-[80px] whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground py-12 text-center text-sm">
                  Loading payroll calculations...
                </TableCell>
              </TableRow>
            ) : !calculations || calculations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground py-8 text-center text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <Calculator className="text-muted-foreground/50 h-8 w-8" />
                    <div>No payroll calculations found</div>
                    {onRefresh && (
                      <Button
                        onClick={onRefresh}
                        variant="outline"
                        className="mt-1 flex h-8 items-center gap-1.5 px-3 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh Data
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              calculations.map((calc) => {
                const id = calc.id as string;
                const info = calc.employee_payroll_info as
                  | {
                      employees?: {
                        full_name?: string;
                        employee_id?: string;
                        departments?: { name?: string };
                      };
                    }
                  | undefined;
                const runs = calc.payroll_runs as
                  | {
                      run_name?: string;
                      payroll_periods?: { period_name?: string };
                      status?: string;
                    }
                  | undefined;
                const snapshot = calc.payout_snapshot as
                  | { bank_name?: string; account_number?: string; account_holder?: string }
                  | null
                  | undefined;
                const paymentStatus = (calc.payment_status as string) || "pending";
                const allowanceTotal = Number(calc.total_allowances) || 0;
                const deductionTotal = Number(calc.total_deductions) || 0;
                return (
                  <TableRow key={id} className="hover:bg-muted/30 h-12 transition-colors">
                    <TableCell className="min-w-[180px] px-3">
                      <div>
                        <button
                          type="button"
                          className="text-foreground cursor-pointer text-sm font-medium hover:text-primary"
                          onClick={() => onEmployeeSelect(calc)}
                        >
                          {info?.employees?.full_name || "Unknown Employee"}
                        </button>
                        <div className="text-muted-foreground text-xs">
                          {info?.employees?.employee_id || "No ID"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground min-w-[120px] px-3 text-sm">
                      {info?.employees?.departments?.name || "No Department"}
                    </TableCell>
                    <TableCell className="min-w-[140px] px-3">
                      <div>
                        <div className="text-foreground text-sm font-medium">
                          {runs?.payroll_periods?.period_name || "Unknown Period"}
                        </div>
                        <div className="text-muted-foreground text-xs">{runs?.run_name || "Unknown Run"}</div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[120px] px-3 text-sm">
                      {formatCurrency(Number(calc.basic_salary) || 0)}
                    </TableCell>
                    <TableCell className="min-w-[110px] px-3 text-sm">
                      {allowanceTotal > 0 ? (
                        <button
                          type="button"
                          className="cursor-pointer font-medium tabular-nums text-emerald-600 underline decoration-dotted decoration-emerald-600/70 underline-offset-[3px] transition-colors hover:decoration-solid hover:text-emerald-700 dark:text-emerald-400 dark:decoration-emerald-400/70 dark:hover:text-emerald-300"
                          title="Lihat rincian tunjangan"
                          onClick={() => setAllowanceDialogCalc(calc)}
                        >
                          {formatCurrency(allowanceTotal)}
                          <span className="sr-only">Lihat rincian tunjangan</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground tabular-nums">{formatCurrency(0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[120px] px-3 text-sm font-medium">
                      {formatCurrency(Number(calc.gross_pay) || 0)}
                    </TableCell>
                    <TableCell className="min-w-[110px] px-3 text-sm">
                      {deductionTotal > 0 ? (
                        <button
                          type="button"
                          className="text-destructive cursor-pointer font-medium tabular-nums underline decoration-dotted decoration-destructive/70 underline-offset-[3px] transition-colors hover:decoration-solid hover:text-destructive/90"
                          title="Lihat rincian potongan"
                          onClick={() => setDeductionDialogCalc(calc)}
                        >
                          {formatCurrency(deductionTotal)}
                          <span className="sr-only">Lihat rincian potongan</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground tabular-nums">{formatCurrency(0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[120px] px-3 text-sm font-medium">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(Number(calc.take_home_pay ?? calc.net_pay) || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3">
                      <Badge className={`${getStatusColor((calc.calculation_status as string) || "draft")} border`}>
                        {(calc.calculation_status as string) || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3">
                      <Badge className={`${getPaymentStatusColor((calc.payment_status as string) || "pending")} border`}>
                        {(calc.payment_status as string) || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[80px] px-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEmployeeSelect(calc)}
                          title="View Payroll Details"
                          className="hover:bg-primary/10 hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {paymentStatus === "failed" && runs?.status === "calculated" && (
                          <PayrollXenditRetryButton
                            calculationId={id}
                            employeeName={info?.employees?.full_name ?? "Employee"}
                            bankName={snapshot?.bank_name}
                            accountNumber={snapshot?.account_number}
                            takeHomePay={Number(calc.take_home_pay ?? calc.net_pay) || 0}
                            onComplete={onRetryComplete}
                          />
                        )}
                        {onDeleteCalculation && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteCalculation(calc)}
                            title="Delete Payroll Calculation"
                            disabled={deletingCalculationId === id}
                            className="hover:bg-destructive/10 hover:text-destructive disabled:opacity-80"
                          >
                            {deletingCalculationId === id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>

      <PayrollCalculationsTableFooter
        totalCalculations={totalAll}
        filteredCalculations={calculations.length}
        paidCalculations={paidCalculations}
      />

      <PayrollAllowanceBreakdownDialog
        open={allowanceDialogCalc != null}
        onOpenChange={(next) => {
          if (!next) setAllowanceDialogCalc(null);
        }}
        {...getCalcDialogMeta(allowanceDialogCalc)}
        totalAllowances={
          allowanceDialogCalc ? Number(allowanceDialogCalc.total_allowances) || 0 : 0
        }
      />

      <PayrollDeductionBreakdownDialog
        open={deductionDialogCalc != null}
        onOpenChange={(next) => {
          if (!next) setDeductionDialogCalc(null);
        }}
        {...getCalcDialogMeta(deductionDialogCalc)}
        grossPay={deductionDialogCalc ? Number(deductionDialogCalc.gross_pay) || 0 : 0}
        takeHomePay={
          deductionDialogCalc
            ? Number(deductionDialogCalc.take_home_pay ?? deductionDialogCalc.net_pay) || 0
            : 0
        }
        totalDeductions={deductionDialogCalc ? Number(deductionDialogCalc.total_deductions) || 0 : 0}
        totalTaxDeductions={
          deductionDialogCalc ? Number(deductionDialogCalc.total_tax_deductions) || 0 : 0
        }
        totalPenalties={deductionDialogCalc ? Number(deductionDialogCalc.total_penalties) || 0 : 0}
      />
    </div>
  );
}
