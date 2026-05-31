import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ArrowLeft, Calculator, Download, Loader2 } from "lucide-react";
import { calculatePPh21, formatCurrency, type TaxBreakdownRow } from "@/shared/lib/pph21Calculator";
import { PayslipPDFGenerator } from "../lib/PayslipPDFGenerator";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { toast } from "sonner";

interface LineItem {
  component_name?: string;
  item_name?: string;
  item_category?: string;
  calculated_amount?: number;
  [key: string]: unknown;
}

interface EmployeeDetailViewProps {
  selectedEmployee: Record<string, unknown>;
  onBack: () => void;
  allowanceData?: LineItem[];
  deductionData?: LineItem[];
  taxData?: LineItem[];
}

function lineLabel(item: LineItem) {
  return (item.component_name || item.item_name || "").toString();
}

function isBpjsItem(item: LineItem) {
  const cat = (item.item_category || "").toString().toLowerCase();
  const name = lineLabel(item).toLowerCase();
  return cat.startsWith("bpjs") || name.includes("bpjs");
}

function isPenaltyItem(item: LineItem) {
  return (item.item_category || "").toString().toLowerCase() === "penalty";
}

export function EmployeeDetailView({
  selectedEmployee,
  onBack,
  allowanceData = [],
  deductionData = [],
  taxData = [],
}: EmployeeDetailViewProps) {
  const { organization } = useCentralizedUserData();
  const [downloading, setDownloading] = useState(false);

  if (!selectedEmployee) return null;

  const hasStoredTotals =
    selectedEmployee.take_home_pay != null || selectedEmployee.net_pay != null;

  const storedBasic = Number(selectedEmployee.basic_salary) || 0;
  const storedAllowances = Number(selectedEmployee.total_allowances) || 0;
  const storedGross = Number(selectedEmployee.gross_pay) || storedBasic + storedAllowances;
  const storedDeductions = Number(selectedEmployee.total_deductions) || 0;
  const storedPenalties = Number(selectedEmployee.total_penalties) || 0;
  const storedTax =
    Number(selectedEmployee.total_tax_deductions) ||
    taxData.reduce((s, i) => s + (Number(i.calculated_amount) || 0), 0);
  const takeHomePay =
    Number(selectedEmployee.take_home_pay ?? selectedEmployee.net_pay) ||
    storedGross - storedDeductions - storedPenalties - storedTax;

  const bpjsFromItems = deductionData.filter(isBpjsItem);
  const bpjsKesehatanMonthly =
    Number(bpjsFromItems.find((i) => lineLabel(i).toLowerCase().includes("kesehatan"))?.calculated_amount) ||
    0;
  const bpjsPensiunMonthly =
    Number(bpjsFromItems.find((i) => lineLabel(i).toLowerCase().includes("pensiun"))?.calculated_amount) ||
    0;

  const penaltyFromItems = deductionData
    .filter(isPenaltyItem)
    .reduce((sum, item) => sum + (Number(item.calculated_amount) || 0), 0);

  const totalPenaltiesDisplay = storedPenalties || penaltyFromItems;

  const info = selectedEmployee.employee_payroll_info as Record<string, unknown> | undefined;
  const ptkpStatus = (info?.ptkp_status as string) || "TK/0";

  const storedTaxBreakdown = selectedEmployee.tax_breakdown as TaxBreakdownRow[] | null | undefined;
  const isEstimate = !hasStoredTotals || (allowanceData.length === 0 && deductionData.length === 0);

  const pph21Estimate =
    isEstimate && !storedTaxBreakdown?.length
      ? calculatePPh21({
          monthlyGross: storedGross,
          ptkpStatus,
          includeBpjsKesehatan: bpjsFromItems.length === 0,
          includeBpjsPensiun: bpjsFromItems.length === 0,
        })
      : null;

  const taxBreakdown = storedTaxBreakdown?.length ? storedTaxBreakdown : pph21Estimate?.taxBreakdown ?? [];
  const monthlyTaxDisplay = storedTax || pph21Estimate?.monthlyTax || 0;
  const pph21Detail = pph21Estimate;

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

  const runs = selectedEmployee.payroll_runs as
    | { payroll_periods?: { period_name?: string; pay_date?: string } }
    | undefined;
  const empInfo = selectedEmployee.employee_payroll_info as
    | { employees?: { full_name?: string; employee_id?: string; departments?: { name?: string } } }
    | undefined;

  const calculationMode = (selectedEmployee.calculation_details as { calculationMode?: string })
    ?.calculationMode;

  const handleDownloadPayslip = async () => {
    const calcId = String(selectedEmployee.id ?? "");
    if (!calcId) return;
    setDownloading(true);
    try {
      const allItems = [...allowanceData, ...deductionData, ...taxData];
      const generator = await PayslipPDFGenerator.create();
      await generator.download(
        {
          companyName: organization?.company_name ?? "Perusahaan",
          employeeName: empInfo?.employees?.full_name ?? "-",
          employeeCode: empInfo?.employees?.employee_id ?? null,
          periodName: runs?.payroll_periods?.period_name ?? "-",
          payDate: runs?.payroll_periods?.pay_date ?? null,
          basicSalary: storedBasic,
          takeHomePay: storedTakeHome,
          grossPay: storedGross,
          calculationMode: calculationMode ?? null,
          lineItems: allItems.map((item) => ({
            item_name: lineLabel(item),
            item_type: (item.item_type as string) ?? "deduction",
            item_category: item.item_category as string | undefined,
            calculated_amount: Number(item.calculated_amount) || 0,
          })),
          payoutSnapshot:
            (selectedEmployee.payout_snapshot as {
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
      setDownloading(false);
    }
  };

  return (
    <div className="bg-background h-full">
      <div className="bg-muted/30 border-border sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-foreground text-xl font-semibold">{empInfo?.employees?.full_name}</h2>
            <p className="text-muted-foreground text-sm">{empInfo?.employees?.employee_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedEmployee.payment_status === "paid" && (
            <Button
              size="sm"
              variant="outline"
              disabled={downloading}
              onClick={() => void handleDownloadPayslip()}
            >
              {downloading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              Slip PDF
            </Button>
          )}
          {isEstimate && (
            <Badge variant="outline" className="text-amber-700 dark:text-amber-300">
              Estimasi
            </Badge>
          )}
          <Badge className={getStatusColor(String(selectedEmployee.calculation_status || "draft"))}>
            {String(selectedEmployee.calculation_status || "draft")}
          </Badge>
          <Badge className={getPaymentStatusColor(String(selectedEmployee.payment_status || "pending"))}>
            {String(selectedEmployee.payment_status || "pending")}
          </Badge>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Periode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-muted-foreground text-sm font-medium">Periode Payroll</label>
                <p className="text-foreground text-sm font-semibold">
                  {runs?.payroll_periods?.period_name || "-"}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium">Tanggal Pembayaran</label>
                <p className="text-foreground text-sm font-semibold">
                  {runs?.payroll_periods?.pay_date
                    ? new Date(runs.payroll_periods.pay_date).toLocaleDateString("id-ID")
                    : "-"}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium">Tanggal Perhitungan</label>
                <p className="text-foreground text-sm font-semibold">
                  {selectedEmployee.calculation_date
                    ? new Date(String(selectedEmployee.calculation_date)).toLocaleDateString("id-ID")
                    : "-"}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium">Departemen</label>
                <p className="text-foreground text-sm font-semibold">
                  {empInfo?.employees?.departments?.name || "No Department"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Gaji Pokok</div>
              <div className="text-primary text-lg font-bold">{formatCurrency(storedBasic)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Tunjangan</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(storedAllowances)}
              </div>
              {allowanceData.length > 0 && (
                <div className="mt-2 space-y-1">
                  {allowanceData.map((item, index) => (
                    <div key={index} className="text-muted-foreground flex justify-between text-xs">
                      <span>{lineLabel(item)}</span>
                      <span>{formatCurrency(Number(item.calculated_amount) || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Potongan</div>
              <div className="text-destructive text-lg font-bold">
                {formatCurrency(storedDeductions + totalPenaltiesDisplay)}
              </div>
              <div className="mt-2 space-y-1">
                {bpjsKesehatanMonthly > 0 && (
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>BPJS Kesehatan</span>
                    <span>{formatCurrency(bpjsKesehatanMonthly)}</span>
                  </div>
                )}
                {bpjsPensiunMonthly > 0 && (
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>BPJS Pensiun</span>
                    <span>{formatCurrency(bpjsPensiunMonthly)}</span>
                  </div>
                )}

                {deductionData
                  .filter((item) => !isBpjsItem(item) && !isPenaltyItem(item))
                  .map((item, index) => (
                    <div key={index} className="text-muted-foreground flex justify-between text-xs">
                      <span>{lineLabel(item)}</span>
                      <span>{formatCurrency(Number(item.calculated_amount) || 0)}</span>
                    </div>
                  ))}

                {deductionData.filter(isPenaltyItem).map((item, index) => (
                  <div key={`penalty-${index}`} className="text-muted-foreground flex justify-between text-xs">
                    <span>{lineLabel(item)}</span>
                    <span>{formatCurrency(Number(item.calculated_amount) || 0)}</span>
                  </div>
                ))}

                {totalPenaltiesDisplay > 0 && penaltyFromItems === 0 && (
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>Penalti Kehadiran</span>
                    <span>{formatCurrency(totalPenaltiesDisplay)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Take-Home Pay</div>
              <div className="text-primary text-xl font-bold">{formatCurrency(takeHomePay)}</div>
              <div className="text-muted-foreground mt-1 text-xs">
                Bruto {formatCurrency(storedGross)} − Pajak {formatCurrency(storedTax)}
              </div>
            </CardContent>
          </Card>
        </div>

        {(taxData.length > 0 || taxBreakdown.length > 0 || monthlyTaxDisplay > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Detail Pajak PPh 21
                {calculationMode === "ter" && (
                  <Badge variant="outline" className="text-xs font-normal">
                    TER
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">PPh 21 Bulanan</span>
                  <span className="text-primary font-bold">{formatCurrency(monthlyTaxDisplay)}</span>
                </div>

                {taxBreakdown.length > 0 && (
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="text-foreground mb-3 text-sm font-medium">Tarif Progresif PPh 21</div>
                    <div className="space-y-2">
                      {taxBreakdown.map((bracket, index) => (
                        <div key={index} className="border-border bg-card rounded border p-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span>
                              Bracket {index + 1}: {bracket.rate}%
                            </span>
                            <span className="text-primary">{formatCurrency(bracket.tax)}</span>
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            <div>Range: {bracket.bracket}</div>
                            <div>PKP dalam bracket: {formatCurrency(bracket.amount)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pph21Detail && isEstimate && (
                  <div className="text-muted-foreground text-xs">
                    Rincian lengkap estimasi — proses payroll untuk menyimpan perhitungan resmi.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedEmployee.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Catatan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground text-sm">{String(selectedEmployee.notes)}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
