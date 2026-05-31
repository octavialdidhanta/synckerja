import { useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "sonner";
import {
  buildPayrollBankCsv,
  downloadPayrollBankCsv,
  type PayrollBankExportRow,
} from "../lib/payrollBankExport";
import { MarkPayrollRunPaidDialog } from "../modals/MarkPayrollRunPaidDialog";

interface PayrollRunActionsProps {
  runId: string | null;
  runName?: string;
  runStatus?: string;
  onActionComplete?: () => void;
}

export function PayrollRunActions({
  runId,
  runName,
  runStatus,
  onActionComplete,
}: PayrollRunActionsProps) {
  const [exporting, setExporting] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  const handleExportCsv = async () => {
    if (!runId) {
      toast.error("Pilih payroll run terlebih dahulu");
      return;
    }
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("employee_payroll_calculations")
        .select(
          `
          id, take_home_pay, payment_reference, payment_status,
          payout_snapshot,
          employee_payroll_info(
            bank_name, bank_account_number, bank_account_holder,
            employees(full_name, employee_id)
          ),
          payroll_runs(payroll_periods(pay_date))
        `,
        )
        .eq("payroll_run_id", runId)
        .neq("payment_status", "failed");

      if (error) throw error;

      const rows: PayrollBankExportRow[] = (data ?? []).map((row) => {
        const info = row.employee_payroll_info as {
          bank_name?: string;
          bank_account_number?: string;
          bank_account_holder?: string;
          employees?: { full_name?: string; employee_id?: string };
        } | null;
        const snapshot = row.payout_snapshot as Record<string, string> | null;
        const run = row.payroll_runs as { payroll_periods?: { pay_date?: string } } | null;
        return {
          employeeCode: info?.employees?.employee_id ?? "-",
          employeeName: info?.employees?.full_name ?? "-",
          bankName: snapshot?.bank_name ?? info?.bank_name ?? "-",
          accountNumber: snapshot?.account_number ?? info?.bank_account_number ?? "-",
          accountHolder: snapshot?.account_holder ?? info?.bank_account_holder ?? "-",
          amount: Number(row.take_home_pay),
          paymentReference: row.payment_reference ?? "",
          payDate: run?.payroll_periods?.pay_date ?? "",
        };
      });

      if (rows.length === 0) {
        toast.warning("Tidak ada data untuk diexport");
        return;
      }

      const csv = buildPayrollBankCsv(rows);
      downloadPayrollBankCsv(`payroll-bank-${runId.slice(0, 8)}.csv`, csv);

      await supabase.rpc("log_payroll_bank_export", {
        p_run_id: runId,
        p_row_count: rows.length,
      });

      toast.success(`Exported ${rows.length} baris ke CSV`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export gagal");
    } finally {
      setExporting(false);
    }
  };

  if (!runId) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={exporting}
          onClick={() => void handleExportCsv()}
        >
          <Download className="mr-1 h-4 w-4" />
          Export Bank CSV
        </Button>
        {runStatus === "calculated" && (
          <Button size="sm" variant="default" onClick={() => setMarkPaidOpen(true)}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Mark as Paid
          </Button>
        )}
      </div>
      <MarkPayrollRunPaidDialog
        runId={runId}
        runName={runName}
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        onSuccess={onActionComplete}
      />
    </>
  );
}
