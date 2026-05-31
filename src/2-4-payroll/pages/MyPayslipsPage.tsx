import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatCurrency } from "@/shared/lib/pph21Calculator";
import { useMyPayslips } from "../hooks/useMyPayslips";
import { PayslipPDFGenerator } from "../lib/PayslipPDFGenerator";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { toast } from "sonner";

export default function MyPayslipsPage() {
  const { organization } = useCentralizedUserData();
  const { payslips, loading } = useMyPayslips();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (calcId: string) => {
    setDownloadingId(calcId);
    try {
      const { data: calc, error: calcError } = await supabase
        .from("employee_payroll_calculations")
        .select(
          `
          id, basic_salary, take_home_pay, gross_pay, payout_snapshot, calculation_details,
          employee_payroll_info(npwp, ptkp_status, employees(full_name, employee_id)),
          payroll_runs(run_name, payroll_periods(period_name, pay_date))
        `,
        )
        .eq("id", calcId)
        .single();

      if (calcError) throw calcError;

      const { data: items, error: itemsError } = await supabase
        .from("payroll_items")
        .select("item_name, item_type, item_category, calculated_amount")
        .eq("payroll_calculation_id", calcId);

      if (itemsError) throw itemsError;

      const info = calc.employee_payroll_info as {
        npwp?: string;
        ptkp_status?: string;
        employees?: { full_name?: string; employee_id?: string };
      } | null;

      const run = calc.payroll_runs as {
        run_name?: string;
        payroll_periods?: { period_name?: string; pay_date?: string };
      } | null;

      const generator = await PayslipPDFGenerator.create();
      await generator.download(
        {
          companyName: organization?.company_name ?? "Perusahaan",
          employeeName: info?.employees?.full_name ?? "-",
          employeeCode: info?.employees?.employee_id ?? null,
          npwp: info?.npwp ?? null,
          ptkpStatus: info?.ptkp_status ?? null,
          periodName: run?.payroll_periods?.period_name ?? run?.run_name ?? "-",
          payDate: run?.payroll_periods?.pay_date ?? null,
          basicSalary: Number(calc.basic_salary),
          takeHomePay: Number(calc.take_home_pay),
          grossPay: Number(calc.gross_pay),
          calculationMode: (calc.calculation_details as { calculationMode?: string })?.calculationMode,
          lineItems: (items ?? []).map((i) => ({
            item_name: i.item_name,
            item_type: i.item_type,
            item_category: i.item_category ?? undefined,
            calculated_amount: Number(i.calculated_amount),
          })),
          payoutSnapshot: (calc.payout_snapshot as {
            bank_name?: string;
            account_number?: string;
            account_holder?: string;
          } | null) ?? null,
        },
        `slip-gaji-${calcId.slice(0, 8)}.pdf`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal unduh slip gaji");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Slip Gaji Saya</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Hanya menampilkan slip gaji dengan status sudah dibayar.
      </p>

      {payslips.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Belum ada slip gaji tersedia.
          </CardContent>
        </Card>
      ) : (
        payslips.map((slip) => (
          <Card key={slip.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {slip.payroll_runs?.payroll_periods?.period_name ??
                  slip.payroll_runs?.run_name ??
                  "Payroll"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-primary text-lg font-semibold">
                  {formatCurrency(slip.take_home_pay)}
                </div>
                <div className="text-muted-foreground text-xs">
                  Bruto {formatCurrency(slip.gross_pay)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={downloadingId === slip.id}
                onClick={() => void handleDownload(slip.id)}
              >
                {downloadingId === slip.id ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                PDF
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
